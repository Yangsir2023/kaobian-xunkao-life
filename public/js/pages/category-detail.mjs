/**
 * 分类详情页 · 招考类别一页看清
 *
 * 每个类别（节点）一页，回答五件事：
 *   ① 今年什么状态（summary + thisYear：公告已发 / 报名中 / 已结束）
 *   ② 明年大概什么时候（forecast：按历年规律推算，标「预测」）
 *   ③ 外地考生能不能报（hukou：户籍口径，没核到原文就明说没核）
 *   ④ 往年什么时候发、什么时候考（announcements：历年公告归档）
 *   ⑤ 有哪些岗位、去哪看（positions：深链岗位库对应考试类型）
 *
 * 数据诚实边界：所有内容沿用服务端的 level（official / thirdparty / forecast）
 * 与来源链接，页面用 badge 明示；「预测」不是官方承诺。
 */
import { api, ApiError } from '../api.mjs';
import { icon } from '../icons.mjs';
import { escapeHtml } from '../utils.mjs';
import { emptyState, toastErr } from '../ui.mjs';
import { navigate } from '../router.mjs';
/** 数据级别徽标（与 server/best-recommend.mjs#RECOMMEND_LEVELS 同一套语言） */
const LEVEL_STYLES = {
  official: { name: '官方公告', color: '#0E7C6B', accent: '#E6F5F2' },
  thirdparty: { name: '第三方整理', color: '#7A4FD1', accent: '#F1ECFC' },
  forecast: { name: '预测推算', color: '#C77412', accent: '#FDF3E5' },
};

/** 户籍口径徽标（与 server/hukou-guide.mjs#HUKOU_LEVELS 同一套语言） */
const HUKOU_STYLES = {
  open: { name: '全国可报 · 不限户籍', color: '#0E7C6B', accent: '#E6F5F2' },
  fresh: { name: '应届不限 · 往届限本地', color: '#1F5AE0', accent: '#EAF0FF' },
  local: { name: '限本地户籍 / 生源', color: '#C77412', accent: '#FDF3E5' },
  mixed: { name: '各地自定 · 逐公告看', color: '#7A4FD1', accent: '#F1ECFC' },
};

const state = { data: null, cjFilter: 'all' };

export default {
  tab: null,

  bar() {
    return {
      back: true,
      title: '招考类别',
      subtitle: '今年动态 · 明年预测 · 户籍口径 · 岗位深链',
    };
  },

  async render(ctx) {
    const key = String(ctx.params.key || '');
    try {
      state.data = await api.categoryDetail(key);
    } catch (err) {
      state.data = null;
      const message = err instanceof ApiError ? err.message : '加载失败';
      return `<div class="empty">
        <div class="empty-icon">${icon('alert', { size: 26 })}</div>
        <h3 class="empty-title">这个类别暂未收录</h3>
        <p class="empty-desc">${escapeHtml(message)}</p>
        <button class="btn" id="cd-back">返回分类</button>
      </div>`;
    }
    return shellHtml(state.data);
  },

  mount(root) {
    const backBtn = root.querySelector('#cd-back');
    if (backBtn) backBtn.addEventListener('click', () => navigate('/categories'));

    const posBtn = root.querySelector('[data-cd-positions]');
    if (posBtn) {
      posBtn.addEventListener('click', () => {
        const link = state.data?.positions?.deepLink;
        if (link) navigate(link);
      });
    }

    mountCommunityJobs(root);
  },
};

/** 全国公告清单：省份筛选 chip + 全部展开 / 收起 */
function mountCommunityJobs(root) {
  const card = root.querySelector('#cj-card');
  if (!card) return;
  const groups = [...card.querySelectorAll('[data-cj-province]')];

  const applyFilter = (key) => {
    state.cjFilter = key;
    card.querySelectorAll('.cj-chip').forEach((c) => {
      c.classList.toggle('is-on', c.dataset.cjFilter === key);
    });
    groups.forEach((g) => {
      g.hidden = key !== 'all' && g.dataset.cjProvince !== key;
    });
  };

  card.querySelectorAll('.cj-chip').forEach((chip) => {
    chip.addEventListener('click', () => applyFilter(chip.dataset.cjFilter));
  });

  const toggleAll = card.querySelector('#cj-toggle-all');
  if (toggleAll) {
    toggleAll.addEventListener('click', () => {
      const shouldOpen = toggleAll.dataset.state !== 'open';
      groups.forEach((g) => {
        g.open = shouldOpen;
      });
      toggleAll.dataset.state = shouldOpen ? 'open' : 'closed';
      toggleAll.textContent = shouldOpen ? '全部展开中 · 点击收起' : '全部收起中 · 点击展开';
      toggleAll.textContent = shouldOpen ? '全部收起' : '全部展开';
    });
  }
  applyFilter('all');
}

/* ───────────────── 视图 ───────────────── */

function shellHtml(d) {
  const cat = d.category;
  return `
    ${heroHtml(cat)}
    ${summaryHtml(d.summary)}
    ${examInfoHtml(d.examInfo)}
    ${thisYearHtml(d.thisYear)}
    ${forecastHtml(d.forecast)}
    ${d.hukou ? hukouHtml(d.hukou) : hukouPendingHtml(d.hukouPending)}
    ${guidesHtml(d.guides)}
    ${communityJobsHtml(d.communityJobs)}
    ${announcementsHtml(d.announcements)}
    ${positionsHtml(d.positions)}
    ${linksHtml(d.links)}
    ${notesHtml(d.notes)}
    <div class="notice notice-info mt-14">
      ${icon('info', { size: 17 })}
      <div class="grow">数据截止 ${escapeHtml(d.updatedAt)}：本页所有结论都带数据级别（官方公告 / 第三方整理 / 预测推算）与来源链接，「预测」是按历年规律的推算、不是官方承诺，当年公告发布后请以当年为准。</div>
    </div>
  `;
}

function heroHtml(cat) {
  const months = (cat.typicalMonths || []).map((m) => `${m} 月`).join(' / ');
  return `<div class="cd-hero">
    <div class="cd-hero-icon" style="background:${cat.accent};color:${cat.color}">${icon(cat.icon, { size: 22 })}</div>
    <div class="grow">
      <h2 class="cd-hero-name">${escapeHtml(cat.name)}</h2>
      <div class="cd-hero-meta">${escapeHtml(cat.group)} · 典型月份 ${escapeHtml(months)}</div>
      <p class="cd-hero-desc">${escapeHtml(cat.description)}</p>
    </div>
  </div>`;
}

function levelBadge(level) {
  const s = LEVEL_STYLES[level];
  if (!s) return '';
  return `<span class="badge" style="background:${s.accent};color:${s.color}">${s.name}</span>`;
}

function hukouBadge(level) {
  const s = HUKOU_STYLES[level];
  if (!s) return '';
  return `<span class="badge" style="background:${s.accent};color:${s.color}">${escapeHtml(s.name)}</span>`;
}

function sourceLink(sourceUrl, sourceName) {
  if (!sourceUrl) return '';
  return `<a class="link-out" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener">
    ${icon('external', { size: 12, className: 'icon icon-sm' })}${escapeHtml(sourceName || '查看来源')}
  </a>`;
}

function summaryHtml(summary) {
  if (!summary) return '';
  return `<div class="cd-summary mt-10">
    ${levelBadge(summary.level)}
    <p>${escapeHtml(summary.headline)}</p>
  </div>`;
}

/** 考什么 · 备什么：通用备考口径（常识级整理，界面标注以当年公告原文为准） */
function examInfoHtml(info) {
  if (!info) return '';
  const subjects = (info.subjects || [])
    .map(
      (s) => `<div class="cd-point">
    <div class="cd-point-label">${escapeHtml(s.name)}</div>
    <div class="cd-point-value">${escapeHtml(s.note || '')}</div>
  </div>`
    )
    .join('');
  const prep = (info.prep || []).map((p) => `<li>${escapeHtml(p)}</li>`).join('');
  return `<div class="card mt-10">
    <div class="card-pad">
      <div class="section-head" style="margin-bottom:6px">
        <h3 class="section-title">考什么 · 备什么</h3>
        <span class="badge" style="background:var(--surface-3);color:var(--text-2)">备考常识</span>
      </div>
      ${subjects ? `<div class="cd-points">${subjects}</div>` : ''}
      ${info.interview ? `<p class="cd-text mt-10"><b>面试</b>：${escapeHtml(info.interview)}</p>` : ''}
      ${prep ? `<ul class="policy-list mt-10">${prep}</ul>` : ''}
      <p class="tiny muted mt-6">以上为通用备考口径整理，具体科目、条件与流程以当年公告原文为准。</p>
    </div>
  </div>`;
}

function thisYearHtml(block) {
  if (!block) return '';
  return `<div class="card mt-10">
    <div class="card-pad">
      <div class="section-head" style="margin-bottom:6px">
        <h3 class="section-title">今年动态</h3>
        ${levelBadge(block.level)}
      </div>
      <p class="cd-block-headline">${escapeHtml(block.headline)}</p>
      <div class="cd-points">${(block.points || []).map(pointHtml).join('')}</div>
      ${sourceLink(block.sourceUrl, block.sourceName)}
    </div>
  </div>`;
}

function pointHtml(p) {
  return `<div class="cd-point">
    <div class="cd-point-label">${escapeHtml(p.label)}${p.level && p.level !== 'official' ? ` · ${LEVEL_STYLES[p.level]?.name || ''}` : ''}</div>
    <div class="cd-point-value">${escapeHtml(p.value)}</div>
  </div>`;
}

function forecastHtml(block) {
  if (!block) return '';
  return `<div class="card mt-10">
    <div class="card-pad">
      <div class="section-head" style="margin-bottom:6px">
        <h3 class="section-title">明年预测</h3>
        ${levelBadge(block.level)}
      </div>
      <p class="cd-block-headline">${escapeHtml(block.headline)}</p>
      <p class="cd-text">${escapeHtml(block.text)}</p>
      ${sourceLink(block.sourceUrl, block.sourceName)}
    </div>
  </div>`;
}

function hukouHtml(hukou) {
  if (!hukou) return '';
  return `<div class="card mt-10">
    <div class="card-pad">
      <div class="section-head" style="margin-bottom:6px">
        <h3 class="section-title">户籍口径 · 外地考生能不能报</h3>
        ${hukouBadge(hukou.level)}
      </div>
      <p class="cd-block-headline">${escapeHtml(hukou.name || '')}</p>
      <p class="cd-text">${escapeHtml(hukou.why)}</p>
      ${hukou.quote ? `<blockquote class="cd-quote">${escapeHtml(hukou.quote)}</blockquote>` : ''}
      ${hukou.caution ? `<div class="notice notice-warn mt-10">${icon('alert', { size: 15 })}<div class="grow">${escapeHtml(hukou.caution)}</div></div>` : ''}
      ${(hukou.stats || []).map((s) => `<div class="cd-stat mt-10">
        <p class="cd-text">${escapeHtml(s.text)}</p>${sourceLink(s.sourceUrl, s.sourceName)}
      </div>`).join('')}
      ${sourceLink(hukou.sourceUrl, hukou.sourceName)}
    </div>
  </div>`;
}

/** 没核到户籍原文的类别：显式标「未核实」，不静默省略——没出现 ≠ 限户籍，也不等于不限户籍 */
function hukouPendingHtml(note) {
  if (!note) return '';
  return `<div class="card mt-10">
    <div class="card-pad">
      <div class="section-head" style="margin-bottom:6px">
        <h3 class="section-title">户籍口径 · 外地考生能不能报</h3>
        <span class="badge" style="background:var(--surface-3);color:var(--text-2)">未核实</span>
      </div>
      <p class="cd-text">${escapeHtml(note)}</p>
      <p class="cd-text mt-10">已核到原文的户籍口径（国考 / 三支一扶 / 社区工作者 / 西部计划 / 村官 / 冷门统考）见岗位库页「外地可考 · 户籍口径」清单。</p>
    </div>
  </div>`;
}

function guidesHtml(guides) {
  if (!guides || !guides.length) return '';
  return guides
    .map(
      (g) => `<div class="card mt-10">
    <div class="card-pad">
      <div class="section-head" style="margin-bottom:6px">
        <h3 class="section-title">${escapeHtml(g.title)}</h3>
        ${levelBadge('official')}
      </div>
      <p class="cd-text">${escapeHtml(g.note)}</p>
      <div class="cd-points mt-10">
        ${(g.regions || [])
          .map(
            (r) => `<div class="cd-point">
          <div class="cd-point-label">${escapeHtml(r.region)}</div>
          <div class="cd-point-value">${escapeHtml(r.scope)}\n${escapeHtml(r.window)}\n${escapeHtml(r.feature)}</div>
          ${sourceLink(r.sourceUrl, r.sourceName)}
        </div>`
          )
          .join('')}
      </div>
      ${(g.tips || []).length ? `<ul class="policy-list mt-10">${g.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
    </div>
  </div>`
    )
    .join('');
}

/**
 * 全国公告清单（社区工作者这类「省市区县各自发文」的类别才有）。
 * 每条带人数 / 报名窗口 / 户籍口径 / 来源链接；明确写了国（境）外学历口径的单独高亮。
 */
function communityJobsHtml(block) {
  if (!block || !block.provinces || !block.provinces.length) return '';
  const s = block.summary;
  const provinces = [...block.provinces].sort((a, b) => b.headcount - a.headcount);
  const chips = [
    `<button class="cj-chip is-on" data-cj-filter="all">全部 ${s.provinceCount} 省</button>`,
    ...provinces
      .filter((p) => p.headcount > 0)
      .map(
        (p) =>
          `<button class="cj-chip" data-cj-filter="${escapeHtml(p.key)}">${escapeHtml(p.name)} ${p.headcount}</button>`
      ),
  ].join('');

  return `<div class="card mt-10" id="cj-card">
    <div class="card-pad">
      <div class="section-head" style="margin-bottom:6px">
        <h3 class="section-title">全国公告清单 · ${escapeHtml(String(block.year))}</h3>
        <span class="badge" style="background:var(--surface-3);color:var(--text-2)">${escapeHtml(block.updatedAt)} 更新</span>
      </div>
      <p class="cd-text">${escapeHtml(block.intro)}</p>

      <div class="cj-stats mt-10">
        <div class="cj-stat"><b>${fmtNum(s.headcount)}</b><span>清单内合计人数</span></div>
        <div class="cj-stat"><b>${s.itemCount}</b><span>公告条数</span></div>
        <div class="cj-stat"><b>${s.provincesWithData}/${s.provinceCount}</b><span>有公告的省份</span></div>
        <div class="cj-stat"><b>${s.abroadCount}</b><span>写明留学生口径</span></div>
      </div>

      <div class="cj-chips mt-10">${chips}</div>
      <div class="cj-toolbar mt-6">
        <button class="btn btn-ghost btn-sm" id="cj-toggle-all">全部收起</button>
        <span class="tiny muted">官方原文 ${s.officialCount} 条 · 第三方整理 ${s.thirdpartyCount} 条</span>
      </div>

      <div class="cj-groups mt-10">
        ${provinces.map((p) => provinceGroupHtml(p)).join('')}
      </div>

      <div class="notice notice-warn mt-10">
        ${icon('alert', { size: 15 })}
        <div class="grow">${escapeHtml(block.caveat)}</div>
      </div>
    </div>
  </div>`;
}

function provinceGroupHtml(p) {
  const noData = p.headcount === 0;
  return `<details class="cj-group" data-cj-province="${escapeHtml(p.key)}" ${noData ? '' : 'open'}>
    <summary class="cj-group-head">
      <span class="cj-pname">${escapeHtml(p.name)}</span>
      <span class="cj-pmeta">${noData ? '未取到可引用原文' : `${fmtNum(p.headcount)} 人 · ${p.items.length} 条`}</span>
      ${icon('chevronRight', { size: 14, className: 'icon icon-sm cj-chevron' })}
    </summary>
    <div class="cj-items">
      ${p.items.map((it) => communityJobItemHtml(it)).join('')}
    </div>
  </details>`;
}

function communityJobItemHtml(it) {
  const meta = [];
  if (it.register) meta.push(`<span class="cj-tag">报名 ${escapeHtml(it.register)}</span>`);
  if (it.exam) meta.push(`<span class="cj-tag">${escapeHtml(it.exam)}</span>`);
  return `<div class="cj-item">
    <div class="cj-item-head">
      <span class="cj-area">${escapeHtml(it.area)}</span>
      ${typeof it.count === 'number' ? `<span class="cj-count">${fmtNum(it.count)} 人</span>` : ''}
      ${levelBadge(it.level)}
    </div>
    ${meta.length ? `<div class="cj-meta">${meta.join('')}</div>` : ''}
    ${it.hukou ? `<div class="cj-line"><b>户籍</b> ${escapeHtml(it.hukou)}</div>` : ''}
    ${
      it.abroad
        ? `<div class="cj-abroad">${icon('globe', { size: 13, className: 'icon icon-sm' })}<span>${escapeHtml(it.abroad)}</span></div>`
        : ''
    }
    <div class="mt-4">${sourceLink(it.sourceUrl, it.sourceName)}</div>
  </div>`;
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('zh-CN');
}

function announcementsHtml(items) {
  if (!items || !items.length) return '';
  return `<div class="card mt-10">
    <div class="card-pad">
      <div class="section-head" style="margin-bottom:6px">
        <h3 class="section-title">历年公告 · ${items.length} 份原文</h3>
        ${levelBadge('official')}
      </div>
      <div class="cd-points">
        ${items
          .map(
            (it) => `<div class="cd-point">
          <div class="cd-point-label">${escapeHtml(String(it.year))} 年度 · 发布 ${escapeHtml(it.publishDate)}</div>
          <div class="cd-point-value"><b>${escapeHtml(it.title)}</b>\n${escapeHtml(it.scale || '')}</div>
          ${sourceLink(it.sourceUrl, it.sourceName)}
        </div>`
          )
          .join('')}
      </div>
    </div>
  </div>`;
}

function positionsHtml(positions) {
  if (!positions || !positions.deepLink) return '';
  return `<button class="best-banner mt-10" data-cd-positions="1">
    <span class="best-banner-icon">${icon('briefcase', { size: 18 })}</span>
    <span class="best-banner-body">
      <span class="best-banner-title">岗位库 · ${positions.count} 个公共岗位</span>
      <span class="best-banner-line">按「${escapeHtml(positions.examTypes.join(' / '))}」筛选，含进面分 / 开考比例 / 应届与捡漏标记</span>
    </span>
    ${icon('chevronRight', { size: 16, className: 'icon icon-sm' })  }
  </button>`;
}

function linksHtml(links) {
  if (!links || !links.length) return '';
  return `<div class="card mt-10">
    <div class="card-pad">
      <div class="section-head" style="margin-bottom:6px">
        <h3 class="section-title">官方入口</h3>
      </div>
      <div class="cd-links">
        ${links
          .map(
            (l) => `<div class="cd-link-row">
          <span class="cd-link-name">${escapeHtml(l.label)}</span>
          <a class="link-out" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${icon('external', { size: 12, className: 'icon icon-sm' })}打开</a>
        </div>`
          )
          .join('')}
      </div>
    </div>
  </div>`;
}

function notesHtml(notes) {
  if (!notes || !notes.length) return '';
  return `<div class="card mt-10">
    <div class="card-pad">
      <div class="section-head" style="margin-bottom:6px">
        <h3 class="section-title">注意事项</h3>
      </div>
      ${notes
        .map(
          (n) => `<div class="cd-note">
        ${icon('alert', { size: 14, className: 'icon icon-sm' })}
        <div class="grow">${escapeHtml(n.text)}${n.sourceUrl ? `<div class="mt-4">${sourceLink(n.sourceUrl, n.sourceName)}</div>` : ''}</div>
      </div>`
        )
        .join('')}
    </div>
  </div>`;
}
