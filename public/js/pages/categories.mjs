/**
 * 考试分类与筛选页
 * 上半部分：八大类招考入口网格（含「我的提醒数 / 官方节点数」）
 * 下半部分：按选中分类过滤的结果列表，支持筛选弹层（状态 / 时间窗 / 关键词 / 排序）
 */
import { api } from '../api.mjs';
import { session } from '../session.mjs';
import { icon } from '../icons.mjs';
import { escapeHtml, countdown, categoryChip, monthDayLabel } from '../utils.mjs';
import { emptyState, openSheet } from '../ui.mjs';

const SORTS = [
  { key: 'deadline_asc', label: '最紧迫优先' },
  { key: 'deadline_desc', label: '截止最晚优先' },
  { key: 'created_desc', label: '最近创建' },
];

const state = {
  categories: [],
  selected: [],
  rows: [],
  scope: 'official',
  status: '',
  withinDays: '',
  sort: 'deadline_asc',
  query: '',
};

export default {
  tab: 'categories',

  bar() {
    return {
      title: '考试分类与筛选',
      subtitle: '按招考类型组织，快速定位要盯的节点',
      actions: [{ key: 'filter', icon: 'filter', label: '筛选', onClick: () => openFilterSheet() }],
    };
  },

  async render() {
    state.scope = session.isAuthenticated ? 'mine' : 'official';
    const [catalog, list] = await Promise.all([
      api.categories(),
      api.reminders({ scope: state.scope, sort: state.sort }),
    ]);
    state.categories = catalog.categories;
    state.rows = list.reminders;
    return shellHtml();
  },

  mount(root) {
    bind(root);
  },
};

function shellHtml() {
  return `
    ${scopeNoticeHtml()}
    <div class="section-head">
      <h2 class="section-title">招考类别</h2>
      <span class="section-hint">${state.selected.length ? `已选 ${state.selected.length} 类` : '点击卡片筛选'}</span>
    </div>
    <div class="cat-grid">${state.categories.map(catCardHtml).join('')}</div>

    <div class="section-head mt-14">
      <h2 class="section-title">${resultTitle()}</h2>
      <button class="section-link" id="open-filter">${icon('filter', { size: 13, className: 'icon icon-sm' })}筛选</button>
    </div>
    <div id="result-list">${resultListHtml()}</div>
    <div class="notice notice-info mt-14">
      ${icon('info', { size: 17 })}
      <div class="grow">分类说明：国考、省考、事业编、社区工作者、湖北选调、军队文职、三支一扶、留服认证八类覆盖主流招考路径；点击卡片可多选。</div>
    </div>
  `;
}

function scopeNoticeHtml() {
  const authed = session.isAuthenticated;
  return `<div class="chip-scroll" style="gap:6px">
    <button class="chip ${state.scope === 'mine' ? 'is-active' : ''}" data-scope="mine" ${authed ? '' : 'disabled style="opacity:.5"'}>
      我的提醒
    </button>
    <button class="chip ${state.scope === 'official' ? 'is-active' : ''}" data-scope="official">公共招考节点</button>
    ${authed ? '' : `<a class="chip" href="#/login" style="display:inline-flex;align-items:center">登录后查看我的提醒</a>`}
  </div>`;
}

function catCardHtml(cat) {
  const selected = state.selected.includes(cat.key);
  return `<button class="cat-card ${selected ? 'is-selected' : ''}" data-cat="${cat.key}">
    <div class="row">
      <div class="cat-icon" style="background:${cat.accent};color:${cat.color}">
        ${icon(cat.icon, { size: 19 })}
      </div>
      ${selected ? `<span style="margin-left:auto;color:var(--primary)">${icon('check', { size: 17 })}</span>` : ''}
    </div>
    <div>
      <div class="cat-name">${escapeHtml(cat.short)}</div>
      <div class="cat-full">${escapeHtml(cat.name)}</div>
    </div>
    <div class="cat-counts">
      <span>我的 <b>${cat.myCount}</b></span>
      <span>官方 <b>${cat.officialCount}</b></span>
    </div>
  </button>`;
}

function resultTitle() {
  if (!state.selected.length) return '全部节点';
  const names = state.selected
    .map((key) => state.categories.find((c) => c.key === key)?.short)
    .filter(Boolean);
  return names.join(' · ');
}

function filteredRows() {
  let rows = state.rows;
  if (state.selected.length) rows = rows.filter((r) => state.selected.includes(r.category));
  if (state.status) rows = rows.filter((r) => r.status === state.status);
  if (state.withinDays) {
    const days = Number.parseInt(state.withinDays, 10);
    rows = rows.filter((r) => !r.countdown.expired && r.countdown.days <= days);
  }
  if (state.query) {
    const needle = state.query.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        (r.notes || '').toLowerCase().includes(needle) ||
        r.categoryFullName.includes(state.query)
    );
  }
  if (state.sort === 'deadline_desc') rows = [...rows].sort((a, b) => Date.parse(b.deadline) - Date.parse(a.deadline));
  else if (state.sort === 'created_desc') rows = [...rows].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  else rows = [...rows].sort((a, b) => Date.parse(a.deadline) - Date.parse(b.deadline));
  return rows;
}

function resultListHtml() {
  const rows = filteredRows();
  if (!rows.length) {
    return emptyState({
      iconName: 'filter',
      title: '没有符合条件的节点',
      desc: '试着取消部分筛选条件，或者先新增一条提醒。',
      actionLabel: '重置筛选',
      actionId: 'reset-filter',
    });
  }
  return `<div class="small muted" style="margin-bottom:8px">共 ${rows.length} 条 · 按${SORTS.find((s) => s.key === state.sort)?.label}</div>
  <div class="card-list">${rows.map(rowHtml).join('')}</div>`;
}

function rowHtml(row) {
  const meta = row.countdown || countdown(row.deadline, row.deadlineTime);
  const expired = meta.expired;
  return `<article class="rem-card ${expired ? 'is-expired' : ''}" data-id="${row.id}" style="--accent:${row.categoryColor}">
    <div class="rem-top">
      <div class="grow">
        <h3 class="rem-title">${escapeHtml(row.title)}</h3>
        <div class="rem-meta">
          ${categoryChip(row)}
          <span class="rem-meta-item">${icon('calendar', { size: 13, className: 'icon icon-sm' })}${escapeHtml(monthDayLabel(row.deadline, row.deadlineTime))}</span>
          ${row.official ? '<span class="badge badge-source">公共节点</span>' : ''}
          ${row.status === 'done' ? '<span class="badge badge-success">已完成</span>' : ''}
        </div>
      </div>
      <div class="countdown lv-${meta.level}">
        <div class="countdown-value">${expired ? '已过' : meta.days}</div>
        <div class="countdown-label">${expired ? `${Math.abs(meta.days)} 天` : meta.days === 0 ? '今天' : '天后'}</div>
      </div>
    </div>
  </article>`;
}

/* ───────────────── 交互 ───────────────── */

function bind(root) {
  root.querySelectorAll('[data-cat]').forEach((card) => {
    card.addEventListener('click', () => {
      const key = card.dataset.cat;
      state.selected = state.selected.includes(key)
        ? state.selected.filter((k) => k !== key)
        : [...state.selected, key];
      card.classList.toggle('is-selected', state.selected.includes(key));
      refreshResults(root);
    });
  });

  root.querySelectorAll('[data-scope]').forEach((chip) => {
    chip.addEventListener('click', async () => {
      if (chip.disabled) return;
      state.scope = chip.dataset.scope;
      const [catalog, list] = await Promise.all([
        api.categories(),
        api.reminders({ scope: state.scope, sort: state.sort }),
      ]);
      state.categories = catalog.categories;
      state.rows = list.reminders;
      const main = document.getElementById('app-main');
      main.innerHTML = shellHtml();
      bind(main);
    });
  });

  const filterBtn = root.querySelector('#open-filter');
  if (filterBtn) filterBtn.addEventListener('click', () => openFilterSheet());
  const resetBtn = root.querySelector('#reset-filter');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      state.selected = [];
      state.status = '';
      state.withinDays = '';
      state.query = '';
      const main = document.getElementById('app-main');
      main.innerHTML = shellHtml();
      bind(main);
    });
  }

  root.querySelectorAll('.rem-card').forEach((card) => {
    card.addEventListener('click', () => {
      window.location.hash = `/reminders/${card.dataset.id}`;
    });
  });
}

function refreshResults(root) {
  const wrap = root.querySelector('#result-list');
  if (wrap) wrap.innerHTML = resultListHtml();
  const head = root.querySelector('.section-head .section-title');
  if (head && root.querySelector('#open-filter')) head.textContent = resultTitle();
  bind(root);
}

function openFilterSheet() {
  const statusOptions = [
    { key: '', label: '全部状态' },
    { key: 'active', label: '进行中' },
    { key: 'done', label: '已完成' },
    { key: 'archived', label: '已归档' },
  ];
  const windows = [
    { key: '', label: '不限时间' },
    { key: '7', label: '7 天内' },
    { key: '30', label: '30 天内' },
    { key: '90', label: '90 天内' },
  ];

  openSheet({
    title: '筛选与排序',
    subtitle: '组合条件后立即生效',
    content: `
      <div class="filter-group">
        <div class="filter-group-title">考试类别</div>
        <div class="chip-scroll" style="flex-wrap:wrap;overflow:visible">
          ${state.categories
            .map(
              (c) =>
                `<button class="chip tint ${state.selected.includes(c.key) ? 'is-active' : ''}" data-fcat="${c.key}">${escapeHtml(c.short)}</button>`
            )
            .join('')}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-group-title">状态</div>
        <div class="chip-scroll" style="flex-wrap:wrap;overflow:visible">
          ${statusOptions
            .map((s) => `<button class="chip tint ${state.status === s.key ? 'is-active' : ''}" data-fstatus="${s.key}">${s.label}</button>`)
            .join('')}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-group-title">截止时间窗</div>
        <div class="chip-scroll" style="flex-wrap:wrap;overflow:visible">
          ${windows
            .map((w) => `<button class="chip tint ${state.withinDays === w.key ? 'is-active' : ''}" data-fwin="${w.key}">${w.label}</button>`)
            .join('')}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-group-title">排序</div>
        <div class="chip-scroll" style="flex-wrap:wrap;overflow:visible">
          ${SORTS.map((s) => `<button class="chip tint ${state.sort === s.key ? 'is-active' : ''}" data-fsort="${s.key}">${s.label}</button>`).join('')}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-group-title">关键词</div>
        <input class="input" id="f-query" placeholder="搜索标题 / 备注 / 类别" value="${escapeHtml(state.query)}" />
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="f-reset">重置</button>
        <button class="btn" id="f-apply">查看结果</button>
      </div>
    `,
    mount(body, close) {
      const sync = (selector, attr, assign) => {
        body.querySelectorAll(selector).forEach((btn) => {
          btn.addEventListener('click', () => {
            assign(btn.dataset[attr]);
            const group = btn.parentElement;
            group.querySelectorAll(selector).forEach((b) => b.classList.toggle('is-active', b === btn));
          });
        });
      };
      body.querySelectorAll('[data-fcat]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.dataset.fcat;
          state.selected = state.selected.includes(key)
            ? state.selected.filter((k) => k !== key)
            : [...state.selected, key];
          btn.classList.toggle('is-active', state.selected.includes(key));
        });
      });
      sync('[data-fstatus]', 'fstatus', (v) => {
        state.status = v;
      });
      sync('[data-fwin]', 'fwin', (v) => {
        state.withinDays = v;
      });
      sync('[data-fsort]', 'fsort', (v) => {
        state.sort = v;
      });
      body.querySelector('#f-reset').addEventListener('click', () => {
        state.selected = [];
        state.status = '';
        state.withinDays = '';
        state.query = '';
        state.sort = 'deadline_asc';
        close();
        rerenderAll();
      });
      body.querySelector('#f-apply').addEventListener('click', () => {
        state.query = body.querySelector('#f-query').value.trim();
        close();
        rerenderAll();
      });
    },
  });
}

function rerenderAll() {
  const main = document.getElementById('app-main');
  main.innerHTML = shellHtml();
  bind(main);
}
