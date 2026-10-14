/**
 * RBAC 套件：游客 / 用户 / 管理员三角色的权限边界与越权拦截
 */
import { suite, assert, assertEqual } from '../helpers.mjs';

export function rbacSuite({ admin, alice, bob, guest }) {
  const s = suite('RBAC 权限边界');
  let aliceReminderId = null;

  s.test('游客可读公共接口，但写操作被拒（401）', async () => {
    const catalog = await guest.get('/api/catalog/categories');
    assertEqual(catalog.body.code, 0, '分类目录游客可读');

    const create = await guest.post('/api/reminders', {
      title: '游客尝试创建提醒',
      category: 'guokao',
      deadline: '2027-01-01',
    });
    assertEqual(create.status, 401, '游客写操作 HTTP 状态');
    assertEqual(create.body.code, 1005, '游客写操作错误码');
  });

  s.test('普通用户可管理自己的提醒', async () => {
    const res = await alice.post('/api/reminders', {
      title: 'alice 的省考提醒',
      category: 'shengkao',
      deadline: '2027-01-15',
    });
    assertEqual(res.body.code, 0, '创建结果');
    aliceReminderId = res.body.data.reminder.id;
  });

  s.test('跨用户读取他人提醒被拦截并写审计', async () => {
    const res = await bob.get(`/api/reminders/${aliceReminderId}`);
    assertEqual(res.status, 403, 'HTTP 状态');
    assertEqual(res.body.code, 4002, '越权读取错误码');

    const logs = await alice.adminAuditLogs ? null : null;
    const audit = await dbLogs(admin, 'reminder.access_denied');
    assert(
      audit.some((log) => log.target === `reminder:${aliceReminderId}`),
      '应写入越权访问审计'
    );
  });

  s.test('跨用户修改他人提醒被拦截（403）', async () => {
    const res = await bob.patch(`/api/reminders/${aliceReminderId}`, { title: 'bob 试图改 alice 的提醒' });
    assertEqual(res.status, 403, 'HTTP 状态');
    assertEqual(res.body.code, 4002, '越权修改错误码');
  });

  s.test('跨用户删除他人提醒被拦截（403），且数据仍在', async () => {
    const del = await bob.del(`/api/reminders/${aliceReminderId}`);
    assertEqual(del.status, 403, '删除被拦截');
    const still = await alice.get(`/api/reminders/${aliceReminderId}`);
    assertEqual(still.body.code, 0, '原数据未被破坏');
  });

  s.test('普通用户看不到「全部提醒」作用域（4001）', async () => {
    const res = await alice.get('/api/reminders?scope=all');
    assertEqual(res.status, 403, 'HTTP 状态');
    assertEqual(res.body.code, 4001, '需要管理员角色');
  });

  s.test('普通用户访问管理接口被拦截（4001）', async () => {
    for (const path of ['/api/admin/users', '/api/admin/audit-logs', '/api/admin/overview']) {
      const res = await alice.get(path);
      assertEqual(res.status, 403, `${path} 应 403`);
      assertEqual(res.body.code, 4001, `${path} 错误码`);
    }
  });

  s.test('管理员可读全量与用户列表', async () => {
    const users = await admin.get('/api/admin/users?limit=20');
    assertEqual(users.body.code, 0, '用户列表');
    assert(users.body.data.users.length >= 3, '应至少有 3 个用户');
    assert(users.body.data.users.every((u) => !('passwordHash' in u)), '不得输出口令哈希');

    const overview = await admin.get('/api/admin/overview');
    assertEqual(overview.body.data.storage.driver, 'local', '测试环境驱动');
    assert(overview.body.data.users.total >= 3, '用户统计');
  });

  s.test('管理员可读全量审计日志并支持失败筛选', async () => {
    const all = await admin.get('/api/admin/audit-logs?limit=50');
    assertEqual(all.body.code, 0, '全量审计');
    assert(all.body.data.logs.length > 0, '应有审计记录');

    const failures = await admin.get('/api/admin/audit-logs?result=failure');
    assert(failures.body.data.logs.every((l) => l.result === 'failure'), '失败筛选生效');
  });

  s.test('管理员不能降低自己的角色（防锁死）', async () => {
    const me = await admin.get('/api/me');
    const res = await admin.patch(`/api/admin/users/${me.body.data.user.id}/role`, { role: 'user' });
    assertEqual(res.status, 400, 'HTTP 状态');
    assertEqual(res.body.code, 4001, '自我保护错误码');
  });

  s.test('角色变更为 guest 后，该用户既有会话被吊销', async () => {
    const bobMe = await bob.get('/api/me');
    assertEqual(bobMe.body.code, 0, '变更前可访问');

    const change = await admin.patch(`/api/admin/users/${bobMe.body.data.user.id}/role`, { role: 'guest' });
    assertEqual(change.body.code, 0, '角色变更成功');
    assertEqual(change.body.data.user.role, 'guest', '角色已更新');

    const after = await bob.get('/api/me');
    assertEqual(after.status, 401, '会话应被吊销');
  });

  s.test('恢复角色后重新登录可正常使用', async () => {
    const bobMe = await admin.get('/api/admin/users');
    const bobUser = bobMe.body.data.users.find((u) => u.username === 'rbac_bob');
    await admin.patch(`/api/admin/users/${bobUser.id}/role`, { role: 'user' });
    const login = await bob.post('/api/auth/login', { username: 'rbac_bob', password: 'Xunkao2026abc' });
    assertEqual(login.body.code, 0, '重新登录');
    bob.setTokens(login.body.data);
    const me = await bob.get('/api/me');
    assertEqual(me.body.code, 0, '恢复后可访问');
  });

  return s;
}

async function dbLogs(admin, actionPrefix) {
  const res = await admin.get(`/api/admin/audit-logs?limit=100&action=${actionPrefix}`);
  return res.body?.data?.logs || [];
}
