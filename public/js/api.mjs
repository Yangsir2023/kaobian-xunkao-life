/**
 * API 客户端。
 * - 统一拆包 ApiResponse{code,message,data}，非 0 一律抛 ApiError
 * - 401（令牌无效/过期）自动用刷新令牌续期一次，并发请求共享同一次刷新
 * - 刷新也失败 → 清空会话并广播，由 UI 引导重新登录
 */
import { session, deviceId } from './session.mjs';

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message || '请求失败');
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
  get isAuthError() {
    return this.status === 401;
  }
  get isForbidden() {
    return this.status === 403;
  }
}

const AUTH_EXPIRED_CODES = new Set([1005, 1006, 1007, 1010]);

let refreshing = null;
const unauthorizedHandlers = new Set();

export function onUnauthorized(fn) {
  unauthorizedHandlers.add(fn);
  return () => unauthorizedHandlers.delete(fn);
}

function notifyUnauthorized(reason) {
  session.clear();
  for (const fn of unauthorizedHandlers) {
    try {
      fn(reason);
    } catch (err) {
      console.error('[api] unauthorized handler error', err);
    }
  }
}

function deviceNameGuess() {
  const ua = navigator.userAgent;
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const browser = /Edg/.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : 'Safari';
  if (/iPhone|iPad|iPod/.test(ua)) return `iPhone · ${browser}`;
  if (/Android/.test(ua)) return `Android 手机 · ${browser}`;
  if (/Mac OS X/.test(ua)) return `macOS 电脑 · ${browser}`;
  if (/Windows/.test(ua)) return `Windows 电脑 · ${browser}`;
  return `${isMobile ? '移动设备' : '电脑'} · ${browser}`;
}

async function rawRequest(path, { method = 'GET', body, auth = true, timeoutMs = 15000 } = {}) {
  const headers = {
    Accept: 'application/json',
    'X-Device-Id': deviceId(),
    // 设备名含中文/全角符号，HTTP 头只允许 Latin-1 字节串，
    // 必须 encodeURIComponent 后再发，否则 fetch 会直接抛 TypeError。
    'X-Device-Name': encodeURIComponent(deviceNameGuess().slice(0, 60)),
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && session.accessToken) {
    // 三通道并行下发，服务端会取第一个能被验过的：
    //   1. Authorization     —— 标准做法，常规部署走它
    //   2. X-Access-Token    —— 代理改写 Authorization 时的备选
    //   3. xunkao_token Cookie —— 由 session.mjs 写入，部分托管平台的代理
    //      既不转发 Authorization 也不转发自定义头，只有它和查询串能到达应用
    headers.Authorization = `Bearer ${session.accessToken}`;
    headers['X-Access-Token'] = session.accessToken;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw new ApiError(-1, err.name === 'AbortError' ? '请求超时，请检查网络后重试' : '网络异常，无法连接服务', 0);
  }
  clearTimeout(timer);

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError(-2, `服务端返回了非 JSON 响应（HTTP ${response.status}）`, response.status);
    }
  }

  if (!response.ok) {
    const code = payload?.code ?? -3;
    throw new ApiError(code, payload?.message || `请求失败（HTTP ${response.status}）`, response.status);
  }
  if (payload && payload.code !== 0) {
    throw new ApiError(payload.code, payload.message, response.status);
  }
  return payload?.data ?? null;
}

async function tryRefresh() {
  if (!session.refreshToken) return false;
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const data = await rawRequest('/api/auth/refresh', {
        method: 'POST',
        body: { refreshToken: session.refreshToken },
        auth: false,
      });
      session.set(data);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

export async function request(path, options = {}) {
  const { auth = true, retryOnAuth = true } = options;
  try {
    return await rawRequest(path, options);
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    const shouldRefresh =
      auth && retryOnAuth && err.status === 401 && session.refreshToken && AUTH_EXPIRED_CODES.has(err.code);
    if (shouldRefresh) {
      const refreshed = await tryRefresh();
      if (refreshed) return rawRequest(path, { ...options, retryOnAuth: false });
    }
    if (err.status === 401) notifyUnauthorized(err.message);
    throw err;
  }
}

/* ── 具体接口封装（页面只调用这一层，不拼字符串） ── */

export const api = {
  health: () => request('/api/health', { auth: false }),
  meta: () => request('/api/meta', { auth: false }),
  /**
   * 读取当前会话。
   * 必须带令牌（auth 默认 true）——否则刷新页面时永远读不到身份、直接被判未登录；
   * 同时关掉自动刷新重试，避免启动阶段因为一个过期令牌白跑一轮续期。
   */
  session: () => request('/api/auth/session', { retryOnAuth: false }),

  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload, auth: false }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  logoutAll: () => request('/api/auth/logout-all', { method: 'POST' }),

  wechatUrl: (redirectTo) =>
    request(`/api/auth/wechat/url${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`, {
      auth: false,
    }),
  wechatMockAuthorize: (payload) =>
    request('/api/auth/wechat/mock-authorize', { method: 'POST', body: payload, auth: false }),
  wechatTicket: (ticket) =>
    request('/api/auth/wechat/ticket', { method: 'POST', body: { ticket }, auth: false }),

  categories: () => request('/api/catalog/categories', { auth: false }),
  /** 分类详情（今年公告 / 明年预测 / 户籍口径 / 历年公告 / 岗位深链） */
  categoryDetail: (key) => request(`/api/categories/${encodeURIComponent(key)}/detail`, { auth: false }),
  reminders: (query = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params.set(key, value);
    }
    const qs = params.toString();
    return request(`/api/reminders${qs ? `?${qs}` : ''}`);
  },
  reminder: (id) => request(`/api/reminders/${id}`),
  createReminder: (payload) => request('/api/reminders', { method: 'POST', body: payload }),
  updateReminder: (id, payload) => request(`/api/reminders/${id}`, { method: 'PATCH', body: payload }),
  deleteReminder: (id) => request(`/api/reminders/${id}`, { method: 'DELETE' }),
  cloneReminder: (id) => request(`/api/reminders/${id}/clone`, { method: 'POST' }),
  summary: () => request('/api/reminders/stats/summary'),

  /* ── 岗位库（留学生友好岗位） ── */
  positionCatalogs: () => request('/api/positions/catalogs', { auth: false }),
  positionPolicies: () => request('/api/positions/policies', { auth: false }),
  positions: (query = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params.set(key, value);
    }
    const qs = params.toString();
    // 默认带令牌：登录用户要能看到自己录入的岗位；游客无令牌时服务端按公共岗位返回
    return request(`/api/positions${qs ? `?${qs}` : ''}`);
  },
  position: (id) => request(`/api/positions/${id}`),
  createPosition: (payload) => request('/api/positions', { method: 'POST', body: payload }),
  updatePosition: (id, payload) => request(`/api/positions/${id}`, { method: 'PATCH', body: payload }),
  deletePosition: (id) => request(`/api/positions/${id}`, { method: 'DELETE' }),
  importPositions: (positions) => request('/api/positions/import', { method: 'POST', body: { positions } }),
  positionSummary: () => request('/api/positions/stats/summary', { auth: false }),


  me: () => request('/api/me'),
  devices: () => request('/api/me/devices'),
  revokeDevice: (id) => request(`/api/me/devices/${id}`, { method: 'DELETE' }),
  auditLogs: (query = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return request(`/api/me/audit-logs${qs ? `?${qs}` : ''}`);
  },
  securitySummary: () => request('/api/me/security-summary'),

  uploadConfig: () => request('/api/uploads/config'),
  upload: (payload) => request('/api/uploads', { method: 'POST', body: payload, timeoutMs: 30000 }),

  adminOverview: () => request('/api/admin/overview'),
  adminUsers: (query = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    const qs = params.toString();
    return request(`/api/admin/users${qs ? `?${qs}` : ''}`);
  },
  adminSetRole: (id, role) => request(`/api/admin/users/${id}/role`, { method: 'PATCH', body: { role } }),
  adminSetStatus: (id, status) => request(`/api/admin/users/${id}/status`, { method: 'PATCH', body: { status } }),
  adminAuditLogs: (query = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    const qs = params.toString();
    return request(`/api/admin/audit-logs${qs ? `?${qs}` : ''}`);
  },
};
