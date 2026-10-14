/**
 * 应用入口：装配路由 → 渲染外壳（顶栏 / 内容 / 底部导航）→ 挂载页面。
 * 页面模块契约：{ tab, bar(ctx), render(ctx), mount(root, ctx) }
 */
import { icon } from './icons.mjs';
import { api, ApiError, onUnauthorized } from './api.mjs';
import { session, bindCrossTabSync } from './session.mjs';
import { createRouter, navigate } from './router.mjs';
import { setHtml, $, toast, toastErr, skeletonCards, errorState, initChipRails } from './ui.mjs';
import { escapeHtml } from './utils.mjs';

import homePage from './pages/home.mjs';
import categoriesPage from './pages/categories.mjs';
import positionsPage from './pages/positions.mjs';
import detailPage from './pages/detail.mjs';
import editorPage from './pages/editor.mjs';
import loginPage from './pages/login.mjs';
import mePage from './pages/me.mjs';
import adminPage from './pages/admin.mjs';
import wechatAuthorizePage from './pages/wechat-authorize.mjs';
import wechatTicketPage from './pages/wechat-ticket.mjs';

const routes = [
  { path: '/', page: homePage },
  { path: '/categories', page: categoriesPage },
  { path: '/positions', page: positionsPage },
  { path: '/reminders/new', page: editorPage },
  { path: '/reminders/:id', page: detailPage },
  { path: '/reminders/:id/edit', page: editorPage },
  { path: '/login', page: loginPage },
  { path: '/wechat-authorize', page: wechatAuthorizePage },
  { path: '/auth/wechat', page: wechatTicketPage },
  { path: '/me', page: mePage },
  { path: '/admin', page: adminPage },
  { path: '*', page: null },
];

const TABS = [
  { key: 'home', path: '/', label: '提醒', icon: 'bell' },
  { key: 'positions', path: '/positions', label: '岗位', icon: 'briefcase' },
  { key: 'categories', path: '/categories', label: '分类', icon: 'grid' },
  { key: 'new', path: '/reminders/new', label: '新增', icon: 'plus', fab: true },
  { key: 'me', path: '/me', label: '我的', icon: 'user' },
];

const router = createRouter();
let appMeta = null;
let renderToken = 0;

/* ───────────────── 外壳渲染 ───────────────── */

function renderAppBar(bar = {}) {
  const parts = [];
  if (bar.back) {
    parts.push(`<button class="bar-back" data-nav-back>
      ${icon('chevronLeft', { size: 18, className: 'icon icon-sm' })}<span>返回</span>
    </button>`);
  }
  parts.push(`<div class="bar-titlewrap">
    ${bar.eyebrow ? `<div class="bar-eyebrow">${icon('signpost', { size: 13, className: 'icon' })}${escapeHtml(bar.eyebrow)}</div>` : ''}
    <h1 class="bar-title">${escapeHtml(bar.title || '巡考日历')}</h1>
    ${bar.subtitle ? `<p class="bar-subtitle">${escapeHtml(bar.subtitle)}</p>` : ''}
  </div>`);
  for (const action of bar.actions || []) {
    parts.push(
      `<button class="bar-action" data-bar-action="${action.key}" title="${escapeHtml(action.label || '')}" aria-label="${escapeHtml(action.label || '')}">
        ${icon(action.icon, { size: 19 })}</button>`
    );
  }
  const barEl = $('#app-bar');
  setHtml(barEl, parts.join(''));
  barEl.classList.toggle('is-transparent', Boolean(bar.transparent));
  const backBtn = $('[data-nav-back]', barEl);
  if (backBtn) backBtn.addEventListener('click', () => router.back('/'));
  for (const action of bar.actions || []) {
    const btn = $(`[data-bar-action="${action.key}"]`, barEl);
    if (btn && action.onClick) btn.addEventListener('click', action.onClick);
  }
}

function renderTabBar(activeKey) {
  const html = TABS.map((tab) => {
    if (tab.fab) {
      return `<button class="tab-item is-fab ${activeKey === tab.key ? 'is-active' : ''}" data-nav="${tab.path}" aria-label="${tab.label}">
        <span class="tab-fab">${icon(tab.icon, { size: 24, strokeWidth: 2 })}</span>
      </button>`;
    }
    return `<button class="tab-item ${activeKey === tab.key ? 'is-active' : ''}" data-nav="${tab.path}">
      ${icon(tab.icon, { size: 22, strokeWidth: activeKey === tab.key ? 2.1 : 1.7 })}
      <span>${tab.label}</span>
    </button>`;
  }).join('');
  const tabEl = $('#tab-bar');
  setHtml(tabEl, html);
  for (const btn of tabEl.querySelectorAll('[data-nav]')) {
    btn.addEventListener('click', () => navigate(btn.dataset.nav));
  }
}

/* ───────────────── 页面调度 ───────────────── */

async function dispatch(matched) {
  const token = ++renderToken;
  const main = $('#app-main');
  const { route, params, location } = matched;

  if (!route.page) {
    renderAppBar({ title: '页面不存在' });
    renderTabBar(null);
    setHtml(main, `<div class="empty">
      <div class="empty-icon">${icon('alert', { size: 26 })}</div>
      <h3 class="empty-title">没有找到这个页面</h3>
      <p class="empty-desc">链接可能已失效，返回首页继续查看你的招考提醒。</p>
      <button class="btn" id="go-home">返回首页</button>
    </div>`);
    $('#go-home').addEventListener('click', () => navigate('/'));
    return;
  }

  const ctx = {
    params: params || {},
    query: location.query,
    path: location.path,
    navigate,
    router,
    meta: appMeta,
  };

  // 需要登录的页面：未登录先跳登录并记住来路
  if (route.page.requireAuth && !session.isAuthenticated) {
    sessionStorage.setItem('xunkao.redirect', location.path);
    setHtml(main, skeletonCards(3));
    navigate('/login');
    return;
  }

  renderAppBar(route.page.bar ? route.page.bar(ctx) : { title: '巡考日历' });
  renderTabBar(route.page.tab ?? null);
  setHtml(main, skeletonCards(3));

  try {
    const html = await route.page.render(ctx);
    if (token !== renderToken) return;
    setHtml(main, html);
    if (route.page.mount) route.page.mount(main, ctx);
    window.scrollTo({ top: 0 });
  } catch (err) {
    if (token !== renderToken) return;
    const message = err instanceof ApiError ? err.message : '页面加载失败';
    setHtml(main, errorState(message));
    const retry = $('#retry-action');
    if (retry) retry.addEventListener('click', () => dispatch(matched));
    if (err instanceof ApiError && !err.isAuthError) toastErr(message);
  }
}

/* ───────────────── 启动 ───────────────── */

async function boot() {
  bindCrossTabSync();
  initChipRails();
  renderTabBar('home');

  onUnauthorized((reason) => {
    toastErr(reason || '登录已失效，请重新登录');
    if (!['/login', '/wechat-authorize', '/auth/wechat'].includes(router.current?.path)) {
      sessionStorage.setItem('xunkao.redirect', router.current?.path || '/');
      navigate('/login');
    }
  });

  try {
    appMeta = await api.meta();
  } catch {
    appMeta = null;
  }

  // 用服务端状态校准本地会话（例如管理员调整了角色、账号被禁用、会话被吊销）
  if (session.accessToken) {
    try {
      const info = await api.session();
      if (info.authenticated) session.setUser(info.user);
      else session.clear();
    } catch {
      session.clear();
    }
  }

  router.start(routes, dispatch);
}

boot().catch((err) => {
  console.error('[boot] 启动失败', err);
  setHtml($('#app-main'), errorState('应用初始化失败，请刷新页面重试'));
});
