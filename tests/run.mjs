#!/usr/bin/env node
/**
 * 零依赖测试运行器。
 *
 * 设计：在进程内拉起真实 HTTP 服务（临时数据目录 + 随机端口），
 * 全部用例走真实网络栈与真实存储，不做任何 mock —— 保证「接口层全绿即真实可用」。
 *
 * 用法：
 *   node tests/run.mjs             # 跑全部套件
 *   node tests/run.mjs --json      # 额外输出 JSON 结果（供验收脚本复用）
 */
import {
  startTestServer,
  stopTestServer,
  makeClient,
  TEST_PASSWORD,
  results,
  loadLimiters,
} from './helpers.mjs';
import { authSuite } from './suites/auth.mjs';
import { rbacSuite } from './suites/rbac.mjs';
import { reminderSuite } from './suites/reminders.mjs';
import { securitySuite } from './suites/security.mjs';

const C = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  green: '\u001b[32m',
  red: '\u001b[31m',
  cyan: '\u001b[36m',
  bold: '\u001b[1m',
};

async function main() {
  const jsonMode = process.argv.includes('--json');
  const started = Date.now();
  const { baseUrl, seedResult } = await startTestServer();

  if (!jsonMode) {
    console.log(`\n${C.bold}巡考日历 · 测试套件${C.reset}`);
    console.log(`${C.dim}服务地址 ${baseUrl} · 公共节点种子 ${seedResult.inserted} 条${C.reset}\n`);
  }

  /* ── 准备客户端：管理员 / 普通用户 / 另一普通用户 / 游客 ── */
  const { resetAllLimiters } = await loadLimiters();
  resetAllLimiters();

  const admin = makeClient(baseUrl);
  const user = makeClient(baseUrl);
  const alice = makeClient(baseUrl);
  const bob = makeClient(baseUrl);
  const guest = makeClient(baseUrl);
  guest.clear();

  /**
   * 执行一个套件。
   * 鉴权套件必须最先执行：它的首个用例是「第一个注册账号自动成为管理员」，
   * 因此它必须发生在这个全新数据库的第一次注册上，其他账号要在它之后才创建。
   */
  async function runSuite(s, index, total) {
    if (!jsonMode) console.log(`${C.cyan}▸ ${s.name}${index ? '' : ''}${C.reset}`);
    for (const testCase of s.cases) {
      const caseStart = Date.now();
      try {
        await testCase.fn();
        results.passed += 1;
        results.cases.push({ suite: s.name, title: testCase.title, ok: true, ms: Date.now() - caseStart });
        if (!jsonMode) {
          console.log(`  ${C.green}✓${C.reset} ${testCase.title} ${C.dim}${Date.now() - caseStart}ms${C.reset}`);
        }
      } catch (err) {
        results.failed += 1;
        results.cases.push({
          suite: s.name,
          title: testCase.title,
          ok: false,
          ms: Date.now() - caseStart,
          error: err.message,
        });
        console.log(`  ${C.red}✗${C.reset} ${testCase.title}`);
        console.log(`    ${C.red}${err.message}${C.reset}`);
      }
    }
    if (!jsonMode) console.log('');
  }

  /* ── 1) 鉴权套件（含首位管理员注册） ── */
  await runSuite(authSuite({ client: admin, baseUrl }), 0, 4);

  /* ── 2) 其余角色账号 ── */
  resetAllLimiters();
  const userReg = await user.post('/api/auth/register', {
    username: 'security_user',
    password: TEST_PASSWORD,
    displayName: '安全记录测试账号',
  });
  user.setTokens(userReg.body.data);
  const userLogin = await user.post('/api/auth/login', { username: 'security_user', password: TEST_PASSWORD });
  if (userLogin.body.code === 0) user.setTokens(userLogin.body.data);

  const aliceReg = await alice.post('/api/auth/register', {
    username: 'rbac_alice',
    password: TEST_PASSWORD,
    displayName: 'Alice',
  });
  alice.setTokens(aliceReg.body.data);

  const bobReg = await bob.post('/api/auth/register', {
    username: 'rbac_bob',
    password: TEST_PASSWORD,
    displayName: 'Bob',
  });
  bob.setTokens(bobReg.body.data);
  if ([userReg, aliceReg, bobReg].some((r) => r.body.code !== 0)) {
    console.error('测试账号初始化失败：', userReg.body, aliceReg.body, bobReg.body);
    process.exit(1);
  }
  if (!admin.state.accessToken) {
    console.error('管理员会话未建立，后续套件无法执行');
    process.exit(1);
  }
  resetAllLimiters();

  /* ── 3) 其余套件 ── */
  await runSuite(reminderSuite({ admin, user, baseUrl }), 1, 4);
  await runSuite(rbacSuite({ admin, alice, bob, guest }), 2, 4);
  await runSuite(securitySuite({ admin, user, baseUrl }), 3, 4);

  const duration = ((Date.now() - started) / 1000).toFixed(2);
  const total = results.passed + results.failed;
  const rate = total ? ((results.passed / total) * 100).toFixed(1) : '0.0';

  if (!jsonMode) {
    console.log(`${C.bold}结果：${results.passed}/${total} 通过（${rate}%），耗时 ${duration}s${C.reset}`);
    console.log(results.failed === 0 ? `${C.green}GATE PASS${C.reset}` : `${C.red}GATE FAIL${C.reset}`);
  }

  await stopTestServer();

  if (jsonMode) {
    console.log(
      JSON.stringify({
        passed: results.passed,
        failed: results.failed,
        total,
        rate: Number(rate),
        durationSeconds: Number(duration),
        cases: results.cases,
      })
    );
  }

  process.exit(results.failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('测试运行器异常：', err);
  await stopTestServer();
  process.exit(1);
});
