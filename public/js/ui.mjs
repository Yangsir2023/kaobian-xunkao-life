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
