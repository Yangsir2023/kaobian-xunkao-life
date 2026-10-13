/**
 * 安全记录套件：登录设备管理、审计日志口径、会话吊销即时生效
 */
import { suite, assert, assertEqual, TEST_PASSWORD } from '../helpers.mjs';

export function securitySuite({ admin, user, baseUrl }) {
  const s = suite('安全记录与设备');

  s.test('设备列表包含当前设备并标记', async () => {
    const res = await user.get('/api/me/devices');
    assertEqual(res.body.code, 0, '业务码');
    assert(res.body.data.devices.length >= 1, '至少一台设备');
    const current = res.body.data.devices.find((d) => d.current);
    assert(current, '应标记当前设备');
    assert(current.activeSessions >= 1, '当前设备应有活跃会话');
  });

  s.test('审计日志接口只返回本人的记录', async () => {
    const mine = await user.get('/api/me/audit-logs?limit=50');
    assertEqual(mine.body.code, 0, '业务码');
    assert(mine.body.data.logs.length > 0, '应有记录');
    assert(
      mine.body.data.logs.every((l) => l.ip && l.createdAt),
      '记录应含 IP 与时间'
    );
    assert(
      mine.body.data.logs.every((l) => l.actionLabel && l.actionLabel !== l.action),
      '应带中文动作标签',
    );
    assert(
      mine.body.data.logs.every((l) => l.userAgent === undefined),
      '不应输出完整 UA 原文',
    );
  });

  s.test('登录 / 刷新 / 业务操作都会被记录', async () => {
    // 触发一次刷新令牌轮换，验证续期行为也会留痕
    const refreshed = await user.post(
      '/api/auth/refresh',
      { refreshToken: user.state.refreshToken },
      { token: null }
    );
    assertEqual(refreshed.body.code, 0, '刷新应成功');
    user.setTokens(refreshed.body.data);

    // 访问一次个人资料，验证「读操作」同样留痕
    const profile = await user.get('/api/me');
    assertEqual(profile.body.code, 0, '个人资料可读');

    const logs = await user.get('/api/me/audit-logs?limit=100');
    const actions = logs.body.data.logs.map((l) => l.action);
    for (const expected of ['auth.login.success', 'auth.token.refresh', 'reminder.created', 'me.profile.read']) {
      assert(actions.includes(expected), `日志应包含 ${expected}`);
    }
  });

  s.test('安全总览返回风险提示与统计', async () => {
    const res = await user.get('/api/me/security-summary');
    assertEqual(res.body.code, 0, '业务码');
    assert(res.body.data.riskTips.length >= 1, '至少一条提示');
    assert(typeof res.body.data.activeDevices === 'number', '含在线设备数');
    assert(res.body.data.myReminders >= 1, '含提醒数');
  });

  s.test('吊销其他设备后，该设备的令牌立即失效', async () => {
    // 用第二个设备登录
    const second = await loginOnNewDevice(user, 'second-device-001');
    assert(second.accessToken, '第二设备应登录成功');

    const devices = await user.get('/api/me/devices');
    const other = devices.body.data.devices.find((d) => d.deviceId === 'second-device-001');
    assert(other, '应能识别第二台设备');

    const revoke = await user.del(`/api/me/devices/${other.id}`);
    assertEqual(revoke.body.code, 0, '吊销成功');
    assertEqual(revoke.body.data.revokedSessions, 1, '应吊销 1 个会话');

    const res = await fetch(`${baseUrl}/api/me`, {
      headers: { Authorization: `Bearer ${second.accessToken}` },
    });
    assertEqual(res.status, 401, '被吊销设备应立即失效');
  });

  s.test('吊销不存在的设备返回 404', async () => {
    const res = await user.del('/api/me/devices/dev_not_exist');
    assertEqual(res.status, 404, 'HTTP 状态');
    assertEqual(res.body.code, 1011, '错误码');
  });

  s.test('退出全部设备后所有会话失效', async () => {
    const temp = await loginOnNewDevice(user, 'temp-device-002');
    const all = await user.post('/api/me/logout-all');
    assertEqual(all.body.code, 0, '业务码');
    assert(all.body.data.revoked >= 2, '应吊销至少 2 个会话');

    const res = await fetch(`${baseUrl}/api/me`, { headers: { Authorization: `Bearer ${temp.accessToken}` } });
    assertEqual(res.status, 401, '全部退出后令牌失效');
  });

  s.test('重新登录后审计日志能看到退出记录', async () => {
    const login = await user.post('/api/auth/login', { username: 'security_user', password: TEST_PASSWORD });
    assertEqual(login.body.code, 0, '重新登录');
    user.setTokens(login.body.data);
    const logs = await user.get('/api/me/audit-logs?limit=50');
    const actions = logs.body.data.logs.map((l) => l.action);
    assert(actions.includes('auth.logout.all'), '应记录退出全部设备');
    assert(actions.includes('auth.session.revoked'), '应记录吊销设备');
  });

  s.test('管理员动作同样写审计（可追溯到具体操作人）', async () => {
    await admin.get('/api/admin/users?limit=5');
    const logs = await admin.get('/api/admin/audit-logs?limit=20&action=admin.');
    assert(logs.body.data.logs.length > 0, '应有管理员审计');
    assert(
      logs.body.data.logs.every((l) => l.actorName && l.actorRole),
      '应记录操作人姓名与角色'
    );
    assertEqual(logs.body.data.logs[0].actorRole, 'admin', '操作人角色');
  });

  return s;
}

async function loginOnNewDevice(client, deviceId) {
  const res = await client.post(
    '/api/auth/login',
    { username: 'security_user', password: TEST_PASSWORD },
    { deviceId, token: null }
  );
  if (res.body.code !== 0) throw new Error(`第二设备登录失败：${res.body.message}`);
  return res.body.data;
}
