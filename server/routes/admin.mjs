/**
 * 管理员路由（RBAC 最高权限，全部动作强制写审计）。
 * 仅 role=admin 可访问；首个注册账号自动为管理员（见 auth.mjs resolveInitialRole）。
 */
import { db, storeHealth, storeInfo } from '../store/index.mjs';
import { CODES, fail, ok } from '../lib/errors.mjs';
import * as V from '../lib/validate.mjs';
import { nowIso } from '../lib/ids.mjs';
import { ROLES, requireRole, publicUser, revokeAllSessions, listDevices } from '../security/auth.mjs';
import { writeAudit, AUDIT_ACTIONS, listAuditLogs, countAuditLogs } from '../security/audit.mjs';
import { publicAuditLog } from './me.mjs';

export function registerAdminRoutes(router) {
  /* ── 用户列表 ─────────────────────────────────────── */
  router.get('/api/admin/users', async (ctx) => {
    const identity = requireRole(ctx, ROLES.ADMIN);
    const limit = V.intInRange(ctx.query.get('limit'), 'limit', { min: 1, max: 200, fallback: 50 });
    const offset = V.intInRange(ctx.query.get('offset'), 'offset', { min: 0, max: 10000, fallback: 0 });
    const roleFilter = V.oneOf(ctx.query.get('role'), Object.values(ROLES), 'role', { fallback: null });
    const q = (ctx.query.get('q') || '').trim().toLowerCase();

    const filter = roleFilter ? { role: roleFilter } : {};
    let users = await db.users().find(filter, { sort: { field: 'createdAt', order: 'desc' } });
    if (q) users = users.filter((u) => u.username.toLowerCase().includes(q) || (u.displayName || '').toLowerCase().includes(q));

    const shaped = [];
    for (const user of users.slice(offset, offset + limit)) {
      const reminderCount = await db.reminders().count({ ownerId: user.id });
      const devices = await listDevices(user.id, null);
      shaped.push({
        ...publicUser(user),
        reminderCount,
        deviceCount: devices.filter((d) => !d.revoked).length,
        wechatBound: Boolean(user.wechatOpenId),
      });
    }

    await writeAudit({
      action: AUDIT_ACTIONS.ADMIN_USERS_LISTED,
      ctx,
      actor: identity.user,
      message: `查看用户列表（共 ${users.length} 人）`,
      meta: { total: users.length, roleFilter },
    });

    return ok({ users: shaped, total: users.length, page: { limit, offset } });
  });

  /* ── 调整角色 ─────────────────────────────────────── */
  router.patch('/api/admin/users/:id/role', async (ctx) => {
    const identity = requireRole(ctx, ROLES.ADMIN);
    const target = await db.users().findById(ctx.params.id);
    if (!target) throw fail(CODES.AUTH_SESSION_NOT_FOUND, '用户不存在', 404);

    const role = V.oneOf((ctx.body || {}).role, Object.values(ROLES), 'role');
    if (!role) throw fail(CODES.AUTH_INVALID_PARAMS, '缺少 role 字段', 400);
    if (target.id === identity.user.id && role !== ROLES.ADMIN) {
      throw fail(CODES.FORBIDDEN_ROLE, '不能降低自己的权限，避免失去管理入口', 400);
    }
    if (target.role === ROLES.ADMIN && role !== ROLES.ADMIN) {
      const adminCount = await db.users().count({ role: ROLES.ADMIN, status: 'active' });
      if (adminCount <= 1) throw fail(CODES.FORBIDDEN_ROLE, '系统需保留至少一名管理员', 400);
    }

    const updated = await db.users().updateById(target.id, { role, updatedAt: nowIso() });
    if (role === 'guest' || target.status !== 'active') {
      await revokeAllSessions(target.id, '角色或状态变更，会话需重新建立');
    }
    await writeAudit({
      action: AUDIT_ACTIONS.ADMIN_ROLE_CHANGED,
      ctx,
      actor: identity.user,
      target: `user:${target.id}`,
      message: `将 ${target.username} 的角色由 ${target.role} 改为 ${role}`,
      meta: { from: target.role, to: role },
    });
    return ok({ user: publicUser(updated) }, '角色已更新');
  });

  /* ── 禁用 / 启用账号 ──────────────────────────────── */
  router.patch('/api/admin/users/:id/status', async (ctx) => {
    const identity = requireRole(ctx, ROLES.ADMIN);
    const target = await db.users().findById(ctx.params.id);
    if (!target) throw fail(CODES.AUTH_SESSION_NOT_FOUND, '用户不存在', 404);
    const status = V.oneOf((ctx.body || {}).status, ['active', 'disabled'], 'status');
    if (!status) throw fail(CODES.AUTH_INVALID_PARAMS, '缺少 status 字段', 400);
    if (target.id === identity.user.id) throw fail(CODES.FORBIDDEN_ROLE, '不能禁用自己', 400);

    const updated = await db.users().updateById(target.id, { status, updatedAt: nowIso() });
    if (status === 'disabled') await revokeAllSessions(target.id, '账号被管理员禁用');
    await writeAudit({
      action: AUDIT_ACTIONS.ADMIN_ROLE_CHANGED,
      ctx,
      actor: identity.user,
      target: `user:${target.id}`,
      message: `将 ${target.username} 状态置为 ${status}`,
      meta: { status },
    });
    return ok({ user: publicUser(updated) }, '状态已更新');
  });

  /* ── 全量审计日志 ─────────────────────────────────── */
  router.get('/api/admin/audit-logs', async (ctx) => {
    const identity = requireRole(ctx, ROLES.ADMIN);
    const limit = V.intInRange(ctx.query.get('limit'), 'limit', { min: 1, max: 300, fallback: 80 });
    const offset = V.intInRange(ctx.query.get('offset'), 'offset', { min: 0, max: 10000, fallback: 0 });
    const onlyFailures = ctx.query.get('result') === 'failure';
    const actionPrefix = ctx.query.get('action');

    let logs = await listAuditLogs({ actorId: null, limit: 300, offset: 0 });
    if (onlyFailures) logs = logs.filter((l) => l.result === 'failure');
    if (actionPrefix) logs = logs.filter((l) => l.action.startsWith(actionPrefix));
    const total = logs.length;

    await writeAudit({
      action: AUDIT_ACTIONS.ADMIN_AUDIT_READ,
      ctx,
      actor: identity.user,
      message: `查看全量审计日志（${total} 条），筛选 result=${onlyFailures ? 'failure' : 'all'}`,
    });

    return ok({
      logs: logs.slice(offset, offset + limit).map((log) => ({ ...publicAuditLog(log), actorName: log.actorName, actorRole: log.actorRole })),
      total,
      page: { limit, offset, hasMore: offset + limit < total },
    });
  });

  /* ── 运行概览 ─────────────────────────────────────── */
  router.get('/api/admin/overview', async (ctx) => {
    const identity = requireRole(ctx, ROLES.ADMIN);
    const users = await db.users().find({});
    const reminders = await db.reminders().find({});
    const health = await storeHealth();
    const auditTotal = await countAuditLogs(null);
    const sessions = await db.refreshTokens().find({ revokedAt: null });

    await writeAudit({
      action: AUDIT_ACTIONS.ADMIN_AUDIT_READ,
      ctx,
      actor: identity.user,
      message: '查看运行概览',
    });

    return ok({
      storage: { ...storeInfo(), health },
      users: {
        total: users.length,
        admins: users.filter((u) => u.role === ROLES.ADMIN).length,
        users: users.filter((u) => u.role === ROLES.USER).length,
        wechatBound: users.filter((u) => u.wechatOpenId).length,
      },
      reminders: {
        total: reminders.length,
        official: reminders.filter((r) => r.source === 'official').length,
        userCreated: reminders.filter((r) => r.source === 'user').length,
      },
      audit: { total: auditTotal },
      sessions: { active: sessions.length },
    });
  });
}
