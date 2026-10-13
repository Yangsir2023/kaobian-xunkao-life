/**
 * 鉴权路由：注册 / 登录 / 刷新 / 退出 / 微信授权。
 * 所有响应统一 ApiResponse{code,message,data}，涉及身份的动作全部写审计日志。
 */
import { db } from '../store/index.mjs';
import { config } from '../config.mjs';
import { CODES, fail, ok } from '../lib/errors.mjs';
import { hashPassword, verifyPassword, assertPasswordPolicy } from '../lib/password.mjs';
import { limiters } from '../lib/ratelimit.mjs';
import { newId, nowIso } from '../lib/ids.mjs';
import * as V from '../lib/validate.mjs';
import {
  ROLES,
  publicUser,
  issueSession,
  rotateRefreshToken,
  revokeSession,
  revokeAllSessions,
  requireAuth,
  resolveIdentity,
} from '../security/auth.mjs';
import { writeAudit, AUDIT_ACTIONS } from '../security/audit.mjs';
import {
  createState,
  consumeState,
  createAuthorizeUrl,
  exchangeCodeForProfile,
  buildMockProfile,
  createLoginTicket,
  consumeLoginTicket,
  wechatMode,
} from '../providers/wechat.mjs';

/** 首个注册用户自动成为管理员（个人项目常见做法，README 中有说明） */
async function resolveInitialRole() {
  const total = await db.users().count({});
  return total === 0 ? ROLES.ADMIN : ROLES.USER;
}

export function registerAuthRoutes(router) {
  /* ── 注册 ─────────────────────────────────────────── */
  router.post('/api/auth/register', async (ctx) => {
    limiters.register(ctx.ip);
    const body = ctx.body || {};
    const name = V.username(body.username);
    assertPasswordPolicy(body.password, name);
    if (body.displayName !== undefined) V.str(body.displayName, 'displayName', { max: 40, required: false });

    const exists = await db.users().findOne({ username: name });
    if (exists) {
      await writeAudit({
        action: AUDIT_ACTIONS.REGISTER,
        ctx,
        result: 'failure',
        message: `用户名 ${name} 已被占用`,
      });
      throw fail(CODES.AUTH_USERNAME_TAKEN, undefined, 409);
    }

    const role = await resolveInitialRole();
    const user = await db.users().insertOne({
      id: newId('usr'),
      username: name,
      displayName: body.displayName?.trim() || name,
      passwordHash: await hashPassword(body.password),
      role,
      status: 'active',
      wechatOpenId: null,
      wechatUnionId: null,
      avatar: null,
      createdAt: nowIso(),
      lastLoginAt: nowIso(),
      passwordUpdatedAt: nowIso(),
    });

    const session = await issueSession({ user, ctx, method: 'password' });
    await writeAudit({
      action: AUDIT_ACTIONS.REGISTER,
      ctx,
      actor: user,
      target: `user:${user.id}`,
      message: `注册成功，初始角色 ${role}`,
      meta: { role, sessionId: session.sessionId },
    });

    return ok({ user: publicUser(user), ...session }, '注册成功，已自动登录');
  });

  /* ── 登录 ─────────────────────────────────────────── */
  router.post('/api/auth/login', async (ctx) => {
    limiters.login(ctx.ip);
    const body = ctx.body || {};
    const name = V.username(body.username);
    const password = typeof body.password === 'string' ? body.password : '';
    if (!password) throw fail(CODES.AUTH_INVALID_PARAMS, '请输入密码', 400);

    const user = await db.users().findOne({ username: name });
    // 用户不存在时也走一次哈希校验，抹平响应时间差，避免用户名枚举
    const stored = user?.passwordHash || 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
    const check = await verifyPassword(password, stored);

    if (!user || !check.valid) {
      await writeAudit({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        ctx,
        actor: user || null,
        result: 'failure',
        message: `账号认证失败：${name}`,
        meta: { username: name },
      });
      throw fail(CODES.AUTH_BAD_CREDENTIALS, undefined, 401);
    }
    if (user.status !== 'active') throw fail(CODES.AUTH_USER_DISABLED, undefined, 403);

    const patch = { lastLoginAt: nowIso() };
    if (check.needsRehash) {
      // 老哈希参数升级：登录成功时顺手重哈希（用户无感）
      patch.passwordHash = await hashPassword(password);
      patch.passwordUpdatedAt = nowIso();
    }
    const updated = await db.users().updateById(user.id, patch);

    const session = await issueSession({ user: updated, ctx, method: 'password' });
    limiters.resetLogin(ctx.ip);
    await writeAudit({
      action: AUDIT_ACTIONS.LOGIN_SUCCESS,
      ctx,
      actor: updated,
      target: `user:${updated.id}`,
      message: '密码登录成功',
      meta: { sessionId: session.sessionId, rehashed: Boolean(patch.passwordHash) },
    });

    return ok({ user: publicUser(updated), ...session }, '登录成功');
  });

  /* ── 刷新（轮换） ─────────────────────────────────── */
  router.post('/api/auth/refresh', async (ctx) => {
    limiters.refresh(ctx.ip);
    const body = ctx.body || {};
    const rotated = await rotateRefreshToken({ refreshToken: body.refreshToken, ctx });
    await writeAudit({
      action: AUDIT_ACTIONS.TOKEN_REFRESH,
      ctx,
      actor: rotated.user,
      target: `session:${rotated.sessionId}`,
      message: '刷新令牌轮换成功',
      meta: { sessionId: rotated.sessionId },
    });
    const { user, ...tokens } = rotated;
    return ok({ user, ...tokens });
  });

  /* ── 退出当前设备 ─────────────────────────────────── */
  router.post('/api/auth/logout', async (ctx) => {
    const identity = requireAuth(ctx);
    await revokeSession(identity.session.id, '用户主动退出登录');
    await writeAudit({
      action: AUDIT_ACTIONS.LOGOUT,
      ctx,
      actor: identity.user,
      target: `session:${identity.session.id}`,
      message: '退出当前设备',
    });
    return ok({ revoked: 1 });
  });

  /* ── 退出全部设备 ─────────────────────────────────── */
  router.post('/api/auth/logout-all', async (ctx) => {
    const identity = requireAuth(ctx);
    const count = await revokeAllSessions(identity.user.id, '用户主动退出全部设备', {
      exceptSessionId: null,
    });
    await writeAudit({
      action: AUDIT_ACTIONS.LOGOUT_ALL,
      ctx,
      actor: identity.user,
      target: `user:${identity.user.id}`,
      message: `退出全部设备，吊销 ${count} 个会话`,
      meta: { revoked: count },
    });
    return ok({ revoked: count }, '已退出全部设备');
  });

  /* ── 微信：获取授权地址 ───────────────────────────── */
  router.get('/api/auth/wechat/url', async (ctx) => {
    const state = createState({ redirectTo: ctx.query.get('redirectTo') || null });
    const authorizeUrl = createAuthorizeUrl({ state });
    return ok({
      mode: wechatMode(),
      state,
      authorizeUrl,
      // 前端据此提示用户当前是真实授权还是本地模拟
      notice: config.wechat.mock
        ? '当前未配置微信 AppID/AppSecret，走本地模拟授权通道，仅用于开发联调'
        : '将跳转微信开放平台完成授权',
    });
  });

  /* ── 微信：回调（真实通道） ───────────────────────── */
  router.get('/api/auth/wechat/callback', async (ctx) => {
    const code = ctx.query.get('code');
    const state = ctx.query.get('state');
    try {
      consumeState(state);
      if (!code) throw fail(CODES.AUTH_WECHAT_FAILED, '微信未返回授权码', 400);
      const profile = await exchangeCodeForProfile(code);
      const userId = await upsertWechatUser(profile);
      const ticket = createLoginTicket({ userId, profile, openid: profile.openid });
      return { __redirect: `/#/auth/wechat?ticket=${encodeURIComponent(ticket)}` };
    } catch (err) {
      await writeAudit({
        action: AUDIT_ACTIONS.WECHAT_LOGIN_FAILED,
        ctx,
        result: 'failure',
        message: err.message,
      });
      const code2 = err.code || CODES.AUTH_WECHAT_FAILED;
      return { __redirect: `/#/login?wechatError=${code2}&message=${encodeURIComponent(err.message)}` };
    }
  });

  /* ── 微信：模拟授权（Mock 通道） ──────────────────── */
  router.post('/api/auth/wechat/mock-authorize', async (ctx) => {
    if (!config.wechat.mock) {
      throw fail(CODES.AUTH_WECHAT_FAILED, '当前为真实授权通道，请通过微信授权页登录', 400);
    }
    const body = ctx.body || {};
    const record = consumeState(body.state);
    const seed = body.demoAccount || ctx.deviceId || 'demo';
    const profile = buildMockProfile(seed);
    const userId = await upsertWechatUser(profile);
    const ticket = createLoginTicket({ userId, profile, openid: profile.openid });
    await writeAudit({
      action: AUDIT_ACTIONS.WECHAT_LOGIN,
      ctx,
      actor: { id: userId, username: profile.nickname, role: ROLES.USER },
      target: `user:${userId}`,
      message: '模拟微信授权成功（Mock 通道）',
      meta: { openid: `${profile.openid.slice(0, 18)}…`, mock: true, redirectTo: record.redirectTo },
    });
    return ok({ ticket, mock: true, profile: { nickname: profile.nickname, avatar: profile.avatar } });
  });

  /* ── 微信：票据换令牌（真实/Mock 共用入口） ───────── */
  router.post('/api/auth/wechat/ticket', async (ctx) => {
    const body = ctx.body || {};
    const record = consumeLoginTicket(body.ticket);
    const user = await db.users().findById(record.userId);
    if (!user || user.status !== 'active') throw fail(CODES.AUTH_USER_DISABLED, undefined, 403);

    const updated = await db.users().updateById(user.id, { lastLoginAt: nowIso() });
    const session = await issueSession({ user: updated, ctx, method: 'wechat' });
    await writeAudit({
      action: AUDIT_ACTIONS.WECHAT_LOGIN,
      ctx,
      actor: updated,
      target: `user:${updated.id}`,
      message: `微信授权登录成功（${record.profile.mock ? 'Mock 通道' : '真实通道'}）`,
      meta: { sessionId: session.sessionId, mock: Boolean(record.profile.mock) },
    });
    return ok({ user: publicUser(updated), ...session }, '微信授权登录成功');
  });

  /* ── 当前身份 ─────────────────────────────────────── */
  router.get('/api/auth/session', async (ctx) => {
    const identity = await resolveIdentity(ctx);
    if (!identity.authenticated) {
      return ok({ authenticated: false, role: ROLES.GUEST, user: null });
    }
    return ok({
      authenticated: true,
      role: identity.role,
      user: publicUser(identity.user),
      session: {
        id: identity.session.id,
        deviceId: identity.session.deviceId,
        deviceName: identity.session.deviceName,
        loginMethod: identity.session.loginMethod,
        createdAt: identity.session.createdAt,
        expiresAt: identity.session.expiresAt,
      },
    });
  });
}

/** 微信档案 → 本地账号（按 openid 幂等 upsert，昵称仅在为空时补写） */
export async function upsertWechatUser(profile) {
  const existing = await db.users().findOne({ wechatOpenId: profile.openid });
  if (existing) {
    const patch = {};
    if (!existing.avatar && profile.avatar) patch.avatar = profile.avatar;
    if (profile.unionid && !existing.wechatUnionId) patch.wechatUnionId = profile.unionid;
    const updated = Object.keys(patch).length ? await db.users().updateById(existing.id, patch) : existing;
    return updated.id;
  }

  const shortId = profile.openid.slice(-6);
  const base = `wx_${shortId}`;
  let candidate = base;
  let n = 1;
  while (await db.users().findOne({ username: candidate })) {
    candidate = `${base}${n}`;
    n += 1;
  }

  const role = await resolveInitialRole();
  const user = await db.users().insertOne({
    id: newId('usr'),
    username: candidate,
    displayName: profile.nickname || `微信用户${shortId}`,
    passwordHash: null,
    role,
    status: 'active',
    wechatOpenId: profile.openid,
    wechatUnionId: profile.unionid || null,
    avatar: profile.avatar || null,
    createdAt: nowIso(),
    lastLoginAt: nowIso(),
  });
  return user.id;
}
