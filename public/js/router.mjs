/**
 * 极简 hash 路由：支持 :param、查询串、导航栈（用于返回按钮）。
 * 用 hash 而非 history API，是为了 file:// 与静态托管场景也能直接打开就能用。
 */
export function createRouter() {
  const stack = [];
  let current = null;

  function parse(hash) {
    const raw = (hash || '#/').replace(/^#/, '') || '/';
    const [pathPart, queryPart] = raw.split('?');
    const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
    return {
      path: path.replace(/\/+$/, '') || '/',
      query: new URLSearchParams(queryPart || ''),
      raw,
    };
  }

  function matchRoute(routes, path) {
    const parts = path.split('/').filter(Boolean);
    for (const route of routes) {
      const segs = route.path.split('/').filter(Boolean);
      if (route.path === '*' ) continue;
      if (segs.length !== parts.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < segs.length; i += 1) {
        if (segs[i].startsWith(':')) params[segs[i].slice(1)] = decodeURIComponent(parts[i]);
        else if (segs[i] !== parts[i]) { ok = false; break; }
      }
      if (ok) return { route, params };
    }
    return routes.find((r) => r.path === '*') ? { route: routes.find((r) => r.path === '*'), params: {} } : null;
  }

  return {
    get stack() {
      return stack;
    },
    get current() {
      return current;
    },
    canGoBack() {
      return stack.length > 1;
    },
    back(fallback = '/') {
      if (stack.length > 1) {
        stack.pop();
        const previous = stack[stack.length - 1];
        replace(previous);
      } else {
        replace(fallback);
      }
    },
    start(routes, handler) {
      const handle = () => {
        const location = parse(window.location.hash);
        const matched = matchRoute(routes, location.path);
        if (!matched) {
          replace('/');
          return;
        }
        const entry = { path: location.path, query: location.query.toString() };
        if (!current || current.path !== entry.path) {
          const idx = stack.findIndex((s) => s.path === entry.path);
          if (idx >= 0 && idx < stack.length - 1) stack.splice(idx, 1);
          stack.push(entry);
        }
        current = entry;
        handler({ ...matched, location });
      };
      window.addEventListener('hashchange', handle);
      handle();
    },
  };
}

export function navigate(path) {
  const target = path.startsWith('/') ? path : `/${path}`;
  if (window.location.hash === `#${target}`) return;
  window.location.hash = target;
}

export function replace(path) {
  const target = path.startsWith('/') ? path : `/${path}`;
  const url = `${window.location.pathname}${window.location.search}#${target}`;
  window.history.replaceState(null, '', url);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export const routeUtils = { navigate, replace };
