/**
 * 测试基础设施：临时数据目录 + 进程内启动服务 + 精简断言库。
 * 不引入 jest/vitest —— 用 node:test 风格的自研 runner，保持零依赖。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const results = {
  passed: 0,
  failed: 0,
  cases: [],
};

export function suite(name) {
  return {
    name,
    cases: [],
    test(title, fn) {
      this.cases.push({ title, fn });
      return this;
    },
  };
}

/** 断言失败即抛错，由 runner 捕获并标记该用例失败 */
export function assert(condition, message) {
  if (!condition) throw new Error(message || '断言失败');
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || '值不相等'}：期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
  }
}

export function assertMatch(value, regex, message) {
  if (!regex.test(String(value))) {
    throw new Error(`${message || '格式不匹配'}：${JSON.stringify(value)} 不匹配 ${regex}`);
  }
}

export function assertIncludes(haystack, needle, message) {
  const text = typeof haystack === 'string' ? haystack : JSON.stringify(haystack);
  if (!text.includes(needle)) {
    throw new Error(`${message || '未包含期望内容'}：${text.slice(0, 200)} 中找不到 ${needle}`);
  }
}

export async function assertThrows(fn, matcher, message) {
  try {
    await fn();
  } catch (err) {
    if (matcher && !matcher(err)) {
      throw new Error(`${message || '异常不符合预期'}：${err.message}`);
    }
    return err;
  }
  throw new Error(`${message || '期望抛出异常但未抛出'}`);
}

/* ── 服务启动 ── */

let started = null;

export async function startTestServer() {
  if (started) return started;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xunkao-test-'));
  process.env.NODE_ENV = 'test';
  process.env.DB_DRIVER = 'local';
  process.env.DATA_DIR = tempDir;
  process.env.JWT_SECRET = 'test-secret-please-ignore-this-is-only-for-tests-0123456789';
  process.env.ACCESS_TOKEN_TTL = '900';
  process.env.REFRESH_TOKEN_TTL = '2592000';
  process.env.HOST = '127.0.0.1';
  process.env.PORT = '0';
  process.env.WECHAT_APP_ID = '';
  process.env.WECHAT_APP_SECRET = '';

  const { buildServer } = await import('../server/index.mjs');
  const { server } = await buildServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // 导入公共节点，让验收脚本面向与线上一致的初始数据
  const { db } = await import('../server/store/index.mjs');
  const { importOfficialNodes } = await import('../server/official-nodes.mjs');
  const { importPositionSeeds } = await import('../server/position-nodes.mjs');
  const { newId, nowIso } = await import('../server/lib/ids.mjs');
  const seedResult = await importOfficialNodes({ db, newId, nowIso });
  const positionSeedResult = await importPositionSeeds({ db, newId, nowIso });

  started = { server, baseUrl, tempDir, port, seedResult, positionSeedResult };
  return started;
}

export async function stopTestServer() {
  if (!started) return;
  await new Promise((resolve) => started.server.close(resolve));
  try {
    fs.rmSync(started.tempDir, { recursive: true, force: true });
  } catch {
    /* Windows 下文件句柄可能延迟释放，忽略 */
  }
  started = null;
}

/* ── HTTP 客户端 ── */

export function makeClient(baseUrl) {
  const state = { accessToken: null, refreshToken: null, deviceId: `test-${Math.random().toString(36).slice(2, 10)}` };

  async function call(pathname, { method = 'GET', body, token, deviceId, headers = {} } = {}) {
    const finalHeaders = {
      'Content-Type': 'application/json',
      'X-Device-Id': deviceId || state.deviceId,
      ...headers,
    };
    const auth = token === undefined ? state.accessToken : token;
    if (auth) finalHeaders.Authorization = `Bearer ${auth}`;

    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: response.status, body: json, headers: response.headers };
  }

  return {
    state,
    get: (p, options) => call(p, { ...options, method: 'GET' }),
    post: (p, body, options) => call(p, { ...options, method: 'POST', body }),
    patch: (p, body, options) => call(p, { ...options, method: 'PATCH', body }),
    del: (p, options) => call(p, { ...options, method: 'DELETE' }),
    setTokens(data) {
      state.accessToken = data?.accessToken || null;
      state.refreshToken = data?.refreshToken || null;
    },
    clear() {
      state.accessToken = null;
      state.refreshToken = null;
    },
  };
}

export const TEST_PASSWORD = 'Xunkao2026abc';

/** 生成一张合法的最小 PNG（1×1）用于上传用例 */
export const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

export async function loadLimiters() {
  const mod = await import('../server/lib/ratelimit.mjs');
  return mod;
}
