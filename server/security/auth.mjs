/**
 * 会话与鉴权核心。
 *
 * 令牌模型（双令牌 + 轮换 + 重放检测）：
 *   access_token   JWT HS256，15 分钟，无状态；载荷含 sid 指向会话
 *   refresh_token  32 字节随机串，只在客户端保存原文，服务端仅存 sha256 哈希
 *
 * 轮换策略：每次刷新都作废旧 refresh_token 并签发新的（同 familyId）。
 * 重放检测：若某条 refresh_token 已被使用/吊销却再次出现，判定为令牌泄露，
 *           立刻吊销整条 family 下所有会话并记审计 —— 攻击者与用户都被强制重新登录。
 *
 * 吊销语义：access_token 虽无状态，但每次请求都会校验 sid 对应会话是否仍然有效，
 *           因此「退出登录 / 吊销设备」是即时生效的。
 */
import { db } from '../store/index.mjs';
import { newId, newOpaqueToken, sha256, nowIso, isoPlusSeconds, isExpired } from '../lib/ids.mjs';
import { config } from '../config.mjs';
import { signAccessToken, verifyAccessToken, bearerFromHeader } from '../lib/jwt.mjs';
import { CODES, fail } from '../lib/errors.mjs';
import { defaultDeviceName } from '../lib/ua.mjs';
import { writeAudit, AUDIT_ACTIONS } from './audit.mjs';

export const ROLES = { GUEST: 'guest', USER: 'user', ADMIN: 'admin' };
const ROLE_RANK = { guest: 0, user: 1, admin: 2 };

/** 轮换作废的固定原因值：只有这个原因被再次出示时才算「令牌重放」 */
const ROTATED_REASON = '已轮换';

export function roleAtLeast(role, required) {
  return (ROLE_RANK[role] ?? -1) >= (ROLE_RANK[required] ?? 99);
}

/** 对外输出用户信息，绝不包含 passwordHash / openid 等敏感字段 */
export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role,
    status: user.status,
    avatar: user.avatar || null,
    bindings: {
      wechat: Boolean(user.wechatOpenId),
      password: Boolean(user.passwordHash),
    },
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || null,
  };
}

/* ───────────────────────── 设备 ───────────────────────── */

export async function touchDevice(ctx, userId, { deviceName } = {}) {
  const deviceId = ctx.deviceId || `auto-${sha256(ctx.userAgent || '').slice(0, 16)}`;
  const existing = await db.devices().findOne({ userId, deviceId });
  const name = deviceName || ctx.deviceName || defaultDeviceName(ctx.userAgent || '');
  const now = nowIso();

  if (existing) {
    return db.devices().updateById(existing.id, {
      name,
      lastSeenAt: now,
      ip: ctx.ip,
      userAgent: (ctx.userAgent || '').slice(0, 300),
      revokedAt: null,
      revokedReason: null,
    });
  }
  return db.devices().insertOne({
    userId,
    deviceId,
    name,
    ip: ctx.ip,
    userAgent: (ctx.userAgent || '').slice(0, 300),
    firstSeenAt: now,
    lastSeenAt: now,
    revokedAt: null,
    revokedReason: null,
  });
}

/* ───────────────────────── 会话签发 ───────────────────────── */

export async function issueSession({ user, ctx, deviceName = null, familyId = null, method = 'password' }) {
  const device = await touchDevice(ctx, user.id, { deviceName });
  const refreshRaw = newOpaqueToken(32);
  const sessionId = newId('sess');

  await db.refreshTokens().insertOne({
    id: sessionId,
    userId: user.id,
    familyId: familyId || newId('fam'),
    tokenHash: sha256(refreshRaw),
    deviceId: device.deviceId,
    deviceName: device.name,
    loginMethod: method,
    ip: ctx.ip,
    userAgent: (ctx.userAgent || '').slice(0, 300),
    createdAt: nowIso(),
    lastUsedAt: nowIso(),
    expiresAt: isoPlusSeconds(config.jwt.refreshTokenTtl),
    revokedAt: null,
    revokedReason: null,
    replacedById: null,
    rotateCount: 0,
  });

  const access = signAccessToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    sessionId,
  });

  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    accessTokenTtl: access.expiresIn,
    refreshToken: refreshRaw,
    refreshTokenExpiresAt: isoPlusSeconds(config.jwt.refreshTokenTtl),
    sessionId,
    device: { id: device.deviceId, name: device.name },
  };
}

/** 校验会话是否仍有效（用于无状态 JWT 的即时吊销） */
export async function loadActiveSession(sessionId) {
  if (!sessionId) return null;
  const session = await db.refreshTokens().findById(sessionId);
  if (!session) return null;
  if (session.revokedAt) return null;
  if (isExpired(session.expiresAt)) return null;
  const device = await db.devices().findOne({ userId: session.userId, deviceId: session.deviceId });
  if (device?.revokedAt) return null;
  return session;
}

/* ───────────────────────── 刷新与轮换 ───────────────────────── */

export async function rotateRefreshToken({ refreshToken, ctx }) {
  if (!refreshToken || typeof refreshToken !== 'string') {
    throw fail(CODES.AUTH_TOKEN_INVALID, '缺少刷新令牌', 401);
  }
  const hash = sha256(refreshToken);
  const session = await db.refreshTokens().findOne({ tokenHash: hash });

  // 情况一：完全查不到 → 伪造令牌
  if (!session) {
    await writeAudit({
      action: AUDIT_ACTIONS.TOKEN_REUSE_DETECTED,
      ctx,
      result: 'failure',
      message: '刷新令牌不存在（疑似伪造）',
    });
    throw fail(CODES.AUTH_REFRESH_REVOKED, undefined, 401);
  }

  // 情况二：查到但已吊销 → 需要区分「正常作废」与「令牌重放」
  if (session.revokedAt) {
    if (session.revokedReason === ROTATED_REASON) {
      // 已轮换的令牌再次出现 = 令牌被复制或泄露 → 整条 family 连坐，记安全告警
      const revoked = await revokeFamily(session.familyId, '检测到刷新令牌重放，已强制下线该会话族');
      await writeAudit({
        action: AUDIT_ACTIONS.TOKEN_REUSE_DETECTED,
        ctx,
        actor: { id: session.userId, username: `用户${session.userId.slice(-6)}`, role: ROLES.USER },
        target: `family:${session.familyId}`,
        result: 'failure',
        message: `刷新令牌重放：该会话族下 ${revoked} 个会话已被吊销`,
        meta: { reason: session.revokedReason, rotateCount: session.rotateCount },
      });
      throw fail(CODES.AUTH_REFRESH_REUSED, undefined, 401);
    }
    // 会话族被吊销 / 用户登出 / 管理员操作导致的作废：按「会话已失效」处理，不升级为安全告警
    throw fail(CODES.AUTH_REFRESH_REVOKED, `会话已失效（${session.revokedReason || '已吊销'}），请重新登录`, 401);
  }

  if (isExpired(session.expiresAt)) {
    await db.refreshTokens().updateById(session.id, { revokedAt: nowIso(), revokedReason: '令牌已过期' });
    throw fail(CODES.AUTH_REFRESH_REVOKED, '登录状态已过期，请重新登录', 401);
  }

  const user = await db.users().findById(session.userId);
  if (!user || user.status !== 'active') throw fail(CODES.AUTH_USER_DISABLED, undefined, 403);

  const device = await db.devices().findOne({ userId: user.id, deviceId: session.deviceId });
  if (device?.revokedAt) throw fail(CODES.AUTH_REFRESH_REVOKED, '该设备已被吊销，请重新登录', 401);

  // 作废旧令牌
  await db.refreshTokens().updateById(session.id, {
    revokedAt: nowIso(),
    revokedReason: ROTATED_REASON,
    lastUsedAt: nowIso(),
  });

  // 签发同 family 的新令牌
  const issued = await issueSession({
    user,
    ctx: { ...ctx, deviceId: session.deviceId },
    deviceName: session.deviceName,
    familyId: session.familyId,
    method: session.loginMethod,
  });
  await db.refreshTokens().updateById(session.id, { replacedById: issued.sessionId });
  await db.refreshTokens().updateById(issued.sessionId, { rotateCount: (session.rotateCount || 0) + 1 });

  return { ...issued, user: publicUser(user) };
}

export async function revokeSession(sessionId, reason = '用户主动退出登录') {
  const session = await db.refreshTokens().findById(sessionId);
  if (!session) return false;
  if (!session.revokedAt) {
    await db.refreshTokens().updateById(sessionId, { revokedAt: nowIso(), revokedReason: reason });
  }
  return true;
}

export async function revokeFamily(familyId, reason) {
  const sessions = await db.refreshTokens().find({ familyId, revokedAt: null });
  for (const session of sessions) {
    await db.refreshTokens().updateById(session.id, { revokedAt: nowIso(), revokedReason: reason });
  }
  // 注意：这里只吊销会话，不动设备记录。
  // 同一台设备上可能存在多个独立令牌族（多标签页、多次登录），
  // 一次重放只应让「泄露的那条链路」失效；整机下线交给用户显式操作（revokeDevice）。
  return sessions.length;
}

export async function revokeAllSessions(userId, reason = '用户主动退出全部设备', { exceptSessionId = null } = {}) {
  const sessions = await db.refreshTokens().find({ userId, revokedAt: null });
  let count = 0;
  for (const session of sessions) {
    if (exceptSessionId && session.id === exceptSessionId) continue;
    await db.refreshTokens().updateById(session.id, { revokedAt: nowIso(), revokedReason: reason });
    count += 1;
  }
  return count;
}

/* ───────────────────────── 请求上下文鉴权 ───────────────────────── */

/**
 * 尝试从请求头解析身份。
 *
 * 关键设计：解析失败**不在这里抛错**，而是返回带 error 的游客身份。
 * 原因：公开接口（登录/注册/刷新/微信授权）经常在「本地还残留一个过期或已吊销令牌」
 * 的情况下被调用，如果这里直接抛 401，用户会连登录都做不了（自锁）。
 * 需要鉴权的端点通过 requireAuth() 读取 error 并抛出原始错误码，语义不变。
 */
export async function resolveIdentity(ctx) {
  const token = bearerFromHeader(ctx.req.headers.authorization);
  const anonymous = (error = null) => ({
    user: null,
    session: null,
    role: ROLES.GUEST,
    authenticated: false,
    error,
  });

  if (!token) return anonymous();

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    return anonymous({
      code: CODES.AUTH_TOKEN_INVALID,
      message: err.message?.includes('过期') ? '登录状态已过期' : '登录状态无效',
      status: 401,
    });
  }

  const session = await loadActiveSession(payload.sid);
  if (!session || session.userId !== payload.sub) {
    return anonymous({ code: CODES.AUTH_REFRESH_REVOKED, message: '会话已失效，请重新登录', status: 401 });
  }

  const user = await db.users().findById(payload.sub);
  if (!user || user.status !== 'active') {
    return anonymous({ code: CODES.AUTH_USER_DISABLED, message: '账号已被禁用', status: 403 });
  }

  return { user, session, role: user.role, authenticated: true, error: null, payload };
}

export function requireAuth(ctx) {
  const identity = ctx.identity;
  if (!identity?.authenticated) {
    const error = identity?.error;
    throw fail(
      error?.code ?? CODES.AUTH_TOKEN_INVALID,
      error?.message ?? '请先登录后再操作',
      error?.status ?? 401
    );
  }
  return identity;
}

export function requireRole(ctx, required) {
  const identity = requireAuth(ctx);
  if (!roleAtLeast(identity.role, required)) {
    throw fail(CODES.FORBIDDEN_ROLE, `该操作需要 ${required} 及以上权限`, 403);
  }
  return identity;
}

/* ───────────────────────── 设备列表 ───────────────────────── */

export async function listDevices(userId, currentDeviceId = null) {
  const devices = await db.devices().find({ userId }, { sort: { field: 'lastSeenAt', order: 'desc' } });
  const sessions = await db.refreshTokens().find({ userId, revokedAt: null });
  const sessionCount = sessions.reduce((acc, s) => {
    acc[s.deviceId] = (acc[s.deviceId] || 0) + 1;
    return acc;
  }, {});

  return devices.map((device) => {
    const activeSessions = sessions.filter((s) => s.deviceId === device.deviceId);
    const lastLogin = activeSessions
      .map((s) => s.lastUsedAt || s.createdAt)
      .sort()
      .pop();
    return {
      id: device.id,
      deviceId: device.deviceId,
      name: device.name,
      ip: device.ip,
      userAgent: device.userAgent,
      current: device.deviceId === currentDeviceId,
      revoked: Boolean(device.revokedAt),
      revokedReason: device.revokedReason || null,
      activeSessions: sessionCount[device.deviceId] || 0,
      firstSeenAt: device.firstSeenAt,
      lastSeenAt: lastLogin || device.lastSeenAt,
    };
  });
}

export async function revokeDevice(userId, deviceDocId, reason = '用户在安全记录中吊销设备') {
  const device = await db.devices().findById(deviceDocId);
  if (!device || device.userId !== userId) throw fail(CODES.AUTH_SESSION_NOT_FOUND, undefined, 404);
  await db.devices().updateById(device.id, { revokedAt: nowIso(), revokedReason: reason });
  const sessions = await db.refreshTokens().find({ userId, deviceId: device.deviceId, revokedAt: null });
  for (const session of sessions) {
    await db.refreshTokens().updateById(session.id, { revokedAt: nowIso(), revokedReason: reason });
  }
  return { device, revokedSessions: sessions.length };
}
