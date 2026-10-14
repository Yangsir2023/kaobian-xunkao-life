/**
 * 安全审计日志：所有涉及身份与数据边界的动作都落一条记录。
 * 记录里绝不写入密码、原始令牌、公告链接里的敏感 query —— 只留可审计的事实。
 */
import { db } from '../store/index.mjs';
import { newId, nowIso } from '../lib/ids.mjs';
import { config } from '../config.mjs';

export const AUDIT_ACTIONS = {
  REGISTER: 'auth.register',
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILED: 'auth.login.failed',
  LOGIN_LOCKED: 'auth.login.rate_limited',
  LOGOUT: 'auth.logout',
  LOGOUT_ALL: 'auth.logout.all',
  TOKEN_REFRESH: 'auth.token.refresh',
  TOKEN_REUSE_DETECTED: 'auth.token.reuse_detected',
  SESSION_REVOKED: 'auth.session.revoked',
  WECHAT_LOGIN: 'auth.wechat.login',
  WECHAT_LOGIN_FAILED: 'auth.wechat.failed',
  PROFILE_READ: 'me.profile.read',
  REMINDER_CREATED: 'reminder.created',
  REMINDER_UPDATED: 'reminder.updated',
  REMINDER_DELETED: 'reminder.deleted',
  REMINDER_ACCESS_DENIED: 'reminder.access_denied',
  UPLOAD_CREATED: 'upload.created',
  ADMIN_USERS_LISTED: 'admin.users.listed',
  ADMIN_ROLE_CHANGED: 'admin.role.changed',
  ADMIN_AUDIT_READ: 'admin.audit.read',
  FORBIDDEN: 'security.forbidden',
};

/** 统一从上下文抽取来源信息，避免每条日志都手写 */
function sourceOf(ctx = {}) {
  return {
    ip: ctx.ip || 'unknown',
    userAgent: (ctx.userAgent || '').slice(0, 300),
    deviceId: ctx.deviceId || null,
    deviceName: ctx.deviceName || null,
  };
}

export async function writeAudit({
  action,
  ctx = {},
  actor = null,
  target = null,
  result = 'success',
  message = null,
  meta = null,
}) {
  const entry = {
    id: newId('log'),
    action,
    result,
    actorId: actor?.id || null,
    actorName: actor?.username || ctx.username || '匿名',
    actorRole: actor?.role || 'guest',
    target,
    message,
    meta,
    ...sourceOf(ctx),
    createdAt: nowIso(),
  };
  try {
    await db.auditLogs().insertOne(entry);
  } catch (err) {
    // 审计写入失败不能拖垮主流程，但必须留下痕迹
    console.error('[audit] 写入失败', err.message, entry.action);
  }
  return entry;
}

export async function listAuditLogs({ actorId = null, limit = 50, offset = 0 } = {}) {
  const filter = actorId ? { actorId } : {};
  return db.auditLogs().find(filter, { sort: { field: 'createdAt', order: 'desc' }, limit, offset });
}

export async function countAuditLogs(actorId = null) {
  return db.auditLogs().count(actorId ? { actorId } : {});
}

/** 日志保留策略：仅保留最近 N 条，避免本地 JSON 无限膨胀 */
export async function pruneAuditLogs(keep = 5000) {
  const total = await db.auditLogs().count({});
  if (total <= keep) return 0;
  const rows = await db.auditLogs().find({}, { sort: { field: 'createdAt', order: 'desc' }, limit: keep });
  await db.auditLogs().replaceAll(rows);
  return total - keep;
}

export const isAuditEnabled = true;
export const auditRetention = 5000;
export const auditConfig = { retention: auditRetention, driver: config.dbDriver };
