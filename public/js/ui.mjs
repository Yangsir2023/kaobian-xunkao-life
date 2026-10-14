/** UI 组件层：Toast / 底部弹层 / 确认弹窗 / 空状态 / 骨架屏 与少量 DOM 助手 */
import { icon } from './icons.mjs';
import { escapeHtml } from './utils.mjs';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function el(htmlString) {
  const tpl = document.createElement('template');
  tpl.innerHTML = htmlString.trim();
  return tpl.content.firstElementChild;
}

export function setHtml(target, htmlString) {
  if (!target) return;
  target.innerHTML = htmlString.trim();
}

/* ───────────────────────── Toast ───────────────────────── */

export function toast(message, { type = 'default', duration = 2400 } = {}) {
  const stack = $('#toast-stack');
  if (!stack) return () => {};
  const glyph = type === 'error' ? 'alert' : type === 'success' ? 'checkCircle' : 'info';
  const node = el(`<div class="toast ${type === 'error' ? 'is-error' : type === 'success' ? 'is-success' : ''}">
    ${icon(glyph, { size: 17 })}
    <span>${escapeHtml(message)}</span>
  </div>`);
  stack.appendChild(node);
  const timer = setTimeout(remove, duration);
  function remove() {
    clearTimeout(timer);
    node.style.transition = 'opacity .18s, transform .18s';
    node.style.opacity = '0';
    node.style.transform = 'translateY(8px)';
    setTimeout(() => node.remove(), 200);
  }
  node.addEventListener('click', remove);
  return remove;
}

export const toastOk = (message) => toast(message, { type: 'success' });
export const toastErr = (message) => toast(message, { type: 'error', duration: 3200 });

/* ───────────────────────── 底部弹层 ───────────────────────── */

export function openSheet({ title = '', subtitle = '', content = '', mount = null, onClose = null } = {}) {
  const root = $('#sheet-root');
  const backdrop = el(`<div class="sheet-backdrop">
    <div class="sheet-panel" role="dialog" aria-modal="true">
      <div class="sheet-grab"></div>
      ${title ? `<h2 class="sheet-title">${escapeHtml(title)}</h2>` : ''}
      ${subtitle ? `<p class="sheet-sub">${escapeHtml(subtitle)}</p>` : ''}
      <div class="sheet-body"></div>
    </div>
  </div>`);
  $('.sheet-body', backdrop).innerHTML = content;
  root.appendChild(backdrop);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    backdrop.style.animation = 'fade-in .16s reverse';
    setTimeout(() => backdrop.remove(), 140);
    if (onClose) onClose();
  }
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  if (mount) mount($('.sheet-body', backdrop), close);
  return close;
}

/* ───────────────────────── 确认弹窗 ───────────────────────── */

export function confirmDialog({
  title,
  desc = '',
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    const root = $('#modal-root');
    const box = el(`<div class="modal-backdrop">
      <div class="modal-box" role="dialog" aria-modal="true">
        <h2 class="modal-title">${escapeHtml(title)}</h2>
        ${desc ? `<p class="modal-desc">${escapeHtml(desc)}</p>` : ''}
        <div class="btn-row">
          <button class="btn btn-ghost" data-act="cancel">${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? 'btn-danger' : ''}" data-act="ok">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    </div>`);
    root.appendChild(box);
    const finish = (value) => {
      box.style.animation = 'fade-in .14s reverse';
      setTimeout(() => box.remove(), 120);
      resolve(value);
    };
    $('[data-act="cancel"]', box).addEventListener('click', () => finish(false));
    $('[data-act="ok"]', box).addEventListener('click', () => finish(true));
    box.addEventListener('click', (event) => {
      if (event.target === box) finish(false);
    });
  });
}

/* ───────────────────────── 空状态 / 骨架屏 ───────────────────────── */

export function emptyState({ iconName = 'bell', title, desc = '', actionLabel = '', actionId = 'empty-action' } = {}) {
  return `<div class="empty fade-in">
    <div class="empty-icon">${icon(iconName, { size: 26, className: 'icon-lg' })}</div>
    <h3 class="empty-title">${escapeHtml(title)}</h3>
    ${desc ? `<p class="empty-desc">${escapeHtml(desc)}</p>` : ''}
    ${actionLabel ? `<button class="btn" id="${actionId}">${escapeHtml(actionLabel)}</button>` : ''}
  </div>`;
}

export function skeletonCards(count = 3) {
  return `<div class="card-list">${Array.from({ length: count })
    .map(() => '<div class="skeleton sk-card"></div>')
    .join('')}</div>`;
}

export function errorState(message, retryId = 'retry-action') {
  return `<div class="empty fade-in">
    <div class="empty-icon" style="color:var(--danger);background:var(--danger-weak);border-color:#F3C9C9">
      ${icon('alert', { size: 26, className: 'icon-lg' })}
    </div>
    <h3 class="empty-title">加载失败</h3>
    <p class="empty-desc">${escapeHtml(message || '请稍后重试')}</p>
    <button class="btn btn-ghost" id="${retryId}">重新加载</button>
  </div>`;
}

/* ───────────────────────── 按钮 loading ───────────────────────── */

export function withLoading(button, task) {
  return async (...args) => {
    if (!button || button.disabled) return undefined;
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `${icon('refresh', { size: 16, className: 'icon icon-sm spin' })}<span>处理中…</span>`;
    try {
      return await task(...args);
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  };
}

/* ───────────────── 横向标签条：拖动滑动 + 左右翻页 ───────────────── */

/**
 * 横向标签条（.chip-scroll）本来就是 overflow-x:auto，但滚动条被隐藏了
 * （scrollbar-width:none），结果是：触屏能滑、**鼠标既看不出右边还有内容、也拖不动**，
 * 排在后面的标签等于消失。这里补上桌面端能力：
 *   1. 按住鼠标左右拖动即可滑动（触屏保留原生惯性滑动，不去抢它的手势）；
 *   2. 溢出时在两端浮出圆形翻页按钮，点一下翻一屏 —— 同时也是"还有更多"的可见提示。
 *
 * 用 MutationObserver 统一增强，所以页面局部重渲染、弹层新插入的标签条都会自动生效，
 * 不需要每个页面各写一遍。
 */
const RAIL_FLAG = 'railReady';
const MARGIN_UTIL = /^(mt|mb|my)-\d+$/;
/** 超过这个位移才认为是在拖动（而不是手抖） */
const DRAG_START = 3;
/** 拖动超过这个位移，松手后补发的 click 会被吞掉，避免误触标签 */
const DRAG_SWALLOW = 6;
/**
 * 记住每条标签条的水平滚动位置。
 *
 * 页面点一下标签就会 `innerHTML = shellHtml()` 整个重建（见 positions.mjs#rerender），
 * 新元素 scrollLeft 归零 —— 于是"往右滑找到某省，点一下又弹回最左边"，
 * 想连着勾几个省就得反复滑。这里按「路由 + 文档顺序」把位置存下来，重建后还原。
 */
const railScrollMemory = new Map();

function enhanceRail(scroller) {
  if (scroller.dataset[RAIL_FLAG] === '1') return;
  scroller.dataset[RAIL_FLAG] = '1';

  const railKey = `${location.hash || '#/'}#${
    Array.from(document.querySelectorAll('.chip-scroll')).indexOf(scroller)
  }`;

  const rail = document.createElement('div');
  rail.className = 'chip-rail';
  // 外边距工具类（如 mt-10）挂在外层容器上，否则包一层之后间距会丢
  for (const cls of Array.from(scroller.classList)) {
    if (MARGIN_UTIL.test(cls)) {
      rail.classList.add(cls);
      scroller.classList.remove(cls);
    }
  }
  scroller.parentNode.insertBefore(rail, scroller);
  rail.appendChild(scroller);

  const prev = el(`<button class="chip-nav is-prev" type="button" aria-label="向左看更多">${icon('chevronLeft', { size: 16 })}</button>`);
  const next = el(`<button class="chip-nav is-next" type="button" aria-label="向右看更多">${icon('chevronRight', { size: 16 })}</button>`);
  rail.append(prev, next);

  const sync = () => {
    const max = scroller.scrollWidth - scroller.clientWidth;
    const overflow = max > 1;
    rail.classList.toggle('has-overflow', overflow);
    rail.classList.toggle('has-prev', overflow && scroller.scrollLeft > 1);
    rail.classList.toggle('has-next', overflow && scroller.scrollLeft < max - 1);
  };

  // 还原期间不要回写，否则"归零"会被当成新位置存下来
  const saved = railScrollMemory.get(railKey) || 0;
  let restoring = true;
  const remember = () => {
    if (restoring) return;
    railScrollMemory.set(railKey, scroller.scrollLeft);
  };
  /**
   * 还原位置。注意不能只做一次：刚插进 DOM 的元素这一帧宽度还是 0，
   * 此时把 scrollLeft 设成 674 会被钳回 0。所以要等真实宽度出现后再补，
   * 由 ResizeObserver + 两次 rAF 反复调用，直到成功为止。
   */
  const applyRestore = () => {
    if (!restoring) return;
    const max = scroller.scrollWidth - scroller.clientWidth;
    if (saved > 0 && max <= 0) return; // 还没量到宽度，等下一轮
    if (saved > 0) scroller.scrollLeft = Math.min(saved, max);
    restoring = false;
  };

  const turn = (dir) => {
    const step = Math.max(140, Math.round(scroller.clientWidth * 0.7));
    scroller.scrollBy({ left: dir * step, behavior: 'smooth' });
  };
  prev.addEventListener('click', () => turn(-1));
  next.addEventListener('click', () => turn(1));

  // 拖动：只接管鼠标 / 触控笔，触屏交给原生滑动
  let dragging = false;
  let startX = 0;
  let startLeft = 0;
  let moved = 0;
  let swallowClick = false;

  scroller.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' || event.button !== 0) return;
    dragging = true;
    moved = 0;
    swallowClick = false;
    startX = event.clientX;
    startLeft = scroller.scrollLeft;
    scroller.classList.add('is-dragging');
  });

  scroller.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    if (moved <= DRAG_START) return;
    scroller.scrollLeft = startLeft - dx;
    if (moved > DRAG_SWALLOW) swallowClick = true;
    event.preventDefault();
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    scroller.classList.remove('is-dragging');
  };
  scroller.addEventListener('pointerup', endDrag);
  scroller.addEventListener('pointercancel', endDrag);
  scroller.addEventListener('pointerleave', endDrag);

  // 拖动松手后浏览器仍会补一个 click，不清掉就会误触到标签
  scroller.addEventListener(
    'click',
    (event) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true
  );

  scroller.addEventListener('scroll', () => { remember(); sync(); }, { passive: true });
  const refresh = () => { applyRestore(); sync(); };
  if ('ResizeObserver' in window) new ResizeObserver(refresh).observe(scroller);
  sync();
  requestAnimationFrame(refresh);
  requestAnimationFrame(refresh);
}

/** 增强 root 内的横向标签条；已换行（flex-wrap:wrap）的标签组不需要处理 */
export function enhanceChipRails(root = document) {
  const visit = (node) => {
    if (node.classList?.contains('chip-scroll') && getComputedStyle(node).flexWrap !== 'wrap') {
      enhanceRail(node);
    }
    node.querySelectorAll?.('.chip-scroll').forEach((child) => {
      if (getComputedStyle(child).flexWrap !== 'wrap') enhanceRail(child);
    });
  };
  visit(root === document ? document.body : root);
}

/** 应用启动时调用一次：覆盖当前与后续所有渲染出来的标签条 */
export function initChipRails() {
  enhanceChipRails(document);
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) enhanceChipRails(node);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}
