/**
 * 岗位库页 · 留学生友好岗位
 *
 * 回答五个问题：
 *   1) 哪些省我能报？        —— 省份筛选 + 分省政策基线
 *   2) 哪些方向我能报？      —— 计算机科学与技术（0812）/ 硕士不限专业
 *   3) 哪里分数低好上岸？    —— 不设开考比例 + 仅限应届 + 上岸分 50 多分或低于 120 分
 *   4) 哪里能捡漏？          —— 捡漏栏目：无人报考 + 不设开考比例 + 我能报 + 政审安全，五条全中才圈出来
 *   5) 哪里能准捡漏？        —— 准捡漏栏目：报名≈招录 + 有进面分 + 专业可报 + 学历可报 + 政审安全，
 *                             另标「无进面比 / 应届进面 / 分数持平」三条附加标记
 *
 * 分数口径：进面分必须带「口径」（总分 / 两科平均），并与官方合格线换算比对——
 * 「200 分考 53.35」是口径误读（平均分口径 × 2 = 总分 106.7），详情页显式校准。
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
  nearBargain: '',
  lowApply: '',
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
        { key: 'best', icon: 'award', label: '最佳推荐', onClick: () => openBestRecommendSheet() },
        { key: 'archive', icon: 'calendar', label: '历年公告', onClick: () => openAnnouncementSheet() },
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
  if (state.nearBargain) params.nearBargain = '1';
  if (state.lowApply) params.lowApply = '1';

  const data = await api.positions(params);
  state.rows = data.positions;
  state.stats = data.stats;
}

/* ───────────────── 视图 ───────────────── */

function shellHtml() {
  return `
    ${statsHtml()}
    ${bestBannerHtml()}
    ${archiveBannerHtml()}
    ${filterHtml()}
    ${noticeHtml()}
    <div id="pos-list">${listHtml()}</div>
  `;
}

/**
 * 「最佳推荐区域」入口横幅。
 * 常驻在筛选器上方：一句话给出结论（国考已出、招 35691 人、推荐 5 省 6 类岗位），
 * 点击进弹层看完整推导链。不放具体数字堆叠，避免和下方列表抢注意力。
 */
function bestBannerHtml() {
  const br = state.catalogs?.bestRecommend;
  if (!br) return '';
  const gk = br.blocks.find((b) => b.key === 'guokao');
  const regions = (gk?.regions || []).slice(0, 3).map((r) => r.region).join(' / ');
  const posts = (gk?.posts || []).slice(0, 2).map((p) => p.name.split('（')[0]).join(' / ');
  return `<button class="best-banner mt-10" data-best="1">
    <span class="best-banner-icon">${icon('award', { size: 18 })}</span>
    <span class="best-banner-body">
      <span class="best-banner-title">最佳推荐区域 · 今年国考已出，考哪里最划算</span>
      <span class="best-banner-line">推荐地区：${escapeHtml(regions)} … · 推荐岗位：${escapeHtml(posts)} …</span>
      <span class="best-banner-line">另含省考预测与其他 12 类考试时间安排 · 每条都标了数据级别与来源</span>
    </span>
    ${icon('chevronRight', { size: 16, className: 'icon icon-sm' })}
  </button>`;
}

/**
 * 「历年公告」入口横幅。
 * 与上方最佳推荐横幅并列：那边答「今年报哪里」，这边答「往年什么时候发、什么时候考」。
 * 只讲「已经发生过的公告原文」，不做任何预测，避免和预测类内容混在一起被当成承诺。
 */
function archiveBannerHtml() {
  const arc = state.catalogs?.announcementArchive;
  if (!arc?.groups?.length) return '';
  const items = arc.groups.flatMap((g) => g.items || []);
  const years = [...new Set(items.map((i) => i.year))].sort();
  const yearText = years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : `${years[0] ?? ''}`;
  const kinds = arc.groups.slice(0, 4).map((g) => g.short || g.name).join(' / ');
  return `<button class="best-banner is-archive mt-10" data-archive="1">
    <span class="best-banner-icon">${icon('calendar', { size: 18 })}</span>
    <span class="best-banner-body">
      <span class="best-banner-title">历年公告 · ${items.length} 份往年原文（${escapeHtml(yearText)}）</span>
      <span class="best-banner-line">${escapeHtml(kinds)} … · 公告发布 / 报名 / 笔试的日期逐年对照</span>
      <span class="best-banner-line">只收已发布过的公告，每条都能点进原文核对 · 不预测未来</span>
    </span>
    ${icon('chevronRight', { size: 16, className: 'icon icon-sm' })}
  </button>`;
}

function statsHtml() {
  const s = state.stats || {
    total: 0, lowScore: 0, noRatio: 0, freshOnly: 0, provinces: 0,
    bargain: 0, zeroApply: 0, nearBargain: 0, nearPartial: 0, lowApply: 0,
  };
  return `<div class="stat-strip">
    <div class="stat-cell"><div class="stat-value">${s.total}</div><div class="stat-label">岗位</div></div>
    <div class="stat-cell"><div class="stat-value is-soon">${s.lowScore}</div><div class="stat-label">低分上岸</div></div>
    <div class="stat-cell"><div class="stat-value is-ok">${s.noRatio}</div><div class="stat-label">不设比例</div></div>
    <div class="stat-cell"><div class="stat-value">${s.freshOnly}</div><div class="stat-label">仅限应届</div></div>
    <div class="stat-cell"><div class="stat-value is-bargain">${s.bargain ?? 0}</div><div class="stat-label">捡漏命中</div></div>
    <div class="stat-cell"><div class="stat-value is-near">${s.nearBargain ?? 0}</div><div class="stat-label">准捡漏</div></div>
    <div class="stat-cell"><div class="stat-value is-soon">${s.lowApply ?? 0}</div><div class="stat-label">低报名</div></div>
    <div class="stat-cell"><div class="stat-value">${s.provinces}</div><div class="stat-label">覆盖省份</div></div>
  </div>`;
}

function filterHtml() {
  const cat = state.catalogs;
  return `
    <div class="chip-scroll mt-10">
      <button class="chip chip-best" data-best="1">
        ${icon('award', { size: 13, className: 'icon icon-sm' })}最佳推荐
      </button>
      <button class="chip chip-bargain ${state.bargain ? 'is-active' : ''}" data-bargain="1">
        ${icon('star', { size: 13, className: 'icon icon-sm' })}捡漏专区
      </button>
      <button class="chip chip-near ${state.nearBargain ? 'is-active' : ''}" data-near="1">
        ${icon('checkCircle', { size: 13, className: 'icon icon-sm' })}准捡漏专区
      </button>
      <button class="chip ${state.lowApply ? 'is-active' : ''}" data-lowapply="1">
        ${icon('users', { size: 13, className: 'icon icon-sm' })}低报名专区
      </button>
      <button class="chip" data-guide="1">${icon('signpost', { size: 13, className: 'icon icon-sm' })}捡漏攻略</button>
      <button class="chip chip-hukou" data-hukou="1">${icon('globe', { size: 13, className: 'icon icon-sm' })}外地可考</button>
      <button class="chip chip-cold" data-cold="1">${icon('briefcase', { size: 13, className: 'icon icon-sm' })}冷门统考</button>
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
    Boolean(state.bargain) ||
    Boolean(state.nearBargain) ||
    Boolean(state.lowApply)
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
    if (state.nearBargain) {
      return emptyState({
        iconName: 'checkCircle',
        title: '当前没有命中准捡漏的岗位',
        desc: '准捡漏 = 报名≈招录 + 有进面分 + 专业可报 + 学历可报 + 政审安全；命中后会额外标注「无进面比 / 应届进面 / 分数持平」。低报名岗位集中在三支一扶、社区工作者、西部计划与人才引进——点「捡漏攻略」看这些考试的开考比例口径。',
        actionLabel: '打开捡漏攻略',
        actionId: 'empty-guide',
      });
    }
    if (state.lowApply) {
      return emptyState({
        iconName: 'users',
        title: '当前没有低报名岗位',
        desc: '低报名 = 报名/缴费人数不超过招录人数的 1.5 倍（或仅多两三个人）。这类岗位多数来自三支一扶、社区工作者等「未达开考比例被取消/核减」的公告，录进来即可自动命中。',
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
  const banners = [];
  if (state.bargain) {
    banners.push(
      `<div class="bargain-banner mt-10">${icon('star', { size: 14 })}<div class="grow">捡漏专区：以下岗位五条件全中（无人报考 + 不设开考比例 + 专业对口 + 学历达标 + 政审安全）。数据截至各行的「数据更新日期」，报名窗口内请每日回官方渠道复核。</div></div>`
    );
  }
  if (state.nearBargain) {
    const hit = state.stats?.nearBargain ?? 0;
    const part = state.stats?.nearPartial ?? 0;
    banners.push(
      `<div class="nearbargain-banner mt-10">${icon('checkCircle', { size: 14 })}<div class="grow">准捡漏专区：<b>命中 ${hit} 条</b>（五条全中）+ <b>接近 ${part} 条</b>（低竞争 + 学历可报 + 政审安全已成立，只差逐条核对专业通道）。卡片上另标「无进面比 / 应届进面 / 分数持平」，命中亮起、缺失显示「未标记」。</div></div>`
    );
  }
  if (state.lowApply) {
    banners.push(
      `<div class="lowapply-banner mt-10">${icon('users', { size: 14 })}<div class="grow">低报名专区：报名人数不超过招录人数的 1.5 倍（或仅多两三个人）。报名人数缺失时按「竞争比 × 招录人数 → 过审 → 缴费」的顺序退用，口径会标在详情页。<b>保守口径</b>：只要行内任一可得的人数超出上限，就不算低报名——宁可少报，也不拿矛盾的数字凑数。</div></div>`
    );
  }
  // 条数口径：接口返回的 stats.total 才是命中总数，state.rows 只是本页拿到的前 N 条
  // （单页上限 100）。种子库有几百行时两者会不一样，必须分开写清楚，否则「共 100 条」
  // 会被当成「只有 100 个岗位」。
  const total = state.stats?.total ?? state.rows.length;
  const shown = state.rows.length;
  const pageHint = total > shown ? `（当前显示前 ${shown} 条，用筛选把范围缩小）` : '';
  return `<div class="small muted" style="margin:2px 0 8px">共 ${total} 条${pageHint} · ${sortLabel}</div>
    ${banners.join('')}
    <div class="card-list">${state.rows.map(cardHtml).join('')}</div>`;
}

function skeleton() {
  return `<div class="card-list">${[1, 2, 3].map(() => '<div class="skeleton sk-card"></div>').join('')}</div>`;
}

function cardHtml(row) {
  const bands = row.scoreBands || [];
  const hasMax = row.scoreMax != null;
  const bargain = row.bargain || { hit: false };
  const near = row.nearBargain || { hit: false, partial: false, marks: [] };
  const cls = [bargain.hit ? 'is-bargain' : '', near.hit ? 'is-nearbargain' : ''].filter(Boolean).join(' ');
  return `<article class="pos-card ${cls}" data-id="${row.id}">
    <div class="pos-head">
      <span class="pos-province">${escapeHtml(row.province)}</span>
      ${bargain.hit ? `<span class="bargain-badge">${icon('star', { size: 12, className: 'icon icon-sm' })}捡漏</span>` : ''}
      ${near.hit ? `<span class="nearbargain-badge">${icon('checkCircle', { size: 12, className: 'icon icon-sm' })}准捡漏</span>` : ''}
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
      ${row.scoreBasis === 'avg100' ? '<span class="pos-tag is-plain">平均分口径</span>' : ''}
      ${bands.includes('low50') ? '<span class="pos-tag is-low">50 多分</span>' : ''}
      ${bands.includes('lt120') ? '<span class="pos-tag is-low">低于 120 分</span>' : ''}
      ${row.applicants === 0 ? '<span class="pos-tag is-zero">零报名</span>' : ''}
      ${row.lowApply ? '<span class="pos-tag is-lowapply">低报名</span>' : ''}
      ${row.ratioShortfall ? '<span class="pos-tag is-lowapply">未达开考比例</span>' : ''}
      ${(row.dataIssues || []).length ? '<span class="pos-tag is-belowline">报名数据待核验</span>' : ''}
      ${row.policePosition ? '<span class="pos-tag is-police">政法类 · 留学生禁入</span>' : ''}
      ${row.belowOfficialLine ? '<span class="pos-tag is-belowline">低于官方线 · 待核验</span>' : ''}
      ${row.competition ? `<span class="pos-tag is-plain">竞争比 ${row.competition}:1</span>` : ''}
    </div>
    ${
      hasMax || row.scoreAvg != null
        ? `<div class="pos-scoreline">
            最低 <b class="num">${row.scoreMin ?? '—'}</b>
            ${hasMax ? ` · 最高 <b class="num">${row.scoreMax}</b>` : ''}
            ${row.scoreAvg != null ? ` · 平均 <b class="num">${row.scoreAvg}</b>` : ''}
            ${row.scoreTotal ? `<span class="muted"> / 满分 ${row.scoreTotal}</span>` : ''}
            ${row.officialScoreLine != null ? `<span class="muted"> · 官方合格线 <b class="num">${row.officialScoreLine}</b></span>` : ''}
          </div>`
        : ''
    }
    ${markRowHtml(near)}
    ${row.notes ? `<div class="pos-notes">${escapeHtml(row.notes)}</div>` : ''}
  </article>`;
}

/** 准捡漏附加标记行：无进面比 / 应届进面 / 分数持平，命中亮起、缺失灰显 */
function markRowHtml(near) {
  const marks = near?.marks || [];
  if (!marks.length || (!near.hit && !near.partial)) return '';
  const chips = marks
    .map(
      (m) => `<span class="bargain-mark ${m.ok ? 'is-on' : ''}" title="${escapeHtml(m.hint)}">
        <span class="bargain-mark-dot"></span>${escapeHtml(m.label)}${m.ok ? '' : ' · 未标'}
      </span>`
    )
    .join('');
  return `<div class="bargain-mark-list">${chips}</div>`;
}

function trackColor(row) {
  const cat = state.catalogs;
  const track = cat.majorTracks.find((t) => t.key === row.majorTrack);
  return track?.color || '#4B5563';
}

/** 报名数据块：招录 + 竞争比 + 各环节人数，直接反映上岸难度 */
function applyBlockHtml(row) {
  const cells = [
    { label: '招录人数', value: row.planCount },
    { label: '竞争比', value: row.competition != null ? `${row.competition}:1` : null },
    { label: '报名人数', value: row.applicants },
    { label: '过审人数', value: row.approvedCount },
    { label: '缴费人数', value: row.paidCount },
  ].filter((c) => c.value !== null && c.value !== undefined);
  if (!cells.length) return '';
  const countNote =
    row.effectiveApplicants != null
      ? `<div class="tiny muted mt-6">「低报名」判定用的报名规模：<b class="num">${row.effectiveApplicants}</b>${
          row.applyCountSourceName ? `（口径：${escapeHtml(row.applyCountSourceName)}）` : ''
        }${row.lowApply ? ' —— 落在低报名区间' : ' —— 超出低报名区间'}</div>`
      : '';
  const shortfallNote = row.ratioShortfall
    ? `<div class="notice notice-info mt-10">${icon('info', { size: 16 })}<div class="grow"><b>公告级低报名证据</b>：该岗位所属批次的官方公告明确「报名/缴费人数未达开考比例」，已被核减、取消或调整计划——比任何推算数字都直接，因此直接计入低报名。公告原文见下方备注与来源链接。</div></div>`
    : '';
  const issueNote = (row.dataIssues || []).length
    ? `<div class="notice notice-warn mt-10">${icon('alert', { size: 16 })}<div class="grow"><b>报名数据待核验</b>：${row.dataIssues.map((t) => escapeHtml(t)).join('；')}。本应用不会拿互相矛盾的数字去宣称「报名≈招录」，报考前请以官方报名统计与职位表复核。</div></div>`
    : '';
  return `<div class="apply-strip mt-10">
    ${cells
      .map(
        (c) => `<div class="apply-cell">
          <div class="apply-value num">${escapeHtml(String(c.value))}</div>
          <div class="apply-label">${escapeHtml(c.label)}</div>
        </div>`
      )
      .join('')}
  </div>
  ${countNote}
  ${shortfallNote}
  ${issueNote}`;
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

/** 通用条件核对渲染：conditions = [{label, hint, ok}] */
function condListHtml(conditions) {
  return conditions
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
}

/**
 * 准捡漏条件核对：五条件 + 三条附加标记。
 * 「没有进面比（没有就标记一下）」「有进面的应届生」「分数与上年持平」都在 marks 里显式呈现，
 * 缺失时显示「未标」，避免用户误以为已核验。
 */
function nearBargainBlockHtml(row) {
  const near = row.nearBargain || { hit: false, partial: false, conditions: [], marks: [] };
  if (!near.conditions || !near.conditions.length) return '';
  const miss = near.conditions.filter((c) => !c.ok).length;
  const stateLabel = near.hit ? '五条全中 · 准捡漏' : near.partial ? `接近（还差 ${miss} 条）` : `还差 ${miss} 条`;
  const marks = (near.marks || [])
    .map(
      (m) => `<div class="bargain-cond ${m.ok ? 'is-ok' : 'is-off'}">
        <span class="bargain-cond-mark">${m.ok ? icon('check', { size: 13 }) : icon('minus', { size: 13 })}</span>
        <div class="grow">
          <div class="bargain-cond-label">${escapeHtml(m.label)}${m.ok ? '' : ' · 未标记'}</div>
          <div class="tiny muted">${escapeHtml(m.hint)}</div>
        </div>
      </div>`
    )
    .join('');
  return `<div class="section-head mt-14">
      <h2 class="section-title">准捡漏条件核对</h2>
      <span class="section-hint">${stateLabel}</span>
    </div>
    <div class="bargain-cond-list">${condListHtml(near.conditions)}</div>
    ${
      marks
        ? `<div class="section-head mt-14">
             <h2 class="section-title">附加标记</h2>
             <span class="section-hint">没有就标一下</span>
           </div>
           <div class="bargain-cond-list">${marks}</div>`
        : ''
    }`;
}

/**
 * 分数口径核验：进面分怎么读 + 官方合格线 + 换算比对。
 * 这一步专门消除「200 分考 53.35」的口径误读：avg100 口径 × 2 = 总分，再和官方线比。
 */
function scoreCaliberHtml(row) {
  if (row.scoreMin == null) return '';
  const basis = row.scoreBasis === 'avg100' ? '两科平均口径（百分制合成）' : '总分口径（行测 + 申论）';
  const inTotal =
    row.scoreInTotal != null
      ? row.scoreInTotal
      : row.scoreBasis === 'avg100'
        ? Math.round(row.scoreMin * 200) / 100
        : row.scoreMin;
  const line = row.officialScoreLine;
  const gap = row.scoreLineGap;
  const below = row.belowOfficialLine;
  return `<div class="section-head mt-14">
      <h2 class="section-title">分数口径核验</h2>
      <span class="section-hint">口径 · 官方合格线</span>
    </div>
    <div class="caliber-box">
      <div class="caliber-grid">
        <div class="caliber-cell">
          <div class="caliber-value">${escapeHtml(row.scoreBasisName || '总分')}</div>
          <div class="caliber-label">本行展示口径</div>
        </div>
        <div class="caliber-cell">
          <div class="caliber-value num">${inTotal}</div>
          <div class="caliber-label">折算成总分口径</div>
        </div>
        <div class="caliber-cell ${line != null ? (below ? 'is-warn' : 'is-ok') : ''}">
          <div class="caliber-value num">${line != null ? line : '—'}</div>
          <div class="caliber-label">官方笔试合格线</div>
        </div>
        <div class="caliber-cell ${gap != null ? (below ? 'is-warn' : 'is-ok') : ''}">
          <div class="caliber-value num">${gap != null ? (gap >= 0 ? '+' : '') + gap : '—'}</div>
          <div class="caliber-label">进面分 − 合格线</div>
        </div>
      </div>
      <div class="caliber-foot">
        本行进面分为<b>${escapeHtml(basis)}</b>：${row.scoreBasis === 'avg100' ? `${row.scoreMin} 分合成成绩折合总分 ${inTotal} 分（合成成绩 × 2 = 总分）` : `${row.scoreMin} 分即总分口径`}。
        ${line != null ? `官方合格线 ${line} 分为总分口径，${below ? `本行折算后<b>低于</b>合格线 ${Math.abs(gap)} 分，已标记「数据待核验」` : `本行折算后<b>高于</b>合格线 ${gap} 分，数据自洽`}。` : '本行暂未录入官方合格线，可在「编辑」里补上。'}
      </div>
      ${
        row.officialScoreLineNote
          ? `<div class="caliber-foot">合格线备注：${escapeHtml(row.officialScoreLineNote)}</div>`
          : ''
      }
      ${
        row.scoreBasis === 'avg100'
          ? `<div class="caliber-foot">口径说明：「满分 200 却只考 53.35」是口径错位——53.35 是两科各占 50% 的合成成绩，不是总分。折算成总分约 ${inTotal} 分，属正常进面分。</div>`
          : ''
      }
    </div>`;
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

  root.querySelectorAll('[data-near]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.nearBargain = state.nearBargain ? '' : '1';
      await rerender(root);
    });
  });

  root.querySelectorAll('[data-lowapply]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.lowApply = state.lowApply ? '' : '1';
      await rerender(root);
    });
  });

  root.querySelectorAll('[data-guide]').forEach((btn) => {
    btn.addEventListener('click', () => openBargainSheet());
  });

  root.querySelectorAll('[data-best]').forEach((btn) => {
    btn.addEventListener('click', () => openBestRecommendSheet());
  });

  root.querySelectorAll('[data-archive]').forEach((btn) => {
    btn.addEventListener('click', () => openAnnouncementSheet());
  });

  root.querySelectorAll('[data-hukou]').forEach((btn) => {
    btn.addEventListener('click', () => openHukouSheet());
  });

  root.querySelectorAll('[data-cold]').forEach((btn) => {
    btn.addEventListener('click', () => openColdExamSheet());
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
  state.nearBargain = '';
  state.lowApply = '';
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
      ${nearBargainBlockHtml(row)}

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
          ? `<div class="notice notice-info mt-10">${icon('info', { size: 16 })}<div class="grow">本行进面分为 <b>${escapeHtml(row.scoreBasisName || '总分')}口径 ${row.scoreMin}</b>${
              row.scoreBasis === 'avg100'
                ? `，折合总分口径约 <b class="num">${row.scoreInTotal ?? row.scoreMin * 2}</b> 分（合成成绩 × 2 = 总分）。`
                : `（行测 + 申论直接相加，满分 ${row.scoreTotal}）。`
            }${
              row.scoreMax != null && row.scoreMax > row.scoreMin
                ? ` 最高与最低进面分差 ${(row.scoreMax - row.scoreMin).toFixed(2)} 分，分差越小说明进面同学分数越集中、压线进面越难。`
                : ''
            }</div></div>`
          : ''
      }
      ${scoreCaliberHtml(row)}

      <div class="kv-list mt-14">
        <div class="kv"><div class="kv-key">招录单位</div><div class="kv-val">${escapeHtml(row.unit)}</div></div>
        <div class="kv"><div class="kv-key">职位代码</div><div class="kv-val num">${escapeHtml(row.positionCode || '—')}</div></div>
        <div class="kv"><div class="kv-key">专业方向</div><div class="kv-val">${escapeHtml(row.majorText || row.majorTrackName)}</div></div>
        <div class="kv"><div class="kv-key">专业通道</div><div class="kv-val">${escapeHtml(track?.name || row.majorTrackName)}<div class="tiny muted mt-6">${escapeHtml(track?.desc || '')}</div></div></div>
        <div class="kv"><div class="kv-key">学历层次</div><div class="kv-val">${escapeHtml(row.degreeName)}</div></div>
        <div class="kv"><div class="kv-key">招录人数</div><div class="kv-val num">${row.planCount != null ? row.planCount : '—'}</div></div>
        <div class="kv"><div class="kv-key">开考比例</div><div class="kv-val">${escapeHtml(row.ratioText || row.ratioTypeName)}${row.ratioFlexible ? '<div class="tiny muted mt-6">公告明确未达比例也可开考 / 不递减指标</div>' : ''}</div></div>
        <div class="kv"><div class="kv-key">分数口径</div><div class="kv-val">${escapeHtml(row.scoreBasisName || '总分')}<div class="tiny muted mt-6">${escapeHtml(row.scoreBasisHint || (row.scoreBasis === 'avg100' ? '行测、申论各占 50% 的百分制合成成绩（合成 × 2 = 总分）' : '行测 + 申论直接相加（满分 200）'))}</div></div></div>
        <div class="kv"><div class="kv-key">官方合格线</div><div class="kv-val num">${row.officialScoreLine != null ? `${row.officialScoreLine}（总分口径）` : '—'}<div class="tiny muted mt-6">${escapeHtml(row.officialScoreLineNote || '未录入，可在「编辑」补充当地公告的最低分数线')}</div></div></div>
        <div class="kv"><div class="kv-key">应届要求</div><div class="kv-val">${row.freshOnly ? '仅限应届高校毕业生' : '不限应届'}${row.freshInterview ? '<div class="tiny muted mt-6">本岗位有应届生进面记录</div>' : ''}</div></div>
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
          <div class="field-label">招录人数</div>
          <input class="input num" id="p-plancount" type="number" min="1" max="9999" placeholder="如 1" value="${v.planCount ?? ''}" />
        </div>
        <div class="field grow">
          <div class="field-label">分数口径<span class="req">*</span></div>
          <select class="select" id="p-scorebasis">
            ${(cat.scoreBases || [])
              .map((b) => `<option value="${b.key}" ${(v.scoreBasis || 'total') === b.key ? 'selected' : ''}>${escapeHtml(b.name)}</option>`)
              .join('')}
          </select>
        </div>
      </div>
      <div class="field-hint mt-6">分数口径决定数字怎么读：<b>总分口径</b>= 行测 + 申论直接相加；<b>两科平均口径</b>= 各占 50% 的百分制合成成绩（合成 × 2 = 总分）。「200 分考 53.35」属于后者，录入时选对口径，详情页会自动换算比对官方合格线。</div>
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
          <div class="field-label">官方笔试合格线（总分口径）</div>
          <input class="input num" id="p-officialline" type="number" min="0" max="300" step="0.01" placeholder="如 95" value="${v.officialScoreLine ?? ''}" />
        </div>
        <div class="field grow">
          <div class="field-label">合格线备注</div>
          <input class="input" id="p-officialnote" placeholder="如：云南 2026 县级机关 95 分" value="${escapeHtml(v.officialScoreLineNote || '')}" />
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
        <div class="field-label">准捡漏标记<span class="tiny muted" style="font-weight:400">（没有就留空，卡片上会显示「未标」）</span></div>
        <label class="row" style="gap:8px;cursor:pointer;margin-top:6px">
          <input type="checkbox" id="p-ratioflex" ${v.ratioFlexible ? 'checked' : ''} />
          <span class="small">无进面比：公告明确未达比例也可开考 / 不递减指标</span>
        </label>
        <label class="row" style="gap:8px;cursor:pointer;margin-top:6px">
          <input type="checkbox" id="p-freshinterview" ${v.freshInterview ? 'checked' : ''} />
          <span class="small">应届进面：有应届生进面的记录</span>
        </label>
        <label class="row" style="gap:8px;cursor:pointer;margin-top:6px">
          <input type="checkbox" id="p-scorestable" ${v.scoreStable ? 'checked' : ''} />
          <span class="small">分数持平：进面分与上年基本一致</span>
        </label>
        <label class="row" style="gap:8px;cursor:pointer;margin-top:6px">
          <input type="checkbox" id="p-shortfall" ${v.ratioShortfall ? 'checked' : ''} />
          <span class="small">公告明确未达开考比例：报名/缴费不足，已被核减、取消或调整计划</span>
        </label>
        <div class="field-hint mt-6">「未达开考比例」是公告级的低报名证据——勾上后即使没记到具体报名人数，也会进「低报名专区」，并在详情页标注证据来自公告。</div>
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
          freshInterview: body.querySelector('#p-freshinterview').checked,
          policePosition: body.querySelector('#p-police').checked,
          ratioType: body.querySelector('#p-ratio').value,
          ratioFlexible: body.querySelector('#p-ratioflex').checked,
          ratioShortfall: body.querySelector('#p-shortfall').checked,
          ratioText: body.querySelector('#p-ratiotext').value.trim(),
          planCount: body.querySelector('#p-plancount').value,
          scoreStable: body.querySelector('#p-scorestable').checked,
          // score 字段是旧版单值口径，现在统一以 scoreMin 为权威，显式置空避免旧值遮挡
          score: null,
          scoreBasis: body.querySelector('#p-scorebasis').value,
          scoreMin: body.querySelector('#p-scoremin').value,
          scoreMax: body.querySelector('#p-scoremax').value,
          scoreAvg: body.querySelector('#p-scoreavg').value,
          scoreTotal: body.querySelector('#p-total').value,
          officialScoreLine: body.querySelector('#p-officialline').value,
          officialScoreLineNote: body.querySelector('#p-officialnote').value.trim(),
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

/* ───────────────── 最佳推荐弹层 ───────────────── */

/** 数据级别徽标：与后端 bestRecommend.levels 同源，避免两处各写一套配色 */
function bestLevelBadge(key) {
  const lv = (state.catalogs?.bestRecommend?.levels || []).find((l) => l.key === key);
  if (!lv) return '';
  return `<span class="badge" style="background:${lv.accent};color:${lv.color}">${escapeHtml(lv.name)}</span>`;
}

/** 来源外链（统一形态：官方 / 第三方页面 + 发布时间在 sourceName 里） */
function bestSource(src) {
  if (!src?.sourceUrl) return '';
  return `<a class="link-out tiny" href="${escapeHtml(src.sourceUrl)}" target="_blank" rel="noopener">
    ${icon('external', { size: 12, className: 'icon icon-sm' })}${escapeHtml(src.sourceName)}
  </a>`;
}

/** 推荐条目卡（地区 / 岗位 / 省考推荐共用一套结构） */
function bestPickCard(p) {
  const title = p.region || p.name || '';
  const lines = [];
  if (p.scale) lines.push(`<div class="region-line"><b>招录</b>：${escapeHtml(p.scale)}</div>`);
  if (p.metrics) lines.push(`<div class="region-line"><b>竞争</b>：${escapeHtml(p.metrics)}</div>`);
  if (p.why) lines.push(`<div class="region-line"><b>为什么推荐</b>：${escapeHtml(p.why)}</div>`);
  if (p.fit) lines.push(`<div class="region-line"><b>适合谁</b>：${escapeHtml(p.fit)}</div>`);
  const risk = p.risk || p.caution;
  if (risk) lines.push(`<div class="region-line is-risk"><b>风险 / 注意</b>：${escapeHtml(risk)}</div>`);
  return `<div class="best-pick">
    <div class="region-name">${p.rank ? `<span class="best-rank">${p.rank}</span>` : ''}${escapeHtml(title)}${bestLevelBadge(p.level)}</div>
    ${lines.join('')}
    ${bestSource(p)}
  </div>`;
}

function openBestRecommendSheet() {
  const br = state.catalogs?.bestRecommend;
  if (!br) {
    toast('推荐数据加载中，请稍后重试');
    return;
  }
  const gk = br.blocks.find((b) => b.key === 'guokao');
  const sk = br.blocks.find((b) => b.key === 'shengkao');
  const others = br.blocks.find((b) => b.key === 'others');

  openSheet({
    title: '最佳推荐区域',
    subtitle: '先过硬门槛，再按竞争烈度剔热，最后在招录规模大的省份里挑冷门行',
    content: `
      <div class="notice notice-info">${icon('award', { size: 16 })}<div class="grow">${escapeHtml(br.intro)}</div></div>

      <div class="best-legend mt-10">
        ${(br.levels || [])
          .map(
            (l) => `<span class="best-legend-item"><span class="badge" style="background:${l.accent};color:${l.color}">${escapeHtml(l.name)}</span>
              <span class="tiny muted">${
                l.key === 'official'
                  ? '公告原文，可直接引用'
                  : l.key === 'thirdparty'
                    ? '第三方统计，需以官方复核'
                    : '按历年规律推算，非官方承诺'
              }</span></span>`
          )
          .join('')}
      </div>

      <!-- ── 一、国考 ── -->
      <div class="filter-group mt-14">
        <div class="filter-group-title">${escapeHtml(gk.name)}</div>
        <div class="best-headline">${escapeHtml(gk.summary.headline)}</div>

        <div class="small muted mt-10">考情速览（逐条标级别，可点开来源核对）</div>
        <div class="kv-list mt-6">
          ${gk.summary.facts
            .map(
              (f) => `<div class="kv">
                <div class="kv-key" style="width:76px">${escapeHtml(f.label)}</div>
                <div class="kv-val">${escapeHtml(f.value)} ${bestLevelBadge(f.level)}</div>
              </div>`
            )
            .join('')}
        </div>
        ${bestSource(gk.summary)}

        <div class="small muted mt-14">① 最推荐的 5 个报考地区（2027 招录规模 × 2026 实际竞争数据）</div>
        <div class="mt-6">${gk.regions.map(bestPickCard).join('')}</div>

        <div class="small muted mt-14">② 最推荐的 6 类岗位（按「政审安全 + 竞争温和 + 计算机对口」排序）</div>
        <div class="mt-6">${gk.posts.map(bestPickCard).join('')}</div>

        <div class="small muted mt-14">③ 对留学生明确不推荐的岗位（不是难，是报不了 / 不值）</div>
        <div class="mt-6">
          ${gk.avoid
            .map(
              (a) => `<div class="notice notice-warn mt-6">${icon('alert', { size: 16 })}<div class="grow">
                <b>${escapeHtml(a.name)}</b> ${bestLevelBadge(a.level)}<br />${escapeHtml(a.reason)}
              </div></div>`
            )
            .join('')}
        </div>
      </div>

      <!-- ── 二、省考 ── -->
      <div class="filter-group">
        <div class="filter-group-title">${escapeHtml(sk.name)}</div>
        <div class="notice notice-warn">${icon('alert', { size: 16 })}<div class="grow">${escapeHtml(sk.summary.note)}</div></div>

        <div class="small muted mt-10">两条线互不冲突，时间基本错开，可以都报</div>
        <div class="mt-6">
          ${sk.summary.lines
            .map(
              (l) => `<div class="best-pick">
                <div class="region-name">${escapeHtml(l.name)}</div>
                <div class="region-line"><b>省份</b>：${escapeHtml(l.provinces)}</div>
                <div class="region-line"><b>公告</b>：${escapeHtml(l.announce)}</div>
                <div class="region-line"><b>报名</b>：${escapeHtml(l.register)}</div>
                <div class="region-line"><b>笔试</b>：${escapeHtml(l.exam)}</div>
                <div class="region-line">${escapeHtml(l.note)}</div>
                ${bestLevelBadge(l.level)}
              </div>`
            )
            .join('')}
        </div>

        <div class="small muted mt-14">最推荐的 3 类报考方向</div>
        <div class="mt-6">${sk.summary.picks.map(bestPickCard).join('')}</div>

        <div class="small muted mt-14">省考特有的三条约束（比国考更容易踩）</div>
        <ul class="policy-list mt-6">
          ${sk.summary.caveats.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}
        </ul>
      </div>

      <!-- ── 三、其他考试 ── -->
      <div class="filter-group">
        <div class="filter-group-title">${escapeHtml(others.name)}</div>

        <div class="small muted">先把这一年的节点压成一条时间轴，再逐条看细节</div>
        <ol class="best-seq mt-6">
          ${others.sequence
            .map(
              (s) => `<li><span class="best-seq-window">${escapeHtml(s.window)}</span>
                <span class="best-seq-tag">${escapeHtml(s.tag)}</span>
                <span class="best-seq-action">${escapeHtml(s.action)}</span></li>`
            )
            .join('')}
        </ol>

        <div class="small muted mt-14">各考试的公告 / 报名 / 笔试窗口</div>
        <div class="mt-6">
          ${others.timeline
            .map(
              (t) => `<div class="best-pick">
                <div class="region-name">${escapeHtml(t.name)}${bestLevelBadge(t.level)}</div>
                <div class="region-line"><b>公告</b>：${escapeHtml(t.announce)}</div>
                <div class="region-line"><b>报名</b>：${escapeHtml(t.register)}</div>
                <div class="region-line"><b>考试</b>：${escapeHtml(t.exam)}</div>
                <div class="region-line">${escapeHtml(t.note)}</div>
                ${bestSource(t)}
              </div>`
            )
            .join('')}
        </div>
      </div>

      <div class="filter-group">
        <div class="filter-group-title">四、怎么用这份推荐</div>
        <ul class="policy-list">
          <li>国考部分可以直接执行：公告已出，报名窗口 2026-10-15 08:00 — 10-24 18:00，先完成实名实人认证再选岗。</li>
          <li>省考与其他考试的时间是<b>预测</b>，只用来排备考节奏与巡考顺序；公告一旦发布，以官方为准，本应用会同步更新提醒节点。</li>
          <li>推荐地区是「岗位池大 + 竞争温和」的组合结论，不等于「报了就上」。真正的决定因素仍是报名中后期该职位的<b>报名人数 ÷ 招录人数</b>。</li>
          <li>把候选行用「录入岗位 / 批量导入」灌进本应用，会自动跑捡漏五条件与准捡漏判定，和本页推荐互相印证。</li>
        </ul>
      </div>
    `,
  });
}

/* ───────────────── 捡漏攻略弹层 ───────────────── */

function openBargainSheet() {
  const guide = state.catalogs?.bargainGuide;
  if (!guide) {
    toast('攻略数据加载中，请稍后重试');
    return;
  }
  const { window: win, conditions, policeBar, noResume, zeroTip, nearConditions, nearMarks, rencaiQs200, noRatioExams, scoreCalibration } = guide;

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
        <div class="filter-group-title">二、捡漏五条件（五条全中才圈出来）</div>
        <ul class="policy-list">
          ${conditions.map((c, i) => `<li><b>${i + 1}. ${escapeHtml(c.label)}</b>——${escapeHtml(c.hint)}</li>`).join('')}
        </ul>
      </div>

      ${
        nearConditions
          ? `<div class="filter-group">
              <div class="filter-group-title">三、准捡漏五条件（报名≈招录 · 更容易碰上）</div>
              <ul class="policy-list">
                ${nearConditions.map((c, i) => `<li><b>${i + 1}. ${escapeHtml(c.label)}</b>——${escapeHtml(c.hint)}</li>`).join('')}
              </ul>
              <div class="small muted mt-6">三条附加标记（不淘汰，只标注，命中亮起、缺失显示「未标」）：</div>
              <ul class="policy-list mt-6">
                ${(nearMarks || []).map((m) => `<li><b>${escapeHtml(m.label)}</b>——${escapeHtml(m.hint)}</li>`).join('')}
              </ul>
              <div class="small muted mt-6">为什么单列准捡漏：全国「无人报考 + 不设比例 + 专业对口 + 政审安全」四件事同时成立的位置极其稀缺；而三支一扶、社区工作者、西部计划里「报名人数跟岗位数几乎一比一」的岗位常见得多——这些才是真正抓得住的漏。</div>
            </div>`
          : ''
      }

      <div class="filter-group">
        <div class="filter-group-title">四、${escapeHtml(policeBar.title)}</div>
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
        <div class="filter-group-title">五、${escapeHtml(noResume.title)}</div>
        <ul class="policy-list">
          ${noResume.points.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
        <a class="link-out small" href="${escapeHtml(noResume.sourceUrl)}" target="_blank" rel="noopener">
          ${icon('external', { size: 13, className: 'icon icon-sm' })}${escapeHtml(noResume.sourceName)}
        </a>
      </div>

      <div class="filter-group">
        <div class="filter-group-title">六、${escapeHtml(zeroTip.title)}</div>
        <div class="note-box">${escapeHtml(zeroTip.stats)}</div>
        <ul class="policy-list mt-6">
          ${zeroTip.lessons.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
        <a class="link-out small" href="${escapeHtml(zeroTip.sourceUrl)}" target="_blank" rel="noopener">
          ${icon('external', { size: 13, className: 'icon icon-sm' })}${escapeHtml(zeroTip.sourceName)}
        </a>
      </div>

      ${
        rencaiQs200
          ? `<div class="filter-group">
              <div class="filter-group-title">七、${escapeHtml(rencaiQs200.title)}</div>
              <div class="notice notice-info">${icon('info', { size: 16 })}<div class="grow">${escapeHtml(rencaiQs200.note)}</div></div>
              <div class="mt-10">
                ${(rencaiQs200.regions || [])
                  .map(
                    (r) => `<div class="region-card">
                      <div class="region-name">${escapeHtml(r.region)}</div>
                      <div class="region-line"><b>对象</b>：${escapeHtml(r.scope)}</div>
                      <div class="region-line"><b>窗口</b>：${escapeHtml(r.window)}</div>
                      <div class="region-line"><b>亮点</b>：${escapeHtml(r.feature)}</div>
                      <a class="link-out tiny" href="${escapeHtml(r.sourceUrl)}" target="_blank" rel="noopener">
                        ${icon('external', { size: 12, className: 'icon icon-sm' })}${escapeHtml(r.sourceName)}
                      </a>
                    </div>`
                  )
                  .join('')}
              </div>
              <ul class="policy-list mt-10">
                ${(rencaiQs200.tips || []).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
              </ul>
            </div>`
          : ''
      }

      ${
        noRatioExams
          ? `<div class="filter-group">
              <div class="filter-group-title">八、${escapeHtml(noRatioExams.title)}</div>
              ${(noRatioExams.items || [])
                .map(
                  (it) => `<div class="region-card">
                    <div class="region-name">${escapeHtml(it.name)}</div>
                    <div class="region-line"><b>开考比例</b>：${escapeHtml(it.ratio)}</div>
                    <div class="region-line"><b>特点</b>：${escapeHtml(it.feature)}</div>
                    <div class="region-line"><b>低报名实例</b>：${escapeHtml(it.lowApply)}</div>
                    <a class="link-out tiny" href="${escapeHtml(it.sourceUrl)}" target="_blank" rel="noopener">
                      ${icon('external', { size: 12, className: 'icon icon-sm' })}${escapeHtml(it.sourceName)}
                    </a>
                  </div>`
                )
                .join('')}
            </div>`
          : ''
      }

      ${
        scoreCalibration
          ? `<div class="filter-group">
              <div class="filter-group-title">九、${escapeHtml(scoreCalibration.title)}</div>
              <ul class="policy-list">
                ${(scoreCalibration.points || []).map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
              </ul>
              ${
                scoreCalibration.yunnanLines
                  ? `<div class="small muted mt-10">云南省 2026 年度笔试合格线（总分口径）：</div>
                     <div class="kv-list mt-6">
                       ${scoreCalibration.yunnanLines
                         .map(
                           (l) => `<div class="kv">
                             <div class="kv-key" style="width:96px">总分 ${l.total}</div>
                             <div class="kv-val">${escapeHtml(l.scope)}</div>
                           </div>`
                         )
                         .join('')}
                     </div>`
                  : ''
              }
              <a class="link-out small" href="${escapeHtml(scoreCalibration.sourceUrl)}" target="_blank" rel="noopener">
                ${icon('external', { size: 13, className: 'icon icon-sm' })}${escapeHtml(scoreCalibration.sourceName)}
              </a>
            </div>`
          : ''
      }

      <div class="filter-group">
        <div class="filter-group-title">十、报名窗口内怎么盯</div>
        <ul class="policy-list">
          ${win.trackTips.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
      </div>
    `,
  });
}

/* ───────────────── 历年公告弹层 ───────────────── */

/** 公告数据级别徽章（官方 / 第三方 / 预测），复用推荐页的四级配色 */
function archiveLevelBadge(key) {
  const lv = (state.catalogs?.announcementLevels || []).find((l) => l.key === key);
  if (!lv) return '';
  return `<span class="badge" style="background:${lv.accent};color:${lv.color}">${escapeHtml(lv.short || lv.name)}</span>`;
}

/** 单份公告卡：年份 + 标题 + 级别 → 发布/规模 → 时间节点 → 逐年变化 → 来源 */
function archiveItemCard(it) {
  const tl = it.timeline || [];
  return `<div class="ann-item">
    <div class="ann-head">
      <span class="ann-year">${escapeHtml(String(it.year))}</span>
      <span class="ann-title">${escapeHtml(it.title)}</span>
      ${archiveLevelBadge(it.level)}
    </div>
    ${it.publishDate ? `<div class="region-line"><b>公告发布</b>：${escapeHtml(it.publishDate)}</div>` : ''}
    ${it.scale ? `<div class="region-line"><b>招录规模</b>：${escapeHtml(it.scale)}</div>` : ''}
    ${
      tl.length
        ? `<div class="kv-list mt-6">
            ${tl
              .map(
                (t) => `<div class="kv">
                  <div class="kv-key" style="width:92px">${escapeHtml(t.label)}</div>
                  <div class="kv-val num">${escapeHtml(t.value)}</div>
                </div>`
              )
              .join('')}
          </div>`
        : ''
    }
    ${it.highlight ? `<div class="note-box mt-6">${escapeHtml(it.highlight)}</div>` : ''}
    ${
      (it.stats || []).length
        ? `<div class="ann-stats mt-6">
            ${it.stats
              .map(
                (s) => `<div class="ann-stat">
                  ${archiveLevelBadge(s.level)}<span class="grow">${escapeHtml(s.text)}</span>
                  ${bestSource(s)}
                </div>`
              )
              .join('')}
          </div>`
        : ''
    }
    ${bestSource(it)}
  </div>`;
}

function openAnnouncementSheet() {
  const arc = state.catalogs?.announcementArchive;
  if (!arc?.groups?.length) {
    toast('历年公告数据加载中，请稍后重试');
    return;
  }
  const all = arc.groups.flatMap((g) => g.items || []);
  const years = [...new Set(all.map((i) => i.year))].sort();
  const yearText = years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : `${years[0] ?? ''}`;
  const officialCount = all.filter((i) => i.level === 'official').length;

  openSheet({
    title: '历年公告',
    subtitle: `${all.length} 份往年公告原文 · ${escapeHtml(yearText)} 年度 · 更新于 ${escapeHtml(arc.updatedAt || '')}`,
    content: `
      <div class="notice notice-info">${icon('calendar', { size: 16 })}<div class="grow">${escapeHtml(arc.intro)}</div></div>
      <div class="notice notice-warn mt-10">${icon('alert', { size: 16 })}<div class="grow">${escapeHtml(arc.caveat)}</div></div>

      <div class="best-legend mt-10">
        ${(state.catalogs?.announcementLevels || [])
          .map(
            (l) => `<span class="best-legend-item"><span class="badge" style="background:${l.accent};color:${l.color}">${escapeHtml(l.name)}</span>
              <span class="tiny muted">${
                l.key === 'official'
                  ? '官网原文，日期可直接引用'
                  : l.key === 'thirdparty'
                    ? '第三方整理，建议回官网复核'
                    : '按往年规律推算，非官方承诺'
              }</span></span>`
          )
          .join('')}
      </div>

      <div class="filter-group mt-14">
        <div class="filter-group-title">收录概览</div>
        <div class="kv-list">
          <div class="kv"><div class="kv-key" style="width:92px">公告份数</div><div class="kv-val num">${all.length} 份</div></div>
          <div class="kv"><div class="kv-key" style="width:92px">官方原文</div><div class="kv-val num">${officialCount} 份</div></div>
          <div class="kv"><div class="kv-key" style="width:92px">覆盖考试</div><div class="kv-val">${arc.groups.map((g) => escapeHtml(g.short || g.name)).join(' · ')}</div></div>
          <div class="kv"><div class="kv-key" style="width:92px">归档更新</div><div class="kv-val num">${escapeHtml(arc.updatedAt || '—')}</div></div>
        </div>
      </div>

      ${arc.groups
        .map(
          (g, gi) => `<div class="filter-group">
            <div class="filter-group-title">${gi + 1}. ${escapeHtml(g.name)}（${(g.items || []).length} 份）</div>
            ${(g.items || []).map(archiveItemCard).join('')}
          </div>`
        )
        .join('')}

      <div class="filter-group">
        <div class="filter-group-title">怎么用这份归档</div>
        <ul class="policy-list">
          <li>同一考试的相邻年份对着看：报名窗口通常几乎不动，真正会挪的是<b>笔试日期</b>——用它排备考节奏，不要用它是当年承诺。</li>
          <li>省考只看你目标省份的那一两条：各省公告分散在省人社厅 / 人事考试网，本归档未逐省穷举，缺的省份请以省官网为准。</li>
          <li>取消 / 核减职位公告单独看：那是最真实的「报名人数不足」证据，比任何机构估算都硬，岗位库里同批次的职位已按原文收录。</li>
          <li>公告一发布，本应用只更新提醒节点，不替你判断能不能报——户籍、专业、应届身份仍需逐条对照职位表。</li>
        </ul>
      </div>
    `,
  });
}

/* ───────────────── 外地可考 · 户籍口径弹层 ───────────────── */

function hukouLevelBadge(key) {
  const lv = (state.catalogs?.hukouLevels || []).find((l) => l.key === key);
  if (!lv) return '';
  return `<span class="badge" style="background:${lv.accent};color:${lv.color}">${escapeHtml(lv.short || lv.name)}</span>`;
}

function hukouItemCard(it) {
  const kinds = state.catalogs?.examTypes || [];
  const kind = kinds.find((k) => k.key === it.examType);
  return `<div class="best-pick">
    <div class="region-name">${escapeHtml(it.name)}${hukouLevelBadge(it.level)}</div>
    ${kind ? `<div class="region-line"><b>考试类别</b>：${escapeHtml(kind.name)}</div>` : ''}
    ${it.scale ? `<div class="region-line"><b>规模</b>：${escapeHtml(it.scale)}</div>` : ''}
    ${it.window ? `<div class="region-line"><b>窗口</b>：${escapeHtml(it.window)}</div>` : ''}
    ${it.quote ? `<div class="note-box mt-6">${escapeHtml(it.quote)}</div>` : ''}
    ${it.why ? `<div class="region-line"><b>为什么值得看</b>：${escapeHtml(it.why)}</div>` : ''}
    ${it.caution ? `<div class="region-line is-risk"><b>注意</b>：${escapeHtml(it.caution)}</div>` : ''}
    ${bestSource(it)}
    ${
      (it.stats || []).length
        ? `<div class="ann-stats mt-6">
            ${it.stats
              .map(
                (s) => `<div class="ann-stat">
                  ${archiveLevelBadge(s.level)}<span class="grow">${escapeHtml(s.text)}</span>
                  ${bestSource(s)}
                </div>`
              )
              .join('')}
          </div>`
        : ''
    }
  </div>`;
}

function openHukouSheet() {
  const guide = state.catalogs?.hukouGuide;
  if (!guide?.items?.length) {
    toast('户籍口径数据加载中，请稍后重试');
    return;
  }
  const openCount = guide.items.filter((i) => i.level === 'open').length;
  const freshCount = guide.items.filter((i) => i.level === 'fresh').length;

  openSheet({
    title: '外地可考 · 户籍口径',
    subtitle: `${guide.items.length} 类考试按户籍口径重新排 · 其中 ${openCount} 类明确不限户籍、${freshCount} 类应届不限往届受限`,
    content: `
      <div class="notice notice-info">${icon('globe', { size: 16 })}<div class="grow">${escapeHtml(guide.intro)}</div></div>
      <div class="notice notice-warn mt-10">${icon('alert', { size: 16 })}<div class="grow">${escapeHtml(guide.caveat)}</div></div>

      <div class="best-legend mt-10">
        ${(guide.levels || [])
          .map(
            (l) => `<span class="best-legend-item"><span class="badge" style="background:${l.accent};color:${l.color}">${escapeHtml(l.short)}</span>
              <span class="tiny muted">${escapeHtml(l.desc)}</span></span>`
          )
          .join('')}
      </div>

      <div class="filter-group mt-14">
        <div class="filter-group-title">一、明确不限户籍（外地考生与本地考生同条件）</div>
        ${guide.items.filter((i) => i.level === 'open').map(hukouItemCard).join('')}
      </div>

      <div class="filter-group">
        <div class="filter-group-title">二、应届不限 · 往届限本地</div>
        ${guide.items.filter((i) => i.level === 'fresh').map(hukouItemCard).join('')}
      </div>

      <div class="filter-group">
        <div class="filter-group-title">三、各地自定 · 必须逐公告核对</div>
        ${guide.items.filter((i) => i.level === 'mixed' || i.level === 'local').map(hukouItemCard).join('')}
      </div>

      <div class="filter-group">
        <div class="filter-group-title">四、怎么用这份对照</div>
        <ul class="policy-list">
          <li>先看<b>级别徽标</b>再决定要不要点开：绿标「不限户籍」可以直接排进计划，蓝标「应届不限」取决于你还在不在择业期，紫标「逐公告看」必须自己找当年公告核对。</li>
          <li>「村官」不是一个考试：省里统一组织的（如河南万名协理员）可以不限户籍、带编；县乡自己招的村级后备干部大多限本地，且同一份公告里可能出现「应届限本地、往届不限」这种反直觉写法。</li>
          <li>社区工作者的口子在「应届」二字上：<b>往届外地考生基本报不了</b>，需要本地户籍或居住证满年限且积分达标。</li>
          <li>三支一扶、社区工作者、村官这类各省 / 各区自己定的考试，<b>别把一个地方的结论外推到全国</b>——本清单标明的是具体哪一份公告的口径。</li>
          <li>没出现在这份清单里的考试（军队文职、选调生、人才引进等）不代表限户籍，只是本次没核到明确条款原文，报名前请以当年公告为准。</li>
        </ul>
      </div>
    `,
  });
}

/* ───────────────── 冷门统考弹层 ───────────────── */

/** 冷门统考条目卡：组织方 + 户籍口径 → 规模 / 窗口 → 依据原文 → 为什么值得看 / 注意 → 来源 */
function coldExamItemCard(it) {
  return `<div class="best-pick">
    <div class="region-name">${escapeHtml(it.name)}${hukouLevelBadge(it.hukou)}</div>
    ${it.org ? `<div class="region-line"><b>组织方</b>：${escapeHtml(it.org)}</div>` : ''}
    ${it.scale ? `<div class="region-line"><b>规模</b>：${escapeHtml(it.scale)}</div>` : ''}
    ${it.window ? `<div class="region-line"><b>窗口</b>：${escapeHtml(it.window)}</div>` : ''}
    ${it.quote ? `<div class="note-box mt-6">${escapeHtml(it.quote)}</div>` : ''}
    ${it.why ? `<div class="region-line"><b>为什么值得看</b>：${escapeHtml(it.why)}</div>` : ''}
    ${it.caution ? `<div class="region-line is-risk"><b>注意</b>：${escapeHtml(it.caution)}</div>` : ''}
    ${bestSource(it)}
    ${
      (it.stats || []).length
        ? `<div class="ann-stats mt-6">
            ${it.stats
              .map(
                (s) => `<div class="ann-stat">
                  ${archiveLevelBadge(s.level)}<span class="grow">${escapeHtml(s.text)}</span>
                  ${bestSource(s)}
                </div>`
              )
              .join('')}
          </div>`
        : ''
    }
  </div>`;
}

function openColdExamSheet() {
  const cold = state.catalogs?.coldExams;
  if (!cold?.groups?.length) {
    toast('冷门统考数据加载中，请稍后重试');
    return;
  }
  const items = cold.groups.flatMap((g) => g.items || []);
  const openCount = items.filter((i) => i.hukou === 'open').length;

  openSheet({
    title: '冷门统考',
    subtitle: `${items.length} 类不太有人查的统考 · ${openCount} 类明确不限户籍 · 更新于 ${escapeHtml(cold.updatedAt || '')}`,
    content: `
      <div class="notice notice-info">${icon('briefcase', { size: 16 })}<div class="grow">${escapeHtml(cold.intro)}</div></div>
      <div class="notice notice-warn mt-10">${icon('alert', { size: 16 })}<div class="grow">${escapeHtml(cold.caveat)}</div></div>

      <div class="best-legend mt-10">
        ${(cold.levels || [])
          .map(
            (l) => `<span class="best-legend-item"><span class="badge" style="background:${l.accent};color:${l.color}">${escapeHtml(l.short)}</span>
              <span class="tiny muted">${escapeHtml(l.desc)}</span></span>`
          )
          .join('')}
      </div>

      ${cold.groups
        .map(
          (g) => `<div class="filter-group mt-14">
            <div class="filter-group-title">${escapeHtml(g.name)}</div>
            ${(g.items || []).map(coldExamItemCard).join('')}
          </div>`
        )
        .join('')}

      <div class="filter-group">
        <div class="filter-group-title">待核实（听说过，但没核到当年度公告原文，故不列入正式清单）</div>
        ${
          (cold.pending || [])
            .map(
              (p) => `<div class="notice notice-warn mt-6">${icon('alert', { size: 16 })}<div class="grow">
                <b>${escapeHtml(p.name)}</b><br />${escapeHtml(p.note)}
              </div></div>`
            )
            .join('')
        }
      </div>

      <div class="filter-group">
        <div class="filter-group-title">为什么这些更容易捡到漏</div>
        <ul class="policy-list">
          <li>信息差本身就是门槛：这些考试没有统一入口，公告躺在各系统 / 各省公司官网，绝大多数人根本不知道。</li>
          <li>专业门槛把人筛掉一层：专利审查员要「扎实的理工科专业功底」，计算机 / AI 背景是正相关而不是陪跑。</li>
          <li>地域偏见再筛一层：很多岗位在地市 / 县，愿意去的人少，报名人数自然上不去。</li>
          <li>反过来要认清楚：**央企 / 国企校招多半是合同制或劳务派遣，不是行政 / 事业编制**——别把「正式员工」和「编制」混为一谈。</li>
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

  const {
    guokaoScoreLines, guokaoSubjectLine, yunnanScoreLines, scoreCalibration,
    rencaiQs200, noRatioExams, returneePolicy, hardshipPolicy, provincePolicies, disclaimer,
  } = data;

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

      ${
        yunnanScoreLines
          ? `<div class="filter-group">
              <div class="filter-group-title">二·补、云南省考笔试合格分数线（2026 年度 · 总分口径）</div>
              <div class="kv-list">
                ${yunnanScoreLines
                  .map(
                    (l) => `<div class="kv">
                      <div class="kv-key" style="width:96px">总分 ${l.total}</div>
                      <div class="kv-val">${escapeHtml(l.scope)}</div>
                    </div>`
                  )
                  .join('')}
              </div>
              <div class="small muted mt-6">云南省考进面排名按行测、申论各 50% 的百分制合成成绩（平均分口径）。展示的「最低进面分 53.35」是该口径，折合总分约 106.7，高于县级合格线 95——不是「200 分只考 53.35」。</div>
              ${
                scoreCalibration
                  ? `<div class="notice notice-info mt-10">${icon('info', { size: 16 })}<div class="grow">${escapeHtml(scoreCalibration.points[3] || '')}</div></div>
                     <a class="link-out small" href="${escapeHtml(scoreCalibration.sourceUrl)}" target="_blank" rel="noopener">
                       ${icon('external', { size: 13, className: 'icon icon-sm' })}${escapeHtml(scoreCalibration.sourceName)}
                     </a>`
                  : ''
              }
            </div>`
          : ''
      }

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

      ${
        rencaiQs200
          ? `<div class="filter-group">
              <div class="filter-group-title">五、${escapeHtml(rencaiQs200.title)}</div>
              <div class="notice notice-info">${icon('info', { size: 16 })}<div class="grow">${escapeHtml(rencaiQs200.note)}</div></div>
              <div class="mt-10">
                ${(rencaiQs200.regions || [])
                  .map(
                    (r) => `<div class="region-card">
                      <div class="region-name">${escapeHtml(r.region)}</div>
                      <div class="region-line"><b>对象</b>：${escapeHtml(r.scope)}</div>
                      <div class="region-line"><b>窗口</b>：${escapeHtml(r.window)}</div>
                      <div class="region-line"><b>亮点</b>：${escapeHtml(r.feature)}</div>
                      <a class="link-out tiny" href="${escapeHtml(r.sourceUrl)}" target="_blank" rel="noopener">
                        ${icon('external', { size: 12, className: 'icon icon-sm' })}${escapeHtml(r.sourceName)}
                      </a>
                    </div>`
                  )
                  .join('')}
              </div>
            </div>`
          : ''
      }

      ${
        noRatioExams
          ? `<div class="filter-group">
              <div class="filter-group-title">六、${escapeHtml(noRatioExams.title)}</div>
              ${(noRatioExams.items || [])
                .map(
                  (it) => `<div class="region-card">
                    <div class="region-name">${escapeHtml(it.name)}</div>
                    <div class="region-line"><b>开考比例</b>：${escapeHtml(it.ratio)}</div>
                    <div class="region-line"><b>特点</b>：${escapeHtml(it.feature)}</div>
                    <div class="region-line"><b>低报名实例</b>：${escapeHtml(it.lowApply)}</div>
                    <a class="link-out tiny" href="${escapeHtml(it.sourceUrl)}" target="_blank" rel="noopener">
                      ${icon('external', { size: 12, className: 'icon icon-sm' })}${escapeHtml(it.sourceName)}
                    </a>
                  </div>`
                )
                .join('')}
            </div>`
          : ''
      }

      <div class="filter-group">
        <div class="filter-group-title">七、留学生专业名称怎么对上 0812</div>
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
