/**
 * 巡考日历 · 服务入口
 *
 * 职责：装配存储 → 装配路由 → 请求分发（API / 静态资源 / SPA 回退）。
 * 单进程零外部依赖：node server/index.mjs 即可跑起来。
 */
import http from 'node:http';
import path from 'node:path';
import { config, ROOT, startupNotices } from './config.mjs';
import { initStore, storeHealth, storeInfo } from './store/index.mjs';
import { createRouter, sendError, sendJson, serveStatic, readJsonBody, redirect, isPathAllowed } from './lib/http.mjs';
import { CODES, AppError, ok } from './lib/errors.mjs';
import { clientIp } from './lib/ua.mjs';
import { resolveIdentity } from './security/auth.mjs';
import { writeAudit, AUDIT_ACTIONS } from './security/audit.mjs';
import { registerAuthRoutes } from './routes/auth.mjs';
import { registerReminderRoutes } from './routes/reminders.mjs';
import { registerCategoryRoutes } from './routes/category-detail.mjs';
import { registerPositionRoutes } from './routes/positions.mjs';
import { registerMeRoutes } from './routes/me.mjs';
import { registerUploadRoutes } from './routes/uploads.mjs';
import { registerAdminRoutes } from './routes/admin.mjs';
import { publicCategories } from './catalog.mjs';
import { importOfficialNodes } from './official-nodes.mjs';
import { importPositionSeeds } from './position-nodes.mjs';
import { db } from './store/index.mjs';
import { newId, nowIso } from './lib/ids.mjs';

const PUBLIC_DIR = path.join(ROOT, 'public');

/**
 * 启动时确保公共种子存在（幂等）：
 * 全新部署（云端沙箱、新克隆的仓库）数据库是空的，此时自动导入；
 * 已有数据的环境只做一次计数检查，不重复写入。
 * 导入失败不阻断启动——种子缺失时页面走空态，可随时 `npm run seed` 手动补齐。
 */
async function ensureSeedData() {
  try {
    const [nodeCount, positionCount] = await Promise.all([
      db.reminders().count({ source: 'system' }),
      db.positions().count({ source: 'system' }),
    ]);
    if (nodeCount === 0) {
      const result = await importOfficialNodes({ db, newId, nowIso });
      console.log(`[seed] 自动导入公共招考节点 ${result.inserted} 条`);
    }
    if (positionCount === 0) {
      const result = await importPositionSeeds({ db, newId, nowIso });
      console.log(`[seed] 自动导入岗位库种子 ${result.inserted} 条`);
    }
  } catch (err) {
    console.warn(`[seed] 自动导入跳过：${err.message}`);
  }
}

/**
 * 客户端把设备名做了 encodeURIComponent（HTTP 头只能是 Latin-1 字节串），
 * 这里解回来；解不开就按原始值用，绝不因为一个展示字段把请求打挂。
 */
function decodeHeaderText(raw) {
  if (!raw) return null;
  const text = String(raw).slice(0, 240);
  try {
    return decodeURIComponent(text).slice(0, 60);
  } catch {
    return text.slice(0, 60);
  }
}

export async function buildServer() {
  await initStore();
  await ensureSeedData();

  const router = createRouter();
  registerAuthRoutes(router);
  registerReminderRoutes(router);
  registerCategoryRoutes(router);
  registerPositionRoutes(router);
  registerMeRoutes(router);
  registerUploadRoutes(router);
  registerAdminRoutes(router);

  /* ── 基础接口 ─────────────────────────────────────── */
  router.get('/api/health', async () => {
    const health = await storeHealth();
    return ok({
      status: health.ok ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      version: '1.0.0',
      storage: { ...storeInfo(), health },
      mode: config.nodeEnv,
      wechat: config.wechat.mock ? 'mock' : 'real',
      time: new Date().toISOString(),
    });
  });

  router.get('/api/meta', async () => ok({
    appName: '巡考日历',
    appNameEn: 'Exam Patrol Calendar',
    tagline: '把每一个招考截止日期，提前摆到你眼前',
    categories: publicCategories(),
    rbac: {
      guest: '浏览公共招考节点、查看官方公告入口',
      user: '管理自己的提醒、上传公告截图、查看本机安全记录',
      admin: '查看全量用户与审计日志、调整角色、运行概览',
    },
    features: [
      '提醒首页按临近考试倒序 + 倒计时分级（紧急/临近/正常/已截止）',
      '八大类招考节点分类与多条件筛选（类型/状态/时间窗/关键词/排序）',
      '微信 OAuth2 授权登录 与 数据库账号登录双通道',
      'scrypt 加盐口令存储、JWT 无状态鉴权、刷新令牌轮换与重放检测',
      '登录设备管理与安全审计日志（可吊销设备、可退出全部设备）',
      '公告截图上传（本地磁盘 / CloudBase 云存储，自动压缩 + 魔数校验）',
    ],
  }));

  /* ── 请求分发 ─────────────────────────────────────── */
  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    const ctx = {
      req,
      res,
      method: req.method,
      pathname: decodeURIComponent(url.pathname),
      query: url.searchParams,
      params: {},
      ip: clientIp(req),
      userAgent: req.headers['user-agent'] || '',
      deviceId: (req.headers['x-device-id'] || '').toString().slice(0, 64) || null,
      deviceName: decodeHeaderText(req.headers['x-device-name']),
      body: {},
      identity: null,
    };

    try {
      /* 1) API 路由 */
      if (ctx.pathname.startsWith('/api/')) {
        const matched = router.match(req.method, ctx.pathname);
        if (!matched) {
          throw new AppError(CODES.SYSTEM_NOT_FOUND, `接口不存在：${ctx.method} ${ctx.pathname}`, 404);
        }
        ctx.params = matched.params;
        if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
          // base64 会使体积膨胀约 4/3，这里预留 1.4 倍空间 + 1MB 表单余量
          ctx.body = await readJsonBody(ctx, Math.ceil(config.uploadMaxBytes * 1.4) + 1024 * 1024);
        }
        ctx.identity = await resolveIdentity(ctx);
        const result = await matched.handler(ctx);
        // 少数端点（微信回调）需要 302 跳转，用 __redirect 约定
        if (result && typeof result === 'object' && result.__redirect) {
          redirect(res, result.__redirect);
          return;
        }
        sendJson(res, 200, result ?? ok(null));
        return;
      }

      /* 2) 用户上传的文件（本地驱动） */
      if (ctx.pathname.startsWith('/uploads/')) {
        const relative = ctx.pathname.replace('/uploads/', '');
        if (relative.includes('..')) throw new AppError(CODES.FORBIDDEN_RESOURCE, undefined, 403);
        const filePath = path.join(config.uploadsDir, relative);
        const served = await serveStatic(res, filePath, { immutable: true });
        if (!served) throw new AppError(CODES.SYSTEM_NOT_FOUND, '文件不存在', 404);
        return;
      }

      /* 3) 静态资源 */
      if (ctx.pathname !== '/' && !ctx.pathname.endsWith('/')) {
        const candidate = path.join(PUBLIC_DIR, ctx.pathname);
        if (isPathAllowed(candidate)) {
          const served = await serveStatic(res, candidate);
          if (served) return;
        }
      }

      /* 4) SPA 回退：前端使用 hash 路由，任意非资源路径都交给 index.html */
      const served = await serveStatic(res, path.join(PUBLIC_DIR, 'index.html'));
      if (!served) {
        sendJson(res, 500, { code: CODES.SYSTEM_INTERNAL, message: '前端资源缺失：public/index.html', data: null });
      }
    } catch (error) {
      // 401/403 也留痕：这类事件是安全审计最关心的信号
      if (error instanceof AppError && [401, 403].includes(error.httpStatus)) {
        await writeAudit({
          action: error.httpStatus === 403 ? AUDIT_ACTIONS.FORBIDDEN : AUDIT_ACTIONS.FORBIDDEN,
          ctx,
          result: 'failure',
          message: `${error.code} ${error.message} @ ${ctx.method} ${ctx.pathname}`,
        });
      }
      sendError(res, error);
    } finally {
      const ms = Date.now() - started;
      if (ms > 500 || config.nodeEnv !== 'test') {
        const level = ms > 500 ? 'slow' : 'req';
        if (config.nodeEnv !== 'production') {
          console.log(`[${level}] ${req.method} ${ctx.pathname} → ${res.statusCode} ${ms}ms`);
        }
      }
    }
  });

  return { server, router };
}

/* ── 直接运行时启动 ─────────────────────────────────── */
const isMain = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (isMain) {
  const { server } = await buildServer();
  server.listen(config.port, config.host, () => {
    const line = '─'.repeat(58);
    console.log(`\n${line}\n  巡考日历 · Exam Patrol Calendar  v1.0.0\n${line}`);
    for (const notice of startupNotices()) console.log(`  ${notice}`);
    console.log(`${line}\n  本地访问  http://${config.host}:${config.port}/`);
    console.log(`  健康检查  http://${config.host}:${config.port}/api/health`);
    console.log(`${line}\n`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      console.log(`\n[server] 收到 ${signal}，正在关闭…`);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 2000);
    });
  }
}
