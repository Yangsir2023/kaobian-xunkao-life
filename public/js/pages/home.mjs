/**
 * 提醒首页
 * - 登录用户：自己的提醒，按临近考试倒序（剩余天数升序 = 最紧迫在前）
 * - 游客：公共招考节点（官方公告导入），引导登录后创建自己的提醒
 */
import { api } from '../api.mjs';
import { session } from '../session.mjs';
import { icon } from '../icons.mjs';
import {
  escapeHtml,
  todayLabel,
  greeting,
  countdown,
  categoryChip,
  monthDayLabel,
} from '../utils.mjs';
import { emptyState, openSheet } from '../ui.mjs';

const QUICK_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'urgent7', label: '7 天内' },
  { key: 'soon30', label: '30 天内' },
  { key: 'active', label: '未截止' },
  { key: 'expired', label: '已截止' },
  { key: 'done', label: '已完成' },
];

const SORTS = [
  { key: 'deadline_asc', label: '最紧迫优先' },
  { key: 'deadline_desc', label: '截止最晚优先' },
  { key: 'created_desc', label: '最近创建' },
];

const state = {
  filter: 'all',
  sort: 'deadline_asc',
  query: '',
  rows: [],
  scope: 'official',
  userScope: 'mine',
  stats: null,
};

export default {
  tab: 'home',
  requireAuth: false,

  bar() {
    const authed = session.isAuthenticated;
    return {
      eyebrow: authed ? `${greeting()}，${session.user?.displayName || ''}` : '招考节点提醒',
      title: '巡考日历',
      subtitle: todayLabel(),
      actions: [
        {
          key: 'security',
          icon: 'shield',
          label: authed ? '安全记录' : '登录',
          onClick: () => window.location.assign(`#${authed ? '/me' : '/login'}`),
        },
      ],
    };
  },

  async render() {
    state.scope = session.isAuthenticated ? state.userScope : 'official';
    const data = await api.reminders({ scope: state.scope, sort: state.sort });
    state.rows = data.reminders;
    state.stats = data.stats;
    return shellHtml();
  },

  mount(root) {
    bind(root);
  },
};

/* ───────────────── HTML ───────────────── */

function shellHtml() {
  const authed = session.isAuthenticated;
  const official = state.scope === 'official';
  return `
    ${authed ? statStripHtml() : guestBannerHtml()}
    ${authed ? scopeToggleHtml() : ''}
    ${quickFilterHtml()}
    <div class="section-head">
      <h2 class="section-title">${official ? '近期公共招考节点' : '我的提醒'}</h2>
      <button class="section-link" id="open-sort">${sortLabel()}${icon('chevronDown', { size: 13, className: 'icon icon-sm' })}</button>
    </div>
    <div id="reminder-list">${listHtml()}</div>
    ${official ? officialFooterHtml() : ''}
  `;
}

/** 登录用户可在「我的提醒」与「公共招考节点（国考/省考/事业编/选调/军队文职/三支一扶/人才引进/西部计划…）」之间切换 */
function scopeToggleHtml() {
  return `<div class="chip-scroll" id="scope-toggle">
    <button class="chip ${state.scope === 'mine' ? 'is-active' : ''}" data-scope="mine">我的提醒</button>
    <button class="chip ${state.scope === 'official' ? 'is-active' : ''}" data-scope="official">公共招考节点 · 我能考的</button>
  </div>`;
}

function statStripHtml() {
  const stats = state.stats || { total: 0, active: 0, within7: 0, expired: 0 };
  return `<div class="stat-strip">
    <div class="stat-cell">
      <div class="stat-value ${stats.within7 > 0 ? 'is-urgent' : ''}">${stats.within7}</div>
      <div class="stat-label">7 天内</div>
    </div>
    <div class="stat-cell">
      <div class="stat-value is-soon">${stats.active}</div>
      <div class="stat-label">进行中</div>
    </div>
    <div class="stat-cell">
      <div class="stat-value">${stats.total}</div>
      <div class="stat-label">全部提醒</div>
    </div>
    <div class="stat-cell">
      <div class="stat-value is-ok">${stats.expired}</div>
      <div class="stat-label">已截止</div>
    </div>
  </div>`;
}

function guestBannerHtml() {
  return `<div class="notice notice-info" style="margin-bottom:12px">
    ${icon('info', { size: 17 })}
    <div class="grow">
      当前为游客浏览模式，展示的是公共招考节点。
      <a href="#/login" style="font-weight:600">登录</a> 后可创建自己的提醒、上传公告截图并接收截止倒计时。
    </div>
  </div>`;
}

function officialFooterHtml() {
  return `<div class="notice notice-warn" style="margin-top:14px">
    ${icon('alert', { size: 17 })}
    <div class="grow">公共节点日期为参考值（非官方承诺），请以主管部门当年正式公告为准。点击卡片可查看公告入口并「加入我的提醒」。</div>
  </div>`;
}

function quickFilterHtml() {
  return `<div class="chip-scroll" id="quick-filters">
    ${QUICK_FILTERS.map(
      (f) => `<button class="chip ${state.filter === f.key ? 'is-active' : ''}" data-filter="${f.key}">${f.label}</button>`
    ).join('')}
  </div>`;
}

function sortLabel() {
  return SORTS.find((s) => s.key === state.sort)?.label || '排序';
}

function listHtml() {
  const rows = applyFilter(state.rows);
  if (!rows.length) {
    if (state.query) {
      return emptyState({ iconName: 'search', title: '没有匹配的提醒', desc: `关键词「${state.query}」没有命中任何标题或备注。` });
    }
    if (state.filter !== 'all') {
      return emptyState({ iconName: 'filter', title: '该筛选下暂无提醒', desc: '换个筛选条件看看，或者新增一条提醒。' });
    }
    return session.isAuthenticated && state.scope !== 'official'
      ? emptyState({
          iconName: 'bell',
          title: '还没有提醒',
          desc: '把国考、省考、事业编等关键节点加进来，截止前会自动显示倒计时；也可切到「公共招考节点」看官方公告导入的节点并一键加入。',
          actionLabel: '新增第一条提醒',
          actionId: 'empty-add',
        })
      : emptyState({
          iconName: 'bell',
          title: '暂无临近的公共节点',
          desc: session.isAuthenticated ? '公共节点来自官方公告导入，已覆盖国考/省考/事业编/选调/军队文职/三支一扶/社区工作者/人才引进/西部计划。' : '登录后可创建自己的提醒，倒计时会实时更新。',
          actionLabel: session.isAuthenticated ? '新增我自己的提醒' : '登录后创建',
          actionId: 'empty-add',
        });
  }
  return `<div class="card-list">${rows.map(cardHtml).join('')}</div>`;
}

function applyFilter(rows) {
  let list = rows;
  switch (state.filter) {
    case 'urgent7':
      list = list.filter((r) => !r.countdown.expired && r.countdown.days <= 7 && r.status === 'active');
      break;
    case 'soon30':
      list = list.filter((r) => !r.countdown.expired && r.countdown.days <= 30 && r.status === 'active');
      break;
    case 'active':
      list = list.filter((r) => !r.countdown.expired && r.status === 'active');
      break;
    case 'expired':
      list = list.filter((r) => r.countdown.expired);
      break;
    case 'done':
      list = list.filter((r) => r.status === 'done');
      break;
    default:
      break;
  }
  if (state.query) {
    const needle = state.query.toLowerCase();
    list = list.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        (r.notes || '').toLowerCase().includes(needle) ||
        r.categoryName.includes(state.query) ||
        r.categoryFullName.includes(state.query)
    );
  }
  if (state.sort === 'deadline_desc') {
    list = [...list].sort((a, b) => Date.parse(b.deadline) - Date.parse(a.deadline));
  } else if (state.sort === 'deadline_asc') {
    list = [...list].sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline));
  }
  return list;
}

function cardHtml(row) {
  const meta = row.countdown || countdown(row.deadline, row.deadlineTime);
  const expired = meta.expired;
  const done = row.status === 'done';
  const dayLabel = expired ? `${Math.abs(meta.days)}` : `${meta.days}`;
  const unitLabel = expired ? '天前截止' : meta.days === 0 ? '今天截止' : meta.days === 1 ? '明天截止' : '天后截止';

  return `<article class="rem-card ${expired ? 'is-expired' : ''} ${done ? 'is-done' : ''}"
    data-id="${row.id}" style="--accent:${row.categoryColor}" role="button" tabindex="0">
    <div class="rem-top">
      <div class="grow">
        <h3 class="rem-title">${escapeHtml(row.title)}</h3>
        <div class="rem-meta">
          ${categoryChip(row)}
          <span class="rem-meta-item">${icon('calendar', { size: 13, className: 'icon icon-sm' })}${escapeHtml(monthDayLabel(row.deadline, row.deadlineTime))}</span>
          ${row.announcementUrl ? `<span class="rem-meta-item">${icon('link', { size: 13, className: 'icon icon-sm' })}公告原文</span>` : ''}
          ${row.official ? `<span class="badge badge-source">公共节点</span>` : ''}
          ${done ? `<span class="badge badge-success">已完成</span>` : ''}
        </div>
        ${row.notes ? `<p class="rem-notes">${escapeHtml(row.notes)}</p>` : ''}
      </div>
      <div class="countdown lv-${meta.level}">
        <div class="countdown-value">${dayLabel}</div>
        <div class="countdown-label">${unitLabel}</div>
      </div>
    </div>
  </article>`;
}

/* ───────────────── 交互 ───────────────── */

function bind(root) {
  root.querySelectorAll('[data-scope]').forEach((chip) => {
    chip.addEventListener('click', async () => {
      state.userScope = chip.dataset.scope;
      state.scope = session.isAuthenticated ? state.userScope : 'official';
      state.filter = 'all';
      const data = await api.reminders({ scope: state.scope, sort: state.sort });
      state.rows = data.reminders;
      state.stats = data.stats;
      const main = document.getElementById('app-main');
      if (main) {
        main.innerHTML = shellHtml();
        bind(main);
      }
    });
  });

  root.querySelectorAll('.rem-card').forEach((card) => {
    card.addEventListener('click', () => {
      window.location.hash = `/reminders/${card.dataset.id}`;
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.location.hash = `/reminders/${card.dataset.id}`;
      }
    });
  });

  root.querySelectorAll('[data-filter]').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.filter = chip.dataset.filter;
      root.querySelectorAll('[data-filter]').forEach((c) => c.classList.toggle('is-active', c === chip));
      const list = root.querySelector('#reminder-list');
      list.innerHTML = listHtml();
      bind(root);
    });
  });

  const sortBtn = root.querySelector('#open-sort');
  if (sortBtn) {
    sortBtn.addEventListener('click', () => {
      openSheet({
        title: '排序方式',
        subtitle: '默认按最紧迫的截止日期排在前面',
        content: `<div class="col" style="gap:8px">
          ${SORTS.map(
            (s) => `<button class="menu-item" data-sort="${s.key}" style="border:1px solid var(--border);border-radius:12px;padding:13px 14px">
              <span class="menu-label">${s.label}</span>
              ${state.sort === s.key ? icon('check', { size: 18 }) : ''}
            </button>`
          ).join('')}
        </div>`,
        mount(body, close) {
          body.querySelectorAll('[data-sort]').forEach((btn) => {
            btn.addEventListener('click', async () => {
              state.sort = btn.dataset.sort;
              close();
              const data = await api.reminders({ scope: state.scope, sort: state.sort });
              state.rows = data.reminders;
              state.stats = data.stats;
              const main = document.getElementById('app-main');
              main.innerHTML = shellHtml();
              bind(main);
            });
          });
        },
      });
    });
  }

  const emptyAdd = root.querySelector('#empty-add');
  if (emptyAdd) {
    emptyAdd.addEventListener('click', () => {
      window.location.hash = session.isAuthenticated ? '/reminders/new' : '/login';
    });
  }
}
