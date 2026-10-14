/**
 * 鉴权套件：注册 / 登录 / 令牌 / 刷新轮换与重放 / 退出吊销 / 限流 / 微信授权链路
 */
import { suite, assert, assertEqual, assertMatch, TEST_PASSWORD, loadLimiters } from '../helpers.mjs';

export function authSuite({ client, baseUrl }) {
  const s = suite('鉴权与令牌');

  s.test('第一个注册账号自动成为管理员，并返回双令牌', async () => {
    const { resetAllLimiters } = await loadLimiters();
    resetAllLimiters();
    const res = await client.post('/api/auth/register', {
      username: 'root_admin',
      password: TEST_PASSWORD,
      displayName: '首位用户',
    });
    assertEqual(res.status, 200, 'HTTP 状态');
    assertEqual(res.body.code, 0, '业务码');
    assertEqual(res.body.data.user.role, 'admin', '首个用户角色');
    assertMatch(res.body.data.accessToken, /^[\w-]+\.[\w-]+\.[\w-]+$/, 'JWT 三段式');
    assert(res.body.data.refreshToken.length >= 40, '刷新令牌长度应足够');
    assertEqual(res.body.data.user.passwordHash, undefined, '响应中不应出现口令哈希');
    client.setTokens(res.body.data);
  });

  s.test('弱口令被拒绝（返回 1004）', async () => {
    const res = await client.post('/api/auth/register', { username: 'weakuser', password: '12345678' });
    assertEqual(res.body.code, 1004, '弱口令错误码');
  });

  s.test('用户名与密码同名的口令被拒绝', async () => {
    const res = await client.post('/api/auth/register', { username: 'huangfeihong', password: 'huangfeihong1' });
    assertEqual(res.body.code, 1004, '含用户名口令应被拒');
  });

  s.test('重复用户名返回 1002', async () => {
    const res = await client.post('/api/auth/register', { username: 'root_admin', password: TEST_PASSWORD });
    assertEqual(res.body.code, 1002, '重复用户名错误码');
  });

  s.test('密码登录成功并签发新会话', async () => {
    const res = await client.post('/api/auth/login', { username: 'root_admin', password: TEST_PASSWORD });
    assertEqual(res.body.code, 0, '登录业务码');
    assert(res.body.data.sessionId, '应返回会话 ID');
    assertEqual(res.body.data.user.role, 'admin');
  });

  s.test('错误密码与不存在用户返回同一错误码（防用户名枚举）', async () => {
    const wrong = await client.post('/api/auth/login', { username: 'root_admin', password: 'WrongPass123' });
    const ghost = await client.post('/api/auth/login', { username: 'not_exist_user', password: 'WrongPass123' });
    assertEqual(wrong.body.code, 1003, '错误密码');
    assertEqual(ghost.body.code, 1003, '不存在用户必须同样返回 1003');
    assertEqual(wrong.body.message, ghost.body.message, '提示信息需一致');
  });

  s.test('篡改后的令牌被拒绝（1005）', async () => {
    const valid = client.state.accessToken;
    const tampered = `${valid.slice(0, -4)}AAAA`;
    const res = await client.get('/api/me', { token: tampered });
    assertEqual(res.status, 401, 'HTTP 状态');
    assertEqual(res.body.code, 1005, '错误码');
  });

  s.test('无令牌视为游客，访问受保护接口返回 1005', async () => {
    const res = await client.get('/api/reminders?scope=mine', { token: null });
    assertEqual(res.body.code, 1005, '未登录错误码');
  });

  s.test('刷新令牌轮换：旧令牌用完即废，且旧令牌重放会吊销整个令牌族', async () => {
    const login = await client.post('/api/auth/login', { username: 'root_admin', password: TEST_PASSWORD });
    const firstRefresh = login.body.data.refreshToken;
    assert(firstRefresh, '应拿到刷新令牌');

    const rotated = await client.post('/api/auth/refresh', { refreshToken: firstRefresh }, { token: null });
    assertEqual(rotated.body.code, 0, '首次刷新应成功');
    assert(rotated.body.data.refreshToken !== firstRefresh, '刷新后令牌必须变化（轮换）');
    assert(rotated.body.data.sessionId && rotated.body.data.sessionId !== login.body.data.sessionId,
      '轮换会签发新会话行（旧行保留为已吊销，用于重放检测）');
    assertEqual(rotated.body.data.user.id, login.body.data.user.id, '用户身份应保持一致');

    const replay = await client.post('/api/auth/refresh', { refreshToken: firstRefresh }, { token: null });
    assertEqual(replay.body.code, 1007, '重放应被识别');

    const afterReplay = await client.post(
      '/api/auth/refresh',
      { refreshToken: rotated.body.data.refreshToken },
      { token: null }
    );
    assertEqual(afterReplay.body.code, 1006, '整族吊销后新令牌也应失效');
  });

  s.test('退出登录后访问令牌立即失效（会话黑名单校验）', async () => {
    const login = await client.post('/api/auth/login', { username: 'root_admin', password: TEST_PASSWORD });
    const tempToken = login.body.data.accessToken;
    const before = await client.get('/api/me', { token: tempToken });
    assertEqual(before.body.code, 0, '退出前应可访问');

    const logout = await client.post('/api/auth/logout', undefined, { token: tempToken });
    assertEqual(logout.body.code, 0, '退出成功');

    const after = await client.get('/api/me', { token: tempToken });
    assertEqual(after.status, 401, '退出后 HTTP 状态');
    assertEqual(after.body.code, 1006, '退出后错误码（会话已失效）');
  });

  s.test('登录限流：连续失败达到阈值后返回 8001', async () => {
    const { resetAllLimiters } = await loadLimiters();
    resetAllLimiters();
    let limited = null;
    for (let i = 0; i < 12; i += 1) {
      const res = await client.post(
        '/api/auth/login',
        { username: 'root_admin', password: 'DefinitelyWrong99' },
        { token: null, deviceId: `flood-${i}` }
      );
      if (res.body.code === 8001) {
        limited = res;
        break;
      }
    }
    assert(limited, '应触发限流');
    assertEqual(limited.status, 429, '限流 HTTP 状态');
    resetAllLimiters();
  });

  s.test('微信授权 Mock 链路：url → 模拟授权 → 票据 → 令牌', async () => {
    const urlRes = await client.get('/api/auth/wechat/url', { token: null });
    assertEqual(urlRes.body.code, 0, '获取授权地址');
    assertEqual(urlRes.body.data.mode, 'mock', '未配置 AppID 时应为 mock 模式');
    const { state } = urlRes.body.data;

    const authorize = await client.post(
      '/api/auth/wechat/mock-authorize',
      { state, demoAccount: 'wechat-tester' },
      { token: null }
    );
    assertEqual(authorize.body.code, 0, '模拟授权');
    assert(authorize.body.data.ticket, '应返回一次性票据');

    const exchange = await client.post('/api/auth/wechat/ticket', { ticket: authorize.body.data.ticket }, { token: null });
    assertEqual(exchange.body.code, 0, '票据换令牌');
    assertEqual(exchange.body.data.user.bindings.wechat, true, '应绑定微信');
    assert(exchange.body.data.accessToken, '应签发访问令牌');

    // 票据单次有效
    const reuse = await client.post('/api/auth/wechat/ticket', { ticket: authorize.body.data.ticket }, { token: null });
    assertEqual(reuse.body.code, 1008, '票据不可重复使用');
    return exchange.body.data;
  });

  s.test('微信 Mock：同一账号重复授权归并到同一本地用户', async () => {
    const urlRes = await client.get('/api/auth/wechat/url', { token: null });
    const authorize = await client.post(
      '/api/auth/wechat/mock-authorize',
      { state: urlRes.body.data.state, demoAccount: 'wechat-tester' },
      { token: null }
    );
    const exchange = await client.post('/api/auth/wechat/ticket', { ticket: authorize.body.data.ticket }, { token: null });
    assertEqual(exchange.body.code, 0, '第二次授权');
    assertEqual(exchange.body.data.user.username.startsWith('wx_'), true, '微信账号命名规则');
  });

  s.test('state 一次性：重复使用同一 state 被拒绝', async () => {
    const urlRes = await client.get('/api/auth/wechat/url', { token: null });
    const state = urlRes.body.data.state;
    await client.post('/api/auth/wechat/mock-authorize', { state, demoAccount: 'x' }, { token: null });
    const replay = await client.post('/api/auth/wechat/mock-authorize', { state, demoAccount: 'x' }, { token: null });
    assertEqual(replay.body.code, 1008, 'state 重放应被拒');
  });

  s.test('会话信息接口在未登录时正确降级为游客', async () => {
    const res = await client.get('/api/auth/session', { token: null });
    assertEqual(res.body.code, 0, '游客也应正常返回');
    assertEqual(res.body.data.authenticated, false, 'authenticated 标记');
    assertEqual(res.body.data.role, 'guest', '角色');
  });

  return s;
}
