/**
 * 会话管理：令牌存取、自动刷新、身份状态订阅。
 *
 * 安全取舍（README 中有说明）：
 * - 令牌存 localStorage：这是移动端 Web 的常见做法，代价是 XSS 可直接读到；
 *   因此服务端做了「刷新令牌哈希存储 + 轮换 + 重放检测 + 设备可吊销」来限制泄露窗口。
 * - access_token 只活 15 分钟；刷新失败即清空本地状态，跳登录。
 */
const KEY = 'xunkao.session.v1';
const DEVICE_KEY = 'xunkao.device.v1';
const TAB_SLOT = 'xunkao.session.tab';

const listeners = new Set();
let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return {
      accessToken: parsed.accessToken || null,
      refreshToken: parsed.refreshToken || null,
      accessTokenExpiresAt: parsed.accessTokenExpiresAt || null,
      refreshTokenExpiresAt: parsed.refreshTokenExpiresAt || null,
      user: parsed.user || null,
      sessionId: parsed.sessionId || null,
    };
  } catch {
    return emptyState();
  }
}

function emptyState() {
  return {
    accessToken: null,
    refreshToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    user: null,
    sessionId: null,
  };
}

/**
 * 令牌额外写一份到 Cookie。
 *
 * 原因：部分托管平台的反向代理**既不转发 `Authorization`，也不转发自定义请求头**
 * （实测某云托管环境即是如此），只有 Cookie 与查询串能真正到达应用。
 * 两者之间选 Cookie —— 浏览器自动携带，不像查询串会把令牌写进 URL、
 * 浏览器历史和各级访问日志。
 *
 * Secure 只在 HTTPS 下加，否则本地 http://127.0.0.1 调试时 Cookie 不会被发送。
 */
function syncTokenCookie() {
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    if (!state.accessToken) {
      document.cookie = `xunkao_token=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
      return;
    }
    const maxAge = 60 * 60 * 24 * 30; // 30 天，与刷新令牌时效对齐
    document.cookie = `xunkao_token=${encodeURIComponent(state.accessToken)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  } catch {
    /* 忽略：Cookie 不可用时仍可走请求头通道（常规部署） */
  }
}

function persist() {
  try {
    if (!state.accessToken) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* 隐私模式下写入会失败，此时退化为「内存会话」 */
  }
  syncTokenCookie();
}

function emit() {
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (err) {
      console.error('[session] listener error', err);
    }
  }
}

export const session = {
  get snapshot() {
    return state;
  },
  get accessToken() {
    return state.accessToken;
  },
  get refreshToken() {
    return state.refreshToken;
  },
  get user() {
    return state.user;
  },
  get role() {
    return state.user?.role || 'guest';
  },
  get isAuthenticated() {
    return Boolean(state.accessToken && state.user);
  },
  isAdmin() {
    return this.role === 'admin';
  },
  /** 访问令牌是否已过期（留 30 秒余量，避免边界失败） */
  isAccessExpired() {
    if (!state.accessTokenExpiresAt) return true;
    return Date.parse(state.accessTokenExpiresAt) - 30_000 <= Date.now();
  },
  set(payload) {
    state = {
      accessToken: payload.accessToken ?? state.accessToken,
      refreshToken: payload.refreshToken ?? state.refreshToken,
      accessTokenExpiresAt: payload.accessTokenExpiresAt ?? state.accessTokenExpiresAt,
      refreshTokenExpiresAt: payload.refreshTokenExpiresAt ?? state.refreshTokenExpiresAt,
      user: payload.user ?? state.user,
      sessionId: payload.sessionId ?? state.sessionId,
    };
    persist();
    emit();
  },
  setUser(user) {
    state = { ...state, user };
    persist();
    emit();
  },
  clear() {
    state = emptyState();
    persist();
    emit();
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/* ── 设备标识：一次生成、长期复用，用于「登录设备」归并 ── */

export function deviceId() {
  let id = null;
  try {
    id = localStorage.getItem(DEVICE_KEY);
  } catch {
    id = null;
  }
  if (id) return id;
  id = `dev_${cryptoRandom()}`;
  try {
    localStorage.setItem(DEVICE_KEY, id);
  } catch {
    /* 忽略 */
  }
  return id;
}

/** 跨标签页同步：一个标签登录/登出，其他标签跟进，避免状态撕裂 */
export function bindCrossTabSync() {
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return;
    state = load();
    emit();
  });
  try {
    if (localStorage.getItem(TAB_SLOT)) return;
    localStorage.setItem(TAB_SLOT, String(Date.now()));
  } catch {
    /* 忽略 */
  }
}

function cryptoRandom() {
  const bytes = new Uint8Array(9);
  if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
