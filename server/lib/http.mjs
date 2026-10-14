/**
 * HTTP 基础层：路由表、请求体读取、静态资源、统一响应封装。
 * 全部基于 node:http，不引入 Express/Koa，避免任何外部依赖。
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { CODES, MESSAGES, AppError, ok } from './errors.mjs';
import { config, ROOT } from '../config.mjs';

/* ───────────────────────────── 路由 ───────────────────────────── */

export function createRouter() {
  const routes = [];
  const add = (method, pattern, handler) =>
    routes.push({ method, segments: pattern.split('/').filter(Boolean), handler });

  return {
    get: (p, h) => add('GET', p, h),
    post: (p, h) => add('POST', p, h),
    put: (p, h) => add('PUT', p, h),
    patch: (p, h) => add('PATCH', p, h),
    delete: (p, h) => add('DELETE', p, h),
    get routes() {
      return routes.map((r) => `${r.method} /${r.segments.join('/')}`);
    },
    match(method, pathname) {
      const parts = pathname.split('/').filter(Boolean);
      let pathMatched = false;
      for (const route of routes) {
        if (route.segments.length !== parts.length) continue;
        const params = {};
        let matched = true;
        for (let i = 0; i < route.segments.length; i += 1) {
          const seg = route.segments[i];
          if (seg.startsWith(':')) {
            params[seg.slice(1)] = decodeURIComponent(parts[i]);
          } else if (seg !== parts[i]) {
            matched = false;
            break;
          }
        }
        if (!matched) continue;
        pathMatched = true;
        if (route.method === method) return { handler: route.handler, params };
      }
      if (pathMatched) throw new AppError(CODES.SYSTEM_METHOD_NOT_ALLOWED, undefined, 405);
      return null;
    },
  };
}

/* ───────────────────────────── 请求读取 ───────────────────────────── */

export async function readJsonBody(ctx, maxBytes = 512 * 1024) {
  const raw = await readRawBody(ctx, maxBytes);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    throw new AppError(CODES.AUTH_INVALID_PARAMS, '请求体不是合法 JSON', 400);
  }
}

export function readRawBody(ctx, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let overflowed = false;
    ctx.req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        // 超限后继续把剩余数据读完再报错：直接 destroy 会让客户端拿到 ECONNRESET 而不是 413
        overflowed = true;
        chunks.length = 0;
        return;
      }
      if (!overflowed) chunks.push(chunk);
    });
    ctx.req.on('end', () => {
      if (overflowed) {
        reject(new AppError(CODES.UPLOAD_TOO_LARGE, `请求体超过 ${Math.round(maxBytes / 1024)}KB`, 413));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
    ctx.req.on('error', reject);
  });
}

/* ───────────────────────────── 响应 ───────────────────────────── */

export function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  };
  if (config.corsOrigin) {
    headers['Access-Control-Allow-Origin'] = config.corsOrigin;
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Device-Id, X-Device-Name';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PATCH, PUT, DELETE, OPTIONS';
    headers['Access-Control-Max-Age'] = '600';
  }
  res.writeHead(status, headers);
  res.end(body);
}

export const sendOk = (res, data = null, message = MESSAGES[CODES.OK]) => sendJson(res, 200, ok(data, message));

export function sendError(res, error) {
  if (error instanceof AppError) {
    const payload = { code: error.code, message: error.message, data: null };
    if (error.retryAfter) payload.data = { retryAfter: error.retryAfter };
    if (error.details) payload.data = error.details;
    sendJson(res, error.httpStatus, payload);
    return;
  }
  // 未预期异常：不把堆栈暴露给客户端，只打日志
  console.error('[unhandled]', error);
  sendJson(res, 500, { code: CODES.SYSTEM_INTERNAL, message: MESSAGES[CODES.SYSTEM_INTERNAL], data: null });
}

export function redirect(res, location) {
  if (config.corsOrigin) res.setHeader('Access-Control-Allow-Origin', config.corsOrigin);
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

/* ───────────────────────────── 静态资源 ───────────────────────────── */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

/**
 * 允许被静态服务的根目录白名单：项目 public/ 与上传目录。
 * 注意用 ROOT 推导 public，而不是从 dataDir 往上找 —— DATA_DIR 可被自定义，
 * 从 dataDir 反推会在自定义目录时算错，导致静态资源全部 403/500。
 */
export const STATIC_ROOTS = [path.resolve(ROOT, 'public'), path.resolve(config.dataDir)];

export function isPathAllowed(filePath) {
  const resolved = path.resolve(filePath);
  return STATIC_ROOTS.some((root) => resolved === root || resolved.startsWith(root + path.sep));
}

export async function serveStatic(res, filePath, { immutable = false } = {}) {
  const resolved = path.resolve(filePath);
  if (!isPathAllowed(resolved)) return false; // 目录穿越防护
  let stat;
  try {
    stat = await fsp.stat(resolved);
    if (!stat.isFile()) return false;
  } catch {
    return false;
  }

  const ext = path.extname(resolved).toLowerCase();
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  };
  if (config.corsOrigin) headers['Access-Control-Allow-Origin'] = config.corsOrigin;

  res.writeHead(200, headers);
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(resolved);
    stream.on('error', reject);
    stream.on('end', resolve);
    stream.pipe(res);
  });
  return true;
}
