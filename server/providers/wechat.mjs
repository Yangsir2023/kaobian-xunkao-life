/**
 * 微信授权登录 Provider（OAuth2 授权码模式，设计上对齐 OIDC 的 code flow）。
 *
 * 真实通道（配置了 WECHAT_APP_ID / WECHAT_APP_SECRET 时启用）：
 *   1. 生成授权 URL（state 防 CSRF，一次性、10 分钟过期）
 *   2. 用户授权后回调 /api/auth/wechat/callback?code&state
 *   3. 用 code 换 access_token + openid，再拉 userinfo
 *   4. 映射为统一用户档案（对齐 OIDC 的 sub / nickname / picture 语义）
 *
 * Mock 通道（未配置凭证时自动启用）：
 *   跳过微信服务器，用确定性哈希造一个 openid，把「授权 → 回调 → 换档案」
 *   的链路完整走一遍。界面会明确标注「模拟授权」，便于本地联调与自动化测试。
 *
 * 为什么不直接把 token 塞进回调 URL：会留在浏览器历史与日志里。
 * 这里改成「一次性票据（60 秒、单次使用）」，前端拿票据再换令牌。
 */
import crypto from 'node:crypto';
import { config } from '../config.mjs';
import { newId, sha256 } from '../lib/ids.mjs';
import { CODES, fail } from '../lib/errors.mjs';

const STATES = new Map();
const TICKETS = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;
const TICKET_TTL_MS = 60 * 1000;

function prune(map, ttl) {
  const now = Date.now();
  for (const [key, value] of map) {
    if (now - value.createdAt > ttl) map.delete(key);
  }
}

/* ───────────────────────── state（防 CSRF） ───────────────────────── */

export function createState({ redirectTo = null } = {}) {
  prune(STATES, STATE_TTL_MS);
  const state = newId('st') + crypto.randomBytes(6).toString('hex');
  STATES.set(state, { createdAt: Date.now(), redirectTo });
  return state;
}

export function consumeState(state) {
  prune(STATES, STATE_TTL_MS);
  const record = STATES.get(state);
  if (!record) throw fail(CODES.AUTH_STATE_INVALID, undefined, 400);
  STATES.delete(state); // 一次性
  return record;
}

/* ───────────────────────── 一次性登录票据 ───────────────────────── */

export function createLoginTicket({ userId, profile, openid }) {
  prune(TICKETS, TICKET_TTL_MS);
  const ticket = crypto.randomBytes(24).toString('base64url');
  TICKETS.set(ticket, { createdAt: Date.now(), userId, profile, openid });
  return ticket;
}

export function consumeLoginTicket(ticket) {
  prune(TICKETS, TICKET_TTL_MS);
  const record = TICKETS.get(ticket);
  if (!record) throw fail(CODES.AUTH_STATE_INVALID, '登录票据无效或已过期，请重新授权', 400);
  TICKETS.delete(ticket);
  return record;
}

/* ───────────────────────── Provider ───────────────────────── */

export const wechatMode = () => (config.wechat.mock ? 'mock' : 'real');

export function createAuthorizeUrl({ state, redirectUri = config.wechat.redirectUri }) {
  if (config.wechat.mock) {
    // Mock 通道：授权页由前端自己渲染，这里给出前端内部路由
    return `/#/wechat-authorize?state=${encodeURIComponent(state)}`;
  }
  const params = new URLSearchParams({
    appid: config.wechat.appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.wechat.scope,
    state,
  });
  return `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`;
}

/** 用授权码换取用户档案；返回统一结构，屏蔽微信与 OIDC 的字段差异 */
export async function exchangeCodeForProfile(code) {
  if (config.wechat.mock) {
    throw fail(CODES.AUTH_WECHAT_FAILED, 'Mock 通道不提供授权码换取能力', 400);
  }

  const tokenUrl = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
  tokenUrl.searchParams.set('appid', config.wechat.appId);
  tokenUrl.searchParams.set('secret', config.wechat.appSecret);
  tokenUrl.searchParams.set('code', code);
  tokenUrl.searchParams.set('grant_type', 'authorization_code');

  const tokenRes = await fetchJson(tokenUrl);
  if (!tokenRes.openid) {
    throw fail(CODES.AUTH_WECHAT_FAILED, `微信未返回 openid（errcode=${tokenRes.errcode} ${tokenRes.errmsg || ''}）`, 401);
  }

  let profile = { nickname: null, avatar: null, unionid: tokenRes.unionid || null };
  try {
    const infoUrl = new URL('https://api.weixin.qq.com/sns/userinfo');
    infoUrl.searchParams.set('access_token', tokenRes.access_token);
    infoUrl.searchParams.set('openid', tokenRes.openid);
    infoUrl.searchParams.set('lang', 'zh_CN');
    const info = await fetchJson(infoUrl);
    if (!info.errcode) {
      profile = { nickname: info.nickname || null, avatar: info.headimgurl || null, unionid: info.unionid || tokenRes.unionid || null };
    }
  } catch {
    // userinfo 失败不阻断登录，昵称头像可留空
  }

  return { openid: tokenRes.openid, ...profile, provider: 'wechat' };
}

/**
 * Mock 档案：openid 由「授权会话标识」确定性推导，
 * 同一会话重复授权得到同一个账号，便于测试与复现。
 */
export function buildMockProfile(seed = 'demo') {
  const digest = sha256(`mock-wechat:${seed}`).slice(0, 24);
  const suffixes = ['巡考小助手', '备考中', '岸上见', '追光者'];
  const index = Number.parseInt(digest.slice(0, 2), 16) % suffixes.length;
  return {
    openid: `mock_openid_${digest}`,
    unionid: `mock_unionid_${sha256(`union:${seed}`).slice(0, 24)}`,
    nickname: `微信用户·${suffixes[index]}`,
    avatar: null,
    provider: 'wechat',
    mock: true,
  };
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw fail(CODES.AUTH_WECHAT_FAILED, `微信接口返回 HTTP ${res.status}`, 502);
    return await res.json();
  } catch (err) {
    if (err.code === CODES.AUTH_WECHAT_FAILED) throw err;
    throw fail(CODES.AUTH_WECHAT_FAILED, `无法访问微信接口：${err.message}`, 502);
  } finally {
    clearTimeout(timer);
  }
}

/** 测试辅助：清空内存中的 state / ticket */
export function resetAuthCaches() {
  STATES.clear();
  TICKETS.clear();
}
