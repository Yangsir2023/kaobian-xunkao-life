/**
 * 公告截图上传。
 * 前端先用 canvas 压缩到长边 1600px、JPEG 0.82，再以 base64 JSON 提交 ——
 * 好处是服务端不需要 multipart 解析器（零依赖），同时上传体积可控。
 * 服务端仍会二次校验 MIME 白名单与大小上限（前端限制不可信）。
 * 存储：本地驱动写 DataDir/uploads；CloudBase 驱动写云存储 COS 并回临时链接。
 */
import crypto from 'node:crypto';
import { config } from '../config.mjs';
import { db, persistUpload, storeInfo } from '../store/index.mjs';
import { CODES, fail, ok } from '../lib/errors.mjs';
import { limiters } from '../lib/ratelimit.mjs';
import { requireRole, ROLES } from '../security/auth.mjs';
import { writeAudit, AUDIT_ACTIONS } from '../security/audit.mjs';

const ALLOWED_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
};

/** 图片头魔数校验：防止改后缀绕过 MIME 白名单 */
function sniffImageMime(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp';
  return null;
}

export function registerUploadRoutes(router) {
  router.post('/api/uploads', async (ctx) => {
    const identity = requireRole(ctx, ROLES.USER);
    limiters.upload(identity.user.id);

    const body = ctx.body || {};
    const dataBase64 = typeof body.data === 'string' ? body.data : '';
    if (!dataBase64) throw fail(CODES.UPLOAD_BAD_TYPE, '缺少文件内容（data 字段为 base64）', 400);

    const declaredMime = String(body.mime || '').toLowerCase();
    if (declaredMime && !ALLOWED_MIME[declaredMime]) {
      throw fail(CODES.UPLOAD_BAD_TYPE, `仅支持 png/jpg/webp，收到 ${declaredMime}`, 415);
    }

    const buffer = Buffer.from(dataBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (!buffer.length) throw fail(CODES.UPLOAD_BAD_TYPE, '文件内容为空', 400);
    if (buffer.length > config.uploadMaxBytes) {
      throw fail(
        CODES.UPLOAD_TOO_LARGE,
        `文件 ${(buffer.length / 1024 / 1024).toFixed(2)}MB 超出上限 ${(config.uploadMaxBytes / 1024 / 1024).toFixed(1)}MB`,
        413
      );
    }

    const sniffed = sniffImageMime(buffer);
    if (!sniffed) throw fail(CODES.UPLOAD_BAD_TYPE, '文件内容不是有效图片', 415);
    if (declaredMime && ALLOWED_MIME[declaredMime] !== ALLOWED_MIME[sniffed]) {
      throw fail(CODES.UPLOAD_BAD_TYPE, '声明的类型与文件真实内容不一致', 415);
    }

    const name = `ann_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}.${
      ALLOWED_MIME[sniffed]
    }`;
    let saved;
    try {
      saved = await persistUpload({ filename: name, buffer });
    } catch (err) {
      throw fail(CODES.UPLOAD_FAILED, `保存失败：${err.message}`, 500);
    }

    const record = {
      name: String(body.filename || name).slice(0, 120),
      url: saved.url,
      fileId: saved.fileId,
      size: buffer.length,
      mime: sniffed,
      ownerId: identity.user.id,
      createdAt: new Date().toISOString(),
    };
    // 上传元数据也落库，便于后续清理孤儿文件（本次不引入独立集合，直接记审计 meta）
    await writeAudit({
      action: AUDIT_ACTIONS.UPLOAD_CREATED,
      ctx,
      actor: identity.user,
      target: `upload:${name}`,
      message: `上传公告截图 ${(buffer.length / 1024).toFixed(0)}KB`,
      meta: { size: buffer.length, mime: sniffed, storage: storeInfo().driver, fileId: saved.fileId },
    });

    return ok({ file: record }, '上传成功');
  });

  /** 供前端探测当前环境的存储能力与限制 */
  router.get('/api/uploads/config', async (ctx) => {
    requireRole(ctx, ROLES.USER);
    return ok({
      maxBytes: config.uploadMaxBytes,
      maxMB: Number((config.uploadMaxBytes / 1024 / 1024).toFixed(1)),
      accepts: Object.keys(ALLOWED_MIME),
      driver: storeInfo().driver,
      cloudStorage: storeInfo().cloudStorage,
    });
  });
}
