/**
 * 岗位库页 · 留学生友好岗位
 *
 * 回答四个问题：
 *   1) 哪些省我能报？        —— 省份筛选 + 分省政策基线
 *   2) 哪些方向我能报？      —— 计算机科学与技术（0812）/ 硕士不限专业
 *   3) 哪里分数低好上岸？    —— 不设开考比例 + 仅限应届 + 上岸分 50 多分或低于 120 分
 *   4) 哪里能捡漏？          —— 捡漏栏目：无人报考 + 不设开考比例 + 我能报 + 政审安全，五条全中才圈出来
 *
 * 数据诚实边界：种子行一律标记「示例」或「第三方」，界面用 badge 明示；
 * 真实岗位由用户「录入岗位」或批量导入产生，标记「我的」。
 */
import { api } from '../api.mjs';
import { session } from '../session.mjs';
import { icon } from '../icons.mjs';
import { escapeHtml } from '../utils.mjs';
import { emptyState, openSheet, toast, toastOk, confirmDialog } from '../ui.mjs';

const state = {
  catalogs: null,
  rows: [],
  stats: null,
  provinces: [],
  examType: '',
  majorTrack: '',
  ratioType: '',
  degree: '',
  freshOnly: '',
  bands: [],
  maxScore: '',
  query: '',
  bargain: '',
  sort: 'score_asc',
  loading: false,
};

/** 一键套用「留学生低分上岸」最优组合 */
const PRESET = {
  majorTrack: 'cs0812',
  ratioType: 'none',
  freshOnly: 'true',
  bands: ['lt120'],
};

export default {
  tab: 'positions',

  bar() {
    return {
      title: '留学生友好岗位库',
      subtitle: '按省份筛可报方向，找不设开考比例的低分上岸岗',
      actions: [
        { key: 'bargain', icon: 'star', label: '捡漏攻略', onClick: () => openBargainSheet() },
        { key: 'policy', icon: 'book', label: '政策依据', onClick: () => openPolicySheet() },
        { key: 'add', icon: 'plus', label: '录入岗位', onClick: () => openEditorSheet() },
      ],
    };
  },

  async render() {
    if (!state.catalogs) {
      state.catalogs = await api.positionCatalogs();
    }
    await loadList();
    return shellHtml();
  },

  mount(root) {
    bind(root);
  },
};

/* ───────────────── 数据 ───────────────── */

async function loadList() {
  const params = {
    sort: state.sort,
  };
  if (state.provinces.length) params.province = state.provinces.join(',');
  if (state.examType) params.examType = state.examType;
  if (state.majorTrack) params.majorTrack = state.majorTrack;
  if (state.ratioType) params.ratioType = state.ratioType;
  if (state.degree) params.degree = state.degree;
  if (state.freshOnly) params.freshOnly = state.freshOnly;
  if (state.bands.length) params.band = state.bands.join(',');
  if (state.maxScore !== '') params.maxScore = state.maxScore;
  if (state.query) params.q = state.query;
  if (state.bargain) params.bargain = '1';

  const data = await api.positions(params);
  state.rows = data.positions;
  state.stats = data.stats;
}

/* ───────────────── 视图 ───────────────── */

function shellHtml() {
  return `
    ${statsHtml()}
    ${filterHtml()}
    ${noticeHtml()}
    <div id="pos-list">${listHtml()}</div>
  `;
}

function statsHtml() {
  const s = state.stats || { total: 0, lowScore: 0, noRatio: 0, freshOnly: 0, provinces: 0, bargain: 0, zeroApply: 0 };
  return `<div class="stat-strip">
    <div class="stat-cell"><div class="stat-value">${s.total}</div><div class="stat-label">岗位</div></div>
    <div class="stat-cell"><div class="stat-value is-soon">${s.lowScore}</div><div class="stat-label">低分上岸</div></div>
    <div class="stat-cell"><div class="stat-value is-ok">${s.noRatio}</div><div class="stat-label">不设比例</div></div>
    <div class="stat-cell"><div class="stat-value">${s.freshOnly}</div><div class="stat-label">仅限应届</div></div>
    <div class="stat-cell"><div class="stat-value is-bargain">${s.bargain ?? 0}</div><div class="stat-label">捡漏命中</div></div>
    <div class="stat-cell"><div class="stat-value">${s.provinces}</div><div class="stat-label">覆盖省份</div></div>
  </div>`;
}

function filterHtml() {
  const cat = state.catalogs;
  return `
    <div class="chip-scroll mt-10">
      <button class="chip chip-bargain ${state.bargain ? 'is-active' : ''}" data-bargain="1">
        ${icon('star', { size: 13, className: 'icon icon-sm' })}捡漏专区
      </button>
      <button class="chip" data-guide="1">${icon('signpost', { size: 13, className: 'icon icon-sm' })}捡漏攻略</button>
      <button class="chip ${state.majorTrack === PRESET.majorTrack && state.ratioType === PRESET.ratioType && state.freshOnly === PRESET.freshOnly && state.bands.includes('lt120') ? 'is-active' : ''}" data-preset="1">
        ${icon('spark', { size: 13, className: 'icon icon-sm' })}低分上岸组合
      </button>
      <button class="chip ${state.majorTrack === 'cs0812' ? 'is-active' : ''}" data-track="cs0812">计算机 0812</button>
      <button class="chip ${state.majorTrack === 'master_any' ? 'is-active' : ''}" data-track="master_any">硕士不限专业</button>
      <button class="chip ${state.ratioType === 'none' ? 'is-active' : ''}" data-ratio="none">不设开考比例</button>
      <button class="chip ${state.freshOnly === 'true' ? 'is-active' : ''}" data-fresh="true">仅限应届</button>
      <button class="chip ${state.bands.includes('low50') ? 'is-active' : ''}" data-band="low50">50 多分</button>
      <button class="chip ${state.bands.includes('lt120') ? 'is-active' : ''}" data-band="lt120">低于 120 分</button>
      <button class="chip" data-open-filter="1">${icon('filter', { size: 13, className: 'icon icon-sm' })}更多</button>
      ${hasFilter() ? '<button class="chip" data-reset="1">重置</button>' : ''}
    </div>
    <div class="chip-scroll">
      <span class="chip chip-label">省份</span>
      ${cat.provinces
        .map(
          (p) =>
            `<button class="chip tint ${state.provinces.includes(p) ? 'is-active' : ''}" data-province="${escapeHtml(p)}">${escapeHtml(p)}</button>`
        )
        .join('')}
    </div>`;
}

function hasFilter() {
  return (
    state.provinces.length > 0 ||
    Boolean(state.examType) ||
    Boolean(state.majorTrack) ||
    Boolean(state.ratioType) ||
    Boolean(state.degree) ||
    Boolean(state.freshOnly) ||
    state.bands.length > 0 ||
    state.maxScore !== '' ||
    Boolean(state.query) ||
    Boolean(state.bargain)
  );
}

function noticeHtml() {
  return `<div class="notice notice-warn mt-10">
    ${icon('alert', { size: 16 })}
    <div class="grow">
      <b>数据边界</b>：带「示例」标的岗位是演示筛选逻辑的占位行，<b>不代表真实招录岗位</b>；
      带「第三方」标的来自公考雷达等平台整理的进面与报名数据，通常溯源到官方公告，仍建议以官方职位表复核。
      点右上角「政策依据」可核对官方分数线与开考比例规则，用「录入岗位」把你的职位表灌进来。
    </div>
  </div>`;
}

function listHtml() {
  if (state.loading) return skeleton();
  if (!state.rows.length) {
    if (state.bargain) {
      return emptyState({
        iconName: 'star',
        title: '当前没有命中捡漏五条件的岗位',
        desc: '五条件 = 无人报考 + 不设开考比例 + 专业对口 + 学历达标 + 留学生政审安全。2026 国考 89 个挂零职位逐一核对后无一全中——原因与实时捡漏方法见「捡漏攻略」。',
        actionLabel: '打开捡漏攻略',
        actionId: 'empty-guide',
      });
    }
    return emptyState({
      iconName: 'filter',
      title: '没有符合条件的岗位',
      desc: '试着放开省份或分数段条件；也可以直接录入你从官方职位表里挑出来的岗位。',
      actionLabel: '重置筛选',
      actionId: 'empty-reset',
    });
  }
  const sortLabel = state.catalogs.sorts.find((s) => s.key === state.sort)?.label || '';
  const bargainNote = state.bargain
    ? `<div class="bargain-banner mt-10">${icon('star', { size: 14 })}<div class="grow">捡漏专区：以下岗位五条件全中（无人报考 + 不设开考比例 + 专业对口 + 学历达标 + 政审安全）。数据截至各行的「数据更新日期」，报名窗口内请每日回官方渠道复核。</div></div>`
    : '';
  return `<div class="small muted" style="margin:2px 0 8px">共 ${state.rows.length} 条 · ${sortLabel}</div>
    ${bargainNote}
    <div class="card-list">${state.rows.map(cardHtml).join('')}</div>`;
}

function skeleton() {
  return `<div class="card-list">${[1, 2, 3].map(() => '<div class="skeleton sk-card"></div>').join('')}</div>`;
}

function cardHtml(row) {
  const bands = row.scoreBands || [];
  const hasMax = row.scoreMax != null;
  const bargain = row.bargain || { hit: false };
  return `<article class="pos-card ${bargain.hit ? 'is-bargain' : ''}" data-id="${row.id}">
    <div class="pos-head">
      <span class="pos-province">${escapeHtml(row.province)}</span>
      ${bargain.hit ? `<span class="bargain-badge">${icon('star', { size: 12, className: 'icon icon-sm' })}捡漏</span>` : ''}
      <span class="badge badge-outline">${escapeHtml(row.examTypeName)}</span>
      <span class="badge" style="background:${row.dataLevelAccent};color:${row.dataLevelColor}">${escapeHtml(row.dataLevelName)}</span>
      ${row.freshOnly ? '<span class="badge badge-success">应届</span>' : ''}
      <span class="grow"></span>
      <div class="pos-score">
        <span class="pos-score-value num">${row.scoreMin ?? row.score ?? '—'}</span>
        <span class="pos-score-total">/${row.scoreTotal ?? '—'}</span>
      </div>
    </div>
    <h3 class="pos-title">${escapeHtml(row.title)}</h3>
    <div class="pos-unit">${escapeHtml(row.unit)}${row.positionCode ? ` · ${escapeHtml(row.positionCode)}` : ''}</div>
    <div class="pos-tags">
      <span class="pos-tag" style="background:${trackColor(row)};color:#fff">${escapeHtml(row.majorTrackName)}</span>
      <span class="pos-tag is-${row.ratioType}">${escapeHtml(row.ratioTypeName)}</span>
      <span class="pos-tag is-plain">${escapeHtml(row.degreeName)}</span>
      ${bands.includes('low50') ? '<span class="pos-tag is-low">50 多分</span>' : ''}
      ${bands.includes('lt120') ? '<span class="pos-tag is-low">低于 120 分</span>' : ''}
      ${row.applicants === 0 ? '<span class="pos-tag is-zero">零报名</span>' : ''}
      ${row.policePosition ? '<span class="pos-tag is-police">政法类 · 留学生禁入</span>' : ''}
      ${row.competition ? `<span class="pos-tag is-plain">竞争比 ${row.competition}:1</span>` : ''}
    </div>
    ${
      hasMax || row.scoreAvg != null
        ? `<div class="pos-scoreline">
            最低 <b class="num">${row.scoreMin ?? '—'}</b>
            ${hasMax ? ` · 最高 <b class="num">${row.scoreMax}</b>` : ''}
            ${row.scoreAvg != null ? ` · 平均 <b class="num">${row.scoreAvg}</b>` : ''}
            ${row.scoreTotal ? `<span class="muted"> / 满分 ${row.scoreTotal}</span>` : ''}
          </div>`
        : ''
    }
    ${row.notes ? `<div class="pos-notes">${escapeHtml(row.notes)}</div>` : ''}
  </article>`;
}

function trackColor(row) {
  const cat = state.catalogs;
  const track = cat.majorTracks.find((t) => t.key === row.majorTrack);
  return track?.color || '#4B5563';
}

/** 报名数据块：竞争比 + 各环节人数，直接反映上岸难度 */
function applyBlockHtml(row) {
  const cells = [
    { label: '竞争比', value: row.competition != null ? `${row.competition}:1` : null },
    { label: '报名人数', value: row.applicants },
    { label: '过审人数', value: row.approvedCount },
    { label: '缴费人数', value: row.paidCount },
  ].filter((c) => c.value !== null && c.value !== undefined);
  if (!cells.length) return '';
  return `<div class="apply-strip mt-10">
    ${cells
      .map(
        (c) => `<div class="apply-cell">
          <div class="apply-value num">${escapeHtml(String(c.value))}</div>
          <div class="apply-label">${escapeHtml(c.label)}</div>
        </div>`
      )
      .join('')}
  </div>`;
}

/** 捡漏条件核对：五条逐项对错标记，全中才值得报；政法类职位给出政审警告 */
function bargainBlockHtml(row) {
  const bargain = row.bargain || { hit: false, conditions: [] };
  if (!bargain.conditions.length) return '';
  const miss = bargain.conditions.filter((c) => !c.ok).length;
  const conds = bargain.conditions
    .map(
      (c) => `<div class="bargain-cond ${c.ok ? 'is-ok' : 'is-off'}">
        <span class="bargain-cond-mark">${c.ok ? icon('check', { size: 13 }) : icon('close', { size: 13 })}</span>
        <div class="grow">
          <div class="bargain-cond-label">${escapeHtml(c.label)}</div>
          <div class="tiny muted">${escapeHtml(c.hint)}</div>
        </div>
      </div>`
    )
    .join('');
  return `<div class="section-head mt-14">
      <h2 class="section-title">捡漏条件核对</h2>
      <span class="section-hint">${bargain.hit ? '五条全中' : `还差 ${miss} 条`}</span>
    </div>
    <div class="bargain-cond-list">${conds}</div>
    ${
      row.policePosition
        ? `<div class="notice notice-warn mt-10">${icon('alert', { size: 16 })}<div class="grow"><b>公安政法类职位（人民警察）</b>：非公派原因曾六个月以上在国（境）外留学、工作、生活的不得报考（《公安机关录用人民警察政治考察工作办法》公通字〔2020〕11号及各地报考指南口径）。自费留学一年以上基本中招，专业再对口也不构成捡漏。</div></div>`
        : ''
    }`;
}

/* ───────────────── 交互 ───────────────── */

function bind(root) {
  root.querySelectorAll('[data-track]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.track;
      state.majorTrack = state.majorTrack === key ? '' : key;
      await rerender(root);
    });
  });

  root.querySelectorAll('[data-ratio]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.ratio;
      state.ratioType = state.ratioType === key ? '' : key;
      await rerender(root);
    });
  });

  root.querySelectorAll('[data-fresh]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.freshOnly = state.freshOnly === 'true' ? '' : 'true';
      await rerender(root);
    });
  });

  root.querySelectorAll('[data-band]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.band;
      state.bands = state.bands.includes(key) ? state.bands.filter((b) => b !== key) : [...state.bands, key];
      await rerender(root);
    });
  });

  root.querySelectorAll('[data-bargain]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.bargain = state.bargain ? '' : '1';
      await rerender(root);
    });
  });

  root.querySelectorAll('[data-guide]').forEach((btn) => {
    btn.addEventListener('click', () => openBargainSheet());
  });

  root.querySelectorAll('[data-province]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const p = btn.dataset.province;
      state.provinces = state.provinces.includes(p) ? state.provinces.filter((x) => x !== p) : [...state.provinces, p];
      await rerender(root);
    });
  });

  root.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const active =
        state.majorTrack === PRESET.majorTrack &&
        state.ratioType === PRESET.ratioType &&
        state.freshOnly === PRESET.freshOnly &&
        state.bands.includes('lt120');
      if (active) {
        state.majorTrack = '';
        state.ratioType = '';
        state.freshOnly = '';
        state.bands = state.bands.filter((b) => b !== 'lt120');
      } else {
        state.majorTrack = PRESET.majorTrack;
        state.ratioType = PRESET.ratioType;
        state.freshOnly = PRESET.freshOnly;
        if (!state.bands.includes('lt120')) state.bands = [...state.bands, 'lt120'];
      }
      await rerender(root);
    });
  });

  const resetBtn = root.querySelector('[data-reset]');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      resetFilters();
      await rerender(root);
    });
  }

  const emptyReset = root.querySelector('#empty-reset');
  if (emptyReset) {
    emptyReset.addEventListener('click', async () => {
      resetFilters();
      await rerender(root);
    });
  }

  const emptyGuide = root.querySelector('#empty-guide');
  if (emptyGuide) {
    emptyGuide.addEventListener('click', () => openBargainSheet());
  }

  const moreBtn = root.querySelector('[data-open-filter]');
  if (moreBtn) moreBtn.addEventListener('click', () => openFilterSheet(root));

  root.querySelectorAll('.pos-card').forEach((card) => {
    card.addEventListener('click', () => openDetailSheet(card.dataset.id));
  });
}

function resetFilters() {
  state.provinces = [];
  state.examType = '';
  state.majorTrack = '';
  state.ratioType = '';
  state.degree = '';
  state.freshOnly = '';
  state.bands = [];
  state.maxScore = '';
  state.query = '';
  state.bargain = '';
}

async function rerender(root) {
  state.loading = true;
  const main = document.getElementById('app-main');
  if (main) main.innerHTML = shellHtml();
  try {
    await loadList();
  } catch (err) {
    toast(err.message || '加载失败');
  }
  state.loading = false;
  if (main) {
    main.innerHTML = shellHtml();
    bind(main);
  }
}

/* ───────────────── 筛选弹层 ───────────────── */

function openFilterSheet(root) {
  const cat = state.catalogs;
  openSheet({
    title: '筛选与排序',
    subtitle: '组合条件后立即生效',
    content: `
      <div class="filter-group">
        <div class="filter-group-title">考试类型</div>
        <div class="chip-scroll" style="flex-wrap:wrap;overflow:visible">
          <button class="chip tint ${state.examType === '' ? 'is-active' : ''}" data-fexam="">全部</button>
          ${cat.examTypes
            .map((t) => `<button class="chip tint ${state.examType === t.key ? 'is-active' : ''}" data-fexam="${t.key}">${escapeHtml(t.short)}</button>`)
            .join('')}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-group-title">学历层次</div>
        <div class="chip-scroll" style="flex-wrap:wrap;overflow:visible">
          <button class="chip tint ${state.degree === '' ? 'is-active' : ''}" data-fdegree="">全部</button>
          ${cat.degrees
            .map((d) => `<button class="chip tint ${state.degree === d.key ? 'is-active' : ''}" data-fdegree="${d.key}">${escapeHtml(d.name)}</button>`)
            .join('')}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-group-title">上岸分不高于</div>
        <div class="row" style="gap:8px">
          <input class="input num" id="f-maxscore" type="number" min="0" max="300" placeholder="例如 100" value="${escapeHtml(String(state.maxScore))}" />
          <span class="small muted">分</span>
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-group-title">关键词</div>
        <input class="input" id="f-query" placeholder="搜单位 / 岗位 / 专业 / 备注" value="${escapeHtml(state.query)}" />
      </div>
      <div class="filter-group">
        <div class="filter-group-title">排序</div>
        <div class="chip-scroll" style="flex-wrap:wrap;overflow:visible">
          ${cat.sorts
            .map((s) => `<button class="chip tint ${state.sort === s.key ? 'is-active' : ''}" data-fsort="${s.key}">${escapeHtml(s.label)}</button>`)
            .join('')}
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="f-reset">重置</button>
        <button class="btn" id="f-apply">查看结果</button>
      </div>
    `,
    mount(body, close) {
      body.querySelectorAll('[data-fexam]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.examType = btn.dataset.fexam;
          body.querySelectorAll('[data-fexam]').forEach((b) => b.classList.toggle('is-active', b === btn));
        });
      });
      body.querySelectorAll('[data-fdegree]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.degree = btn.dataset.fdegree;
          body.querySelectorAll('[data-fdegree]').forEach((b) => b.classList.toggle('is-active', b === btn));
        });
      });
      body.querySelectorAll('[data-fsort]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.sort = btn.dataset.fsort;
          body.querySelectorAll('[data-fsort]').forEach((b) => b.classList.toggle('is-active', b === btn));
        });
      });
      body.querySelector('#f-reset').addEventListener('click', () => {
        resetFilters();
        close();
        rerender(root);
      });
      body.querySelector('#f-apply').addEventListener('click', () => {
        state.maxScore = body.querySelector('#f-maxscore').value.trim();
        state.query = body.querySelector('#f-query').value.trim();
        close();
        rerender(root);
      });
    },
  });
}

/* ───────────────── 详情弹层 ───────────────── */

async function openDetailSheet(id) {
  let row;
  try {
    row = (await api.position(id)).position;
  } catch (err) {
    toast(err.message || '加载失败');
    return;
  }
  const cat = state.catalogs;
  const track = cat.majorTracks.find((t) => t.key === row.majorTrack);

  openSheet({
    title: row.title,
    subtitle: `${row.province} · ${row.examTypeName} · ${row.year || ''}`,
    content: `
      <div class="detail-hero" style="--accent:${row.examTypeColor}">
        <div class="row">
          <span class="badge" style="background:${row.dataLevelAccent};color:${row.dataLevelColor}">${escapeHtml(row.dataLevelName)}</span>
          ${row.bargain?.hit ? `<span class="badge badge-bargain">${icon('star', { size: 12, className: 'icon icon-sm' })}捡漏</span>` : ''}
          ${row.freshOnly ? '<span class="badge badge-success">仅限应届</span>' : ''}
          <span class="badge badge-outline">${escapeHtml(row.ratioTypeName)}</span>
          ${row.competition ? `<span class="badge badge-outline">竞争比 ${row.competition}:1</span>` : ''}
        </div>
        <div class="countdown-hero">
          <div>
            <div class="countdown-big" style="color:${row.lowScore ? 'var(--ok)' : 'var(--text)'}">${row.scoreMin ?? row.score ?? '—'}</div>
            <div class="countdown-unit">最低进面分 / 满分 ${row.scoreTotal ?? '—'}</div>
          </div>
          <div class="grow small muted">${escapeHtml(row.scoreNote || '')}</div>
        </div>
      </div>

      ${applyBlockHtml(row)}
      ${bargainBlockHtml(row)}

      <div class="section-head mt-14">
        <h2 class="section-title">进面分数线</h2>
        <span class="section-hint">最低 / 最高 / 平均</span>
      </div>
      <div class="score-triple">
        <div class="score-cell is-key">
          <div class="score-value num">${row.scoreMin ?? '—'}</div>
          <div class="score-label">最低进面分数</div>
        </div>
        <div class="score-cell">
          <div class="score-value num">${row.scoreMax ?? '—'}</div>
          <div class="score-label">最高进面分数</div>
        </div>
        <div class="score-cell">
          <div class="score-value num">${row.scoreAvg ?? '—'}</div>
          <div class="score-label">平均进面分数</div>
        </div>
      </div>
      ${
        row.dataUpdatedAt || row.dataSource
          ? `<div class="score-meta">
              更新时间 <span class="num">${escapeHtml(row.dataUpdatedAt || '—')}</span>
              ${row.dataSource ? ` · 数据来源 ${escapeHtml(row.dataSource)}` : ''}
            </div>`
          : ''
      }
      ${
        row.scoreMin != null && row.scoreTotal
          ? `<div class="notice notice-info mt-10">${icon('info', { size: 16 })}<div class="grow">最低进面分 ${row.scoreMin} / 满分 ${row.scoreTotal}，即笔试拿到满分的 ${Math.round((row.scoreMin / row.scoreTotal) * 100)}% 就能进面。${
              row.scoreMax != null && row.scoreMax > row.scoreMin
                ? ` 分差 ${(row.scoreMax - row.scoreMin).toFixed(2)} 分（最高与最低进面分之差），分差越小说明进面同学分数越集中、压线进面越难。`
                : ''
            }</div></div>`
          : ''
      }

      <div class="kv-list mt-14">
        <div class="kv"><div class="kv-key">招录单位</div><div class="kv-val">${escapeHtml(row.unit)}</div></div>
        <div class="kv"><div class="kv-key">职位代码</div><div class="kv-val num">${escapeHtml(row.positionCode || '—')}</div></div>
        <div class="kv"><div class="kv-key">专业方向</div><div class="kv-val">${escapeHtml(row.majorText || row.majorTrackName)}</div></div>
        <div class="kv"><div class="kv-key">专业通道</div><div class="kv-val">${escapeHtml(track?.name || row.majorTrackName)}<div class="tiny muted mt-6">${escapeHtml(track?.desc || '')}</div></div></div>
        <div class="kv"><div class="kv-key">学历层次</div><div class="kv-val">${escapeHtml(row.degreeName)}</div></div>
        <div class="kv"><div class="kv-key">开考比例</div><div class="kv-val">${escapeHtml(row.ratioText || row.ratioTypeName)}</div></div>
        <div class="kv"><div class="kv-key">应届要求</div><div class="kv-val">${row.freshOnly ? '仅限应届高校毕业生' : '不限应届'}</div></div>
        ${row.policePosition ? '<div class="kv"><div class="kv-key">职位性质</div><div class="kv-val">公安政法类（人民警察）<div class="tiny muted mt-6">留学生政审禁入：非公派原因曾六个月以上在国（境）外留学、工作、生活的不得报考</div></div></div>' : ''}
        <div class="kv"><div class="kv-key">数据级别</div><div class="kv-val">${escapeHtml(cat.dataLevels.find((d) => d.key === row.dataLevel)?.desc || '')}</div></div>
      </div>

      ${row.notes ? `<div class="note-box mt-10">${escapeHtml(row.notes)}</div>` : ''}

      ${
        row.dataLevel === 'sample'
          ? `<div class="notice notice-warn mt-10">${icon('alert', { size: 16 })}<div class="grow">这一行是<b>示例数据</b>，单位与分数均为演示构造值，请以官方职位表为准。</div></div>`
          : row.dataLevel === 'thirdparty'
            ? `<div class="notice notice-warn mt-10">${icon('alert', { size: 16 })}<div class="grow">这一行来自<b>第三方平台整理</b>的报名与进面数据，通常溯源到官方公告；报考前请以官方职位表复核。</div></div>`
            : ''
      }

      ${
        row.sourceUrl
          ? `<a class="btn btn-ghost btn-block mt-10" href="${escapeHtml(row.sourceUrl)}" target="_blank" rel="noopener">
              ${icon('external', { size: 16 })}打开来源公告
            </a>`
          : ''
      }

      ${
        row.editable
          ? `<div class="btn-row mt-10">
              <button class="btn btn-ghost" id="pos-edit">编辑</button>
              <button class="btn btn-danger-ghost" id="pos-del">删除</button>
            </div>`
          : `<div class="notice notice-info mt-10">${icon('lock', { size: 16 })}<div class="grow">公共岗位不可修改，可点「录入岗位」复制为你自己的一条再调整。</div></div>`
      }
    `,
    mount(body, close) {
      const editBtn = body.querySelector('#pos-edit');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          close();
          openEditorSheet(row);
        });
      }
      const delBtn = body.querySelector('#pos-del');
      if (delBtn) {
        delBtn.addEventListener('click', async () => {
          const yes = await confirmDialog({
            title: '删除这条岗位？',
            message: `「${row.province} · ${row.title}」将被删除，且无法恢复。`,
            confirmText: '删除',
            danger: true,
          });
          if (!yes) return;
          try {
            await api.deletePosition(row.id);
            toastOk('已删除');
            close();
            rerender(document.getElementById('app-main'));
          } catch (err) {
            toast(err.message || '删除失败');
          }
        });
      }
    },
  });
}

/* ───────────────── 录入 / 编辑弹层 ───────────────── */

function openEditorSheet(existing = null) {
  if (!session.isAuthenticated) {
    toast('请先登录后再录入岗位');
    window.location.hash = '/login';
    return;
  }
  const cat = state.catalogs;
  const v = existing || {};

  openSheet({
    title: existing ? '编辑岗位' : '录入岗位',
    subtitle: existing ? '修改后立即生效' : '从官方职位表里挑出来的岗位，录进来就能跟着筛选',
    content: `
      <div class="field">
        <div class="field-label">省份<span class="req">*</span></div>
        <select class="select" id="p-province">
          ${cat.provinces.map((p) => `<option value="${escapeHtml(p)}" ${v.province === p ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <div class="field-label">考试类型<span class="req">*</span></div>
        <select class="select" id="p-examtype">
          ${cat.examTypes
            .map((t) => `<option value="${t.key}" ${v.examType === t.key ? 'selected' : ''}>${escapeHtml(t.name)}</option>`)
            .join('')}
        </select>
      </div>
      <div class="field-row">
        <div class="field grow">
          <div class="field-label">招录单位<span class="req">*</span></div>
          <input class="input" id="p-unit" placeholder="如：崇左市凭祥市某乡镇机关" value="${escapeHtml(v.unit || '')}" />
        </div>
        <div class="field grow">
          <div class="field-label">年度</div>
          <input class="input num" id="p-year" type="number" min="2000" max="2100" placeholder="2026" value="${escapeHtml(String(v.year || ''))}" />
        </div>
      </div>
      <div class="field">
        <div class="field-label">岗位名称<span class="req">*</span></div>
        <input class="input" id="p-title" placeholder="如：乡镇综合管理岗" value="${escapeHtml(v.title || '')}" />
      </div>
      <div class="field">
        <div class="field-label">职位代码</div>
        <input class="input num" id="p-code" placeholder="选填" value="${escapeHtml(v.positionCode || '')}" />
      </div>
      <div class="field">
        <div class="field-label">专业通道<span class="req">*</span></div>
        <div class="cat-picker">
          ${cat.majorTracks
            .map(
              (t) =>
                `<button type="button" class="cat-option ${(v.majorTrack || 'cs0812') === t.key ? 'is-active' : ''}" data-pick-track="${t.key}">
                  <span class="swatch" style="background:${t.color}"></span>${escapeHtml(t.short)}
                </button>`
            )
            .join('')}
        </div>
        <div class="field-hint mt-6">留学生最稳的两条通道：留服专业复核到「计算机科学与技术（0812）」，或直接报「硕士不限专业」。</div>
      </div>
      <div class="field">
        <div class="field-label">专业要求原文</div>
        <input class="input" id="p-majortext" placeholder="如：计算机科学与技术（0812）" value="${escapeHtml(v.majorText || '')}" />
      </div>
      <div class="field-row">
        <div class="field grow">
          <div class="field-label">学历层次</div>
          <select class="select" id="p-degree">
            ${cat.degrees
              .map((d) => `<option value="${d.key}" ${(v.degree || 'master') === d.key ? 'selected' : ''}>${escapeHtml(d.name)}</option>`)
              .join('')}
          </select>
        </div>
        <div class="field grow">
          <div class="field-label">开考比例<span class="req">*</span></div>
          <select class="select" id="p-ratio">
            ${cat.ratioTypes
              .map((r) => `<option value="${r.key}" ${(v.ratioType || 'none') === r.key ? 'selected' : ''}>${escapeHtml(r.name)}</option>`)
              .join('')}
          </select>
        </div>
      </div>
      <div class="field">
        <div class="field-label">开考比例说明</div>
        <input class="input" id="p-ratiotext" placeholder="如：艰苦边远地区职位按实际缴费人数开考" value="${escapeHtml(v.ratioText || '')}" />
      </div>
      <div class="field-row">
        <div class="field grow">
          <div class="field-label">最低进面分<span class="req">*</span></div>
          <input class="input num" id="p-scoremin" type="number" min="0" max="300" step="0.01" placeholder="如 53.35" value="${v.scoreMin ?? v.score ?? ''}" />
        </div>
        <div class="field grow">
          <div class="field-label">满分</div>
          <input class="input num" id="p-total" type="number" min="0" max="300" placeholder="200" value="${v.scoreTotal ?? 200}" />
        </div>
      </div>
      <div class="field-row">
        <div class="field grow">
          <div class="field-label">最高进面分</div>
          <input class="input num" id="p-scoremax" type="number" min="0" max="300" step="0.01" placeholder="如 65.5" value="${v.scoreMax ?? ''}" />
        </div>
        <div class="field grow">
          <div class="field-label">平均进面分</div>
          <input class="input num" id="p-scoreavg" type="number" min="0" max="300" step="0.01" placeholder="如 58.2" value="${v.scoreAvg ?? ''}" />
        </div>
      </div>
      <div class="field">
        <div class="field-label">分数构成 / 说明</div>
        <input class="input" id="p-scorenote" placeholder="如：行测 100 + 申论 100；本考试平均进面分 63.6" value="${escapeHtml(v.scoreNote || '')}" />
      </div>
      <div class="field">
        <div class="field-label">报名数据<span class="tiny muted" style="font-weight:400">（选填，公考雷达等平台可查）</span></div>
        <div class="field-row">
          <div class="field grow">
            <div class="field-label">竞争比</div>
            <input class="input num" id="p-competition" type="number" min="0" max="99999" step="0.1" placeholder="如 39" value="${v.competition ?? ''}" />
          </div>
          <div class="field grow">
            <div class="field-label">报名人数</div>
            <input class="input num" id="p-applicants" type="number" min="0" placeholder="如 120" value="${v.applicants ?? ''}" />
          </div>
        </div>
        <div class="field-row">
          <div class="field grow">
            <div class="field-label">过审人数</div>
            <input class="input num" id="p-approved" type="number" min="0" placeholder="如 98" value="${v.approvedCount ?? ''}" />
          </div>
          <div class="field grow">
            <div class="field-label">缴费人数</div>
            <input class="input num" id="p-paid" type="number" min="0" placeholder="如 86" value="${v.paidCount ?? ''}" />
          </div>
        </div>
        <div class="field-row">
          <div class="field grow">
            <div class="field-label">数据来源</div>
            <input class="input" id="p-datasource" placeholder="如：省人事考试网 / 公考雷达" value="${escapeHtml(v.dataSource || '')}" />
          </div>
          <div class="field grow">
            <div class="field-label">数据更新日期</div>
            <input class="input num" id="p-dataupdated" placeholder="YYYY-MM-DD" value="${escapeHtml((v.dataUpdatedAt || '').slice(0, 10))}" />
          </div>
        </div>
      </div>
      <div class="field">
        <label class="row" style="gap:8px;cursor:pointer">
          <input type="checkbox" id="p-fresh" ${v.freshOnly ? 'checked' : ''} />
          <span class="small">仅限应届高校毕业生</span>
        </label>
      </div>
      <div class="field">
        <label class="row" style="gap:8px;cursor:pointer">
          <input type="checkbox" id="p-police" ${v.policePosition ? 'checked' : ''} />
          <span class="small">公安政法类职位（边检 / 缉私 / 移民 / 监狱 / 司法警察等人民警察职位）</span>
        </label>
        <div class="field-hint mt-6">人民警察职位对留学生有禁入条款：非公派原因曾六个月以上在国（境）外留学、工作、生活的不得报考。勾选后捡漏判定会自动把它标为留学生不宜报。</div>
      </div>
      <div class="field">
        <div class="field-label">来源链接</div>
        <input class="input" id="p-url" placeholder="公告或职位表链接" value="${escapeHtml(v.sourceUrl || '')}" />
      </div>
      <div class="field">
        <div class="field-label">备注</div>
        <textarea class="textarea" id="p-notes" placeholder="为什么这个岗位适合你、要注意什么">${escapeHtml(v.notes || '')}</textarea>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="p-cancel">取消</button>
        <button class="btn" id="p-save">${existing ? '保存' : '录入'}</button>
      </div>
    `,
    mount(body, close) {
      let pickedTrack = v.majorTrack || 'cs0812';
      body.querySelectorAll('[data-pick-track]').forEach((btn) => {
        btn.addEventListener('click', () => {
          pickedTrack = btn.dataset.pickTrack;
          body.querySelectorAll('[data-pick-track]').forEach((b) => b.classList.toggle('is-active', b === btn));
        });
      });

      body.querySelector('#p-cancel').addEventListener('click', close);

      body.querySelector('#p-save').addEventListener('click', async () => {
        const payload = {
          province: body.querySelector('#p-province').value,
          examType: body.querySelector('#p-examtype').value,
          year: body.querySelector('#p-year').value,
          unit: body.querySelector('#p-unit').value.trim(),
          title: body.querySelector('#p-title').value.trim(),
          positionCode: body.querySelector('#p-code').value.trim(),
          majorTrack: pickedTrack,
          majorText: body.querySelector('#p-majortext').value.trim(),
          degree: body.querySelector('#p-degree').value,
          freshOnly: body.querySelector('#p-fresh').checked,
          policePosition: body.querySelector('#p-police').checked,
          ratioType: body.querySelector('#p-ratio').value,
          ratioText: body.querySelector('#p-ratiotext').value.trim(),
          // score 字段是旧版单值口径，现在统一以 scoreMin 为权威，显式置空避免旧值遮挡
          score: null,
          scoreMin: body.querySelector('#p-scoremin').value,
          scoreMax: body.querySelector('#p-scoremax').value,
          scoreAvg: body.querySelector('#p-scoreavg').value,
          scoreTotal: body.querySelector('#p-total').value,
          scoreNote: body.querySelector('#p-scorenote').value.trim(),
          competition: body.querySelector('#p-competition').value,
          applicants: body.querySelector('#p-applicants').value,
          approvedCount: body.querySelector('#p-approved').value,
          paidCount: body.querySelector('#p-paid').value,
          dataSource: body.querySelector('#p-datasource').value.trim(),
          dataUpdatedAt: body.querySelector('#p-dataupdated').value.trim(),
          sourceUrl: body.querySelector('#p-url').value.trim(),
          notes: body.querySelector('#p-notes').value.trim(),
        };
        if (!payload.unit || !payload.title) {
          toast('招录单位和岗位名称不能为空');
          return;
        }
        if (payload.scoreMin === '') {
          toast('最低进面分不能为空，它是筛选和排序的核心口径');
          return;
        }
        const scoreMinNum = Number.parseFloat(payload.scoreMin);
        if (!Number.isFinite(scoreMinNum) || scoreMinNum < 0) {
          toast('最低进面分必须是非负数字');
          return;
        }
        if (payload.scoreMax !== '' && Number.parseFloat(payload.scoreMax) < scoreMinNum) {
          toast('最高进面分不能低于最低进面分');
          return;
        }
        try {
          if (existing) await api.updatePosition(existing.id, payload);
          else await api.createPosition(payload);
          toastOk(existing ? '已保存' : '已录入');
          close();
          rerender(document.getElementById('app-main'));
        } catch (err) {
          toast(err.message || '保存失败');
        }
      });
    },
  });
}

/* ───────────────── 捡漏攻略弹层 ───────────────── */

function openBargainSheet() {
  const guide = state.catalogs?.bargainGuide;
  if (!guide) {
    toast('攻略数据加载中，请稍后重试');
    return;
  }
  const { window: win, conditions, policeBar, noResume, zeroTip } = guide;

  openSheet({
    title: '捡漏攻略',
    subtitle: '没人报 + 我能报 + 考得起，三条同时成立才叫捡漏',
    content: `
      <div class="notice notice-info">${icon('info', { size: 16 })}<div class="grow">${escapeHtml(guide.intro)}</div></div>

      <div class="filter-group mt-14">
        <div class="filter-group-title">一、实时报名窗口（${escapeHtml(win.title)}）</div>
        <div class="kv-list">
          <div class="kv"><div class="kv-key">报名开始</div><div class="kv-val num">${escapeHtml(win.registerStart)}</div></div>
          <div class="kv"><div class="kv-key">报名截止</div><div class="kv-val num">${escapeHtml(win.registerEnd)}</div></div>
          <div class="kv"><div class="kv-key">注册认证截止</div><div class="kv-val num">${escapeHtml(win.authDeadline)}</div></div>
          <div class="kv"><div class="kv-key">笔试</div><div class="kv-val num">${escapeHtml(win.examDate)}</div></div>
          <div class="kv"><div class="kv-key">招录规模</div><div class="kv-val">${escapeHtml(win.planTotal)} · ${escapeHtml(win.planFresh)}</div></div>
          <div class="kv"><div class="kv-key">年龄口径</div><div class="kv-val">${escapeHtml(win.ageRule)}</div></div>
          <div class="kv"><div class="kv-key">基层经历</div><div class="kv-val">${escapeHtml(win.baseRule)}</div></div>
        </div>
        <div class="notice notice-warn mt-10">${icon('alert', { size: 16 })}<div class="grow">${escapeHtml(win.authNote)}。</div></div>
        <a class="link-out small" href="${escapeHtml(win.sourceUrl)}" target="_blank" rel="noopener">
          ${icon('external', { size: 13, className: 'icon icon-sm' })}${escapeHtml(win.sourceName)}
        </a>
      </div>

      <div class="filter-group">
        <div class="filter-group-title">二、捡漏五条件（本应用的判定口径）</div>
        <ul class="policy-list">
          ${conditions.map((c, i) => `<li><b>${i + 1}. ${escapeHtml(c.label)}</b>——${escapeHtml(c.hint)}</li>`).join('')}
        </ul>
        <div class="small muted mt-6">五条全中才会被「圈出来」；详情页逐条展示对错标记，差几条一目了然。</div>
      </div>

      <div class="filter-group">
        <div class="filter-group-title">三、${escapeHtml(policeBar.title)}</div>
        <div class="note-box">${escapeHtml(policeBar.quote)}</div>
        <ul class="policy-list mt-6">
          ${policeBar.points.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
        <div class="tiny muted mt-6">适用范围：${escapeHtml(policeBar.scope)}</div>
        <a class="link-out small" href="${escapeHtml(policeBar.sourceUrl)}" target="_blank" rel="noopener">
          ${icon('external', { size: 13, className: 'icon icon-sm' })}${escapeHtml(policeBar.sourceName)}
        </a>
      </div>

      <div class="filter-group">
        <div class="filter-group-title">四、${escapeHtml(noResume.title)}</div>
        <ul class="policy-list">
          ${noResume.points.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
        <a class="link-out small" href="${escapeHtml(noResume.sourceUrl)}" target="_blank" rel="noopener">
          ${icon('external', { size: 13, className: 'icon icon-sm' })}${escapeHtml(noResume.sourceName)}
        </a>
      </div>

      <div class="filter-group">
        <div class="filter-group-title">五、${escapeHtml(zeroTip.title)}</div>
        <div class="note-box">${escapeHtml(zeroTip.stats)}</div>
        <ul class="policy-list mt-6">
          ${zeroTip.lessons.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
        <a class="link-out small" href="${escapeHtml(zeroTip.sourceUrl)}" target="_blank" rel="noopener">
          ${icon('external', { size: 13, className: 'icon icon-sm' })}${escapeHtml(zeroTip.sourceName)}
        </a>
      </div>

      <div class="filter-group">
        <div class="filter-group-title">六、报名窗口内怎么盯</div>
        <ul class="policy-list">
          ${win.trackTips.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
      </div>
    `,
  });
}

/* ───────────────── 政策依据弹层 ───────────────── */

async function openPolicySheet() {
  let data;
  try {
    data = await api.positionPolicies();
  } catch (err) {
    toast(err.message || '政策数据加载失败');
    return;
  }

  const { guokaoScoreLines, guokaoSubjectLine, returneePolicy, hardshipPolicy, provincePolicies, disclaimer } = data;

  openSheet({
    title: '政策依据',
    subtitle: '全部来自官方公告原文，可点开来源核对',
    content: `
      <div class="filter-group">
        <div class="filter-group-title">一、留学回国人员报考资格（国考口径）</div>
        <div class="note-box">${escapeHtml(returneePolicy.quote)}</div>
        <ul class="policy-list mt-6">
          ${returneePolicy.requirements.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}
        </ul>
        <a class="link-out small" href="${escapeHtml(returneePolicy.sourceUrl)}" target="_blank" rel="noopener">
          ${icon('external', { size: 13, className: 'icon icon-sm' })}${escapeHtml(returneePolicy.sourceName)}
        </a>
      </div>

      <div class="filter-group">
        <div class="filter-group-title">二、国考笔试合格分数线（2026 年度）</div>
        <div class="kv-list">
          ${guokaoScoreLines
            .map(
              (l) => `<div class="kv">
                <div class="kv-key" style="width:96px">总分 ${l.total}</div>
                <div class="kv-val">${escapeHtml(l.scope)}<div class="tiny muted">${escapeHtml(l.subName)}不低于 ${l.sub} 分</div></div>
              </div>`
            )
            .join('')}
        </div>
        <div class="small muted mt-6">另有专业科目笔试合格线 ${guokaoSubjectLine.total} 分（${escapeHtml(guokaoSubjectLine.note)}）。</div>
        <div class="small muted mt-6">国考笔试满分 200（行测 100 + 申论 100）——三档合格线全部低于 120 分，这就是「低于 120 分上岸」的官方依据。</div>
      </div>

      <div class="filter-group">
        <div class="filter-group-title">三、艰苦边远地区倾斜（低分上岸的核心通道）</div>
        <ul class="policy-list">
          ${hardshipPolicy.points.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
      </div>

      <div class="filter-group">
        <div class="filter-group-title">四、分省开考比例（已核对官方公告）</div>
        ${provincePolicies
          .map(
            (p) => `<div class="policy-card">
              <div class="row">
                <b>${escapeHtml(p.province)}</b>
                <span class="badge ${p.ratio === 'none' ? 'badge-success' : 'badge-outline'}">${p.ratio === 'none' ? '有不设比例情形' : '设有比例'}</span>
              </div>
              <div class="small mt-6">${escapeHtml(p.ratioText)}</div>
              <div class="tiny muted mt-6">合格线：${escapeHtml(p.scoreLine)}</div>
              <div class="tiny muted">应届口径：${escapeHtml(p.freshRule)}</div>
              <a class="link-out tiny" href="${escapeHtml(p.sourceUrl)}" target="_blank" rel="noopener">
                ${icon('external', { size: 12, className: 'icon icon-sm' })}${escapeHtml(p.sourceName)}（核对于 ${escapeHtml(p.verifiedOn)}）
              </a>
            </div>`
          )
          .join('')}
        <div class="notice notice-info mt-10">${icon('info', { size: 16 })}<div class="grow">${escapeHtml(disclaimer)}</div></div>
      </div>

      <div class="filter-group">
        <div class="filter-group-title">五、留学生专业名称怎么对上 0812</div>
        <ul class="policy-list">
          <li>留服认证书按境外原名<b>写实性描述</b>，不与国内学科目录做对应认证——专业名对不上是常态，不是个例。</li>
          <li>认证通过后 <b>12 个月内</b>可申请 <b>1 次</b>专业复核，按大陆学科目录最低一级申报（如「人工智能与 XX」→「计算机科学与技术」）。</li>
          <li>复核材料：课程描述 Course Description + 国内相近专业培养方案 + 逐项课程对比表 + 目标岗位专业要求截图。</li>
          <li>被系统初筛退回时，可直接联系招录单位申请人工审核，附认证书与课程对比表。</li>
        </ul>
      </div>
    `,
  });
}
