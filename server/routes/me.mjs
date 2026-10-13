/**
 * 「我的」与安全记录路由：资料、登录设备、安全审计日志。
 * 用户只能看到自己的设备与日志；管理员另有全量入口（/api/admin/audit-logs）。
 */
import { db, storeInfo } from '../store/index.mjs';
import { ok } from '../lib/errors.mjs';
import * as V from '../lib/validate.mjs';
import { listDevices, revokeDevice, publicUser, requireAuth, revokeAllSessions } from '../security/auth.mjs';
import { writeAudit, AUDIT_ACTIONS, listAuditLogs, countAuditLogs } from '../security/audit.mjs';

export function registerMeRoutes(router) {
  /* ── 我的资料 ─────────────────────────────────────── */
  router.get('/api/me', async (ctx) => {
    const identity = requireAuth(ctx);
    const reminderCount = await db.reminders().count({ ownerId: identity.user.id });
    const activeCount = await db.reminders().count({ ownerId: identity.user.id, status: 'active' });
    const deviceCount = (await listDevices(identity.user.id, identity.session.deviceId)).filter(
      (d) => !d.revoked
    ).length;
    const auditCount = await countAuditLogs(identity.user.id);

    await writeAudit({
      action: AUDIT_ACTIONS.PROFILE_READ,
      ctx,
      actor: identity.user,
      message: '读取个人资料',
    });

    return ok({
      user: publicUser(identity.user),
      stats: { reminders: reminderCount, active: activeCount, devices: deviceCount, auditLogs: auditCount },
      security: {
        lastLoginAt: identity.user.lastLoginAt,
        passwordUpdatedAt: identity.user.passwordUpdatedAt || null,
        wechatBound: Boolean(identity.user.wechatOpenId),
        currentSession: {
          id: identity.session.id,
          deviceName: identity.session.deviceName,
          loginMethod: identity.session.loginMethod,
          createdAt: identity.session.createdAt,
          expiresAt: identity.session.expiresAt,
          rotateCount: identity.session.rotateCount || 0,
        },
      },
      storage: storeInfo(),
    });
  });

  /* ── 登录设备列表 ─────────────────────────────────── */
  router.get('/api/me/devices', async (ctx) => {
    const identity = requireAuth(ctx);
    const devices = await listDevices(identity.user.id, identity.session.deviceId);
    return ok({
      devices,
      active: devices.filter((d) => !d.revoked).length,
      total: devices.length,
    });
  });

  /* ── 吊销某个设备 ─────────────────────────────────── */
  router.delete('/api/me/devices/:id', async (ctx) => {
    const identity = requireAuth(ctx);
    const { device, revokedSessions } = await revokeDevice(identity.user.id, ctx.params.id);
    await writeAudit({
      action: AUDIT_ACTIONS.SESSION_REVOKED,
      ctx,
      actor: identity.user,
      target: `device:${device.deviceId}`,
      message: `吊销设备「${device.name}」，同时失效 ${revokedSessions} 个会话`,
      meta: { revokedSessions, self: device.deviceId === identity.session.deviceId },
    });
    return ok({ revokedSessions, deviceId: device.deviceId }, '设备已下线');
  });

  /* ── 安全审计日志（自己的） ───────────────────────── */
  router.get('/api/me/audit-logs', async (ctx) => {
    const identity = requireAuth(ctx);
    const limit = V.intInRange(ctx.query.get('limit'), 'limit', { min: 1, max: 200, fallback: 50 });
    const offset = V.intInRange(ctx.query.get('offset'), 'offset', { min: 0, max: 10000, fallback: 0 });
    const actionFilter = ctx.query.get('action');
    const resultFilter = V.oneOf(ctx.query.get('result'), ['success', 'failure'], 'result', { fallback: null });

    let logs = await listAuditLogs({ actorId: identity.user.id, limit: 200, offset: 0 });
    if (actionFilter) logs = logs.filter((l) => l.action.startsWith(actionFilter));
    if (resultFilter) logs = logs.filter((l) => l.result === resultFilter);
    const total = logs.length;

    return ok({
      logs: logs.slice(offset, offset + limit).map(publicAuditLog),
      total,
      page: { limit, offset, hasMore: offset + limit < total },
    });
  });

  /* ── 安全总览：给安全记录页顶部用 ─────────────────── */
  router.get('/api/me/security-summary', async (ctx) => {
    const identity = requireAuth(ctx);
    const devices = await listDevices(identity.user.id, identity.session.deviceId);
    const logs = await listAuditLogs({ actorId: identity.user.id, limit: 200 });
    const failures = logs.filter((l) => l.result === 'failure');
    return ok({
      activeDevices: devices.filter((d) => !d.revoked).length,
      totalDevices: devices.length,
      myReminders: await db.reminders().count({ ownerId: identity.user.id }),
      auditTotal: logs.length,
      failureCount: failures.length,
      lastFailure: failures[0] || null,
      lastLogin: logs.find((l) => l.action === AUDIT_ACTIONS.LOGIN_SUCCESS) || null,
      riskTips: buildRiskTips({ user: identity.user, devices, failures }),
    });
  });

  /* ── 退出全部设备（安全记录页的兜底操作） ─────────── */
  router.post('/api/me/logout-all', async (ctx) => {
    const identity = requireAuth(ctx);
    const count = await revokeAllSessions(identity.user.id, '用户在安全记录页退出全部设备');
    await writeAudit({
      action: AUDIT_ACTIONS.LOGOUT_ALL,
      ctx,
      actor: identity.user,
      target: `user:${identity.user.id}`,
      message: `退出全部设备，吊销 ${count} 个会话`,
      meta: { revoked: count },
    });
    return ok({ revoked: count }, '已退出全部设备，请重新登录');
  });
}

/** 对外输出审计日志：不暴露 userAgent 全文与内部 deviceId，只留可读信息 */
export function publicAuditLog(log) {
  return {
    id: log.id,
    action: log.action,
    actionLabel: ACTION_LABELS[log.action] || log.action,
    result: log.result,
    message: log.message,
    target: log.target,
    ip: log.ip,
    deviceName: log.deviceName,
    createdAt: log.createdAt,
  };
}

export const ACTION_LABELS = {
  [AUDIT_ACTIONS.REGISTER]: '注册账号',
  [AUDIT_ACTIONS.LOGIN_SUCCESS]: '密码登录成功',
  [AUDIT_ACTIONS.LOGIN_FAILED]: '登录失败',
  [AUDIT_ACTIONS.LOGIN_LOCKED]: '登录被限流',
  [AUDIT_ACTIONS.LOGOUT]: '退出当前设备',
  [AUDIT_ACTIONS.LOGOUT_ALL]: '退出全部设备',
  [AUDIT_ACTIONS.TOKEN_REFRESH]: '会话续期',
  [AUDIT_ACTIONS.TOKEN_REUSE_DETECTED]: '令牌重放告警',
  [AUDIT_ACTIONS.SESSION_REVOKED]: '吊销设备',
  [AUDIT_ACTIONS.WECHAT_LOGIN]: '微信授权登录',
  [AUDIT_ACTIONS.WECHAT_LOGIN_FAILED]: '微信授权失败',
  [AUDIT_ACTIONS.PROFILE_READ]: '查看个人资料',
  [AUDIT_ACTIONS.REMINDER_CREATED]: '新增提醒',
  [AUDIT_ACTIONS.REMINDER_UPDATED]: '修改提醒',
  [AUDIT_ACTIONS.REMINDER_DELETED]: '删除提醒',
  [AUDIT_ACTIONS.REMINDER_ACCESS_DENIED]: '越权访问被拦',
  [AUDIT_ACTIONS.UPLOAD_CREATED]: '上传公告截图',
  [AUDIT_ACTIONS.ADMIN_USERS_LISTED]: '管理员查看用户',
  [AUDIT_ACTIONS.ADMIN_ROLE_CHANGED]: '管理员调整角色',
  [AUDIT_ACTIONS.ADMIN_AUDIT_READ]: '管理员查看审计',
  [AUDIT_ACTIONS.FORBIDDEN]: '权限不足被拦',
};

/** 按当前账号状态生成「安全建议」，让安全记录页不只是流水账 */
function buildRiskTips({ user, devices, failures }) {
  const tips = [];
  if (!user.wechatOpenId) {
    tips.push({ level: 'info', text: '尚未绑定微信，绑定后可在微信中一键登录。' });
  }
  if (!user.passwordHash) {
    tips.push({ level: 'info', text: '当前账号仅支持微信登录，建议设置密码作为备用登录方式。' });
  }
  const activeDevices = devices.filter((d) => !d.revoked);
  if (activeDevices.length > 3) {
    tips.push({ level: 'warn', text: `当前有 ${activeDevices.length} 台设备处于登录状态，建议核对其余设备。` });
  }
  const recentFailures = failures.filter(
    (f) => Date.now() - Date.parse(f.createdAt) < 24 * 60 * 60 * 1000
  );
  if (recentFailures.length >= 3) {
    tips.push({
      level: 'warn',
      text: `近 24 小时有 ${recentFailures.length} 次失败记录，若非本人操作建议立即改密并退出全部设备。`,
    });
  }
  if (tips.length === 0) {
    tips.push({ level: 'ok', text: '账号状态良好：无异常登录，登录设备数量正常。' });
  }
  return tips;
}
