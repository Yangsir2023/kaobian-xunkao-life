/**
 * 提醒详情页：截止日期、考试类别、公告原文跳转、备注、公告截图、操作（编辑/删除/完成/加入我的提醒）
 */
import { api } from '../api.mjs';
import { session } from '../session.mjs';
import { icon } from '../icons.mjs';
import { escapeHtml, countdown, relativeTime, formatDate } from '../utils.mjs';
import { confirmDialog, toastOk, toastErr, emptyState } from '../ui.mjs';

export default {
  tab: null,

  bar(ctx) {
    return {
      title: '提醒详情',
      back: true,
      actions: [
        { key: 'category', icon: 'grid', label: '回到分类', onClick: () => { window.location.hash = '/categories'; } },
      ],
      ctx,
    };
  },

  async render(ctx) {
    const { reminder } = await api.reminder(ctx.params.id);
    return detailHtml(reminder);
  },

  mount(root, ctx) {
    bind(root, ctx);
  },
};

function detailHtml(r) {
  const meta = r.countdown || countdown(r.deadline, r.deadlineTime);
  const dayText = meta.expired ? `${Math.abs(meta.days)}` : `${meta.days}`;
  const unitText = meta.expired ? '天前已截止' : meta.days === 0 ? '今天截止' : '天后截止';
  const authed = session.isAuthenticated;
  const canEdit = r.owned || session.isAdmin();

  return `
  <section class="detail-hero fade-in" style="--accent:${r.categoryColor}">
    <div class="row" style="gap:8px;flex-wrap:wrap">
      <span class="badge" style="background:${r.categoryAccent};color:${r.categoryColor}">
        <span class="badge-dot" style="background:${r.categoryColor}"></span>${escapeHtml(r.categoryFullName)}
      </span>
      ${r.official ? '<span class="badge badge-source">公共节点</span>' : '<span class="badge badge-outline">我的提醒</span>'}
      ${r.status === 'done' ? '<span class="badge badge-success">已完成</span>' : ''}
      ${r.status === 'archived' ? '<span class="badge badge-outline">已归档</span>' : ''}
    </div>

    <h2 class="rem-title" style="font-size:18px;margin-top:12px">${escapeHtml(r.title)}</h2>

    <div class="countdown-hero">
      <div>
        <div class="countdown-big lv-${meta.level}">${dayText}</div>
        <div class="countdown-unit">${unitText}</div>
      </div>
      <div class="grow">
        <div class="row small muted" style="gap:6px">
          ${icon(meta.expired ? 'alert' : 'clock', { size: 15, className: 'icon icon-sm' })}
          <span>${escapeHtml(meta.label)}</span>
        </div>
        <div class="row small muted mt-6" style="gap:6px">
          ${icon('calendar', { size: 15, className: 'icon icon-sm' })}
          <span class="num">${escapeHtml(r.deadlineLabel)}</span>
        </div>
      </div>
    </div>

    ${meta.level === 'urgent' && !meta.expired
      ? `<div class="notice notice-danger mt-10">${icon('alert', { size: 17 })}<div class="grow">距离截止不足 3 天，请优先确认报名材料是否齐全。</div></div>`
      : ''}
    ${r.official
      ? `<div class="notice notice-warn mt-10">${icon('info', { size: 17 })}<div class="grow">公共节点日期为参考值（非官方承诺），请以主管部门当年正式公告为准。</div></div>`
      : ''}
  </section>

  <section class="card card-pad mt-14">
    <div class="section-head"><h2 class="section-title">节点信息</h2></div>
    <div class="kv-list">
      <div class="kv">
        <div class="kv-key">截止日期</div>
        <div class="kv-val num">${escapeHtml(r.deadline)}${r.deadlineTime ? ` ${escapeHtml(r.deadlineTime)}` : '（当日 24:00）'}</div>
      </div>
      <div class="kv">
        <div class="kv-key">考试类别</div>
        <div class="kv-val">${escapeHtml(r.categoryFullName)}（${escapeHtml(r.categoryName)}）</div>
      </div>
      <div class="kv">
        <div class="kv-key">公告原文</div>
        <div class="kv-val">
          ${r.announcementUrl
            ? `<a class="link-out" href="${escapeHtml(r.announcementUrl)}" target="_blank" rel="noopener noreferrer">
                 ${icon('external', { size: 15, className: 'icon icon-sm' })}打开公告原文
               </a>
               <div class="small muted truncate mt-6" style="max-width:100%">${escapeHtml(r.announcementUrl)}</div>
               <button class="icon-btn mt-6" id="copy-url">${icon('copy', { size: 14, className: 'icon icon-sm' })}复制链接</button>`
            : '<span class="muted">未填写公告链接</span>'}
        </div>
      </div>
      <div class="kv">
        <div class="kv-key">提醒节点</div>
        <div class="kv-val">${(r.remindOffsets || []).map((d) => `<span class="badge badge-outline" style="margin-right:6px">${d} 天前</span>`).join('') || '<span class="muted">未设置</span>'}</div>
      </div>
      <div class="kv">
        <div class="kv-key">来源</div>
        <div class="kv-val">${r.official ? '官方公告导入（公共节点）' : '我创建的提醒'}</div>
      </div>
      <div class="kv">
        <div class="kv-key">更新时间</div>
        <div class="kv-val muted">${escapeHtml(relativeTime(r.updatedAt || r.createdAt))} · 创建于 ${escapeHtml(formatDate(r.createdAt, true))}</div>
      </div>
    </div>
  </section>

  <section class="card card-pad mt-14">
    <div class="section-head"><h2 class="section-title">备注</h2></div>
    ${r.notes
      ? `<div class="note-box">${escapeHtml(r.notes)}</div>`
      : '<div class="muted small">暂无备注。编辑提醒可以补充报名材料、资格审查要点等备注。</div>'}
    ${r.attachments && r.attachments.length
      ? `<div class="section-head mt-14"><h2 class="section-title">公告截图</h2><span class="section-hint">${r.attachments.length} 张</span></div>
         <div class="thumb-row">
           ${r.attachments
             .map(
               (a) =>
                 `<a href="${escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer"><img class="thumb" src="${escapeHtml(a.url)}" alt="${escapeHtml(a.name)}" loading="lazy" /></a>`
             )
             .join('')}
         </div>`
      : ''}
  </section>

  <section class="mt-14">
    ${primaryActionsHtml(r, canEdit, authed)}
  </section>

  ${canEdit && !r.official
    ? `<section class="mt-14">
        <button class="btn btn-danger-ghost btn-block" id="delete-reminder">${icon('trash', { size: 17 })}删除这条提醒</button>
      </section>`
    : ''}

  <div class="notice notice-info mt-14">
    ${icon('shield', { size: 17 })}
    <div class="grow">本页展示与操作都会写入安全审计日志（含访问时间、IP 与设备），可在「我的 → 安全记录」中回看。</div>
  </div>`;
}

function primaryActionsHtml(r, canEdit, authed) {
  if (!authed) {
    return `<button class="btn btn-block" id="login-to-clone">${icon('plus', { size: 17 })}登录后加入我的提醒</button>`;
  }
  if (r.owned) {
    return `<div class="btn-row">
      <button class="btn btn-ghost" id="toggle-status">${icon(r.status === 'done' ? 'refresh' : 'check', { size: 17 })}${r.status === 'done' ? '标记未完成' : '标记已完成'}</button>
      <button class="btn" id="edit-reminder">${icon('pencil', { size: 17 })}编辑提醒</button>
    </div>`;
  }
  if (r.official) {
    return `<div class="btn-row">
      <button class="btn btn-ghost" id="open-site">${icon('external', { size: 17 })}公告入口</button>
      <button class="btn" id="clone-reminder">${icon('plus', { size: 17 })}加入我的提醒</button>
    </div>`;
  }
  if (canEdit) {
    return `<button class="btn btn-block" id="edit-reminder">${icon('pencil', { size: 17 })}以管理员身份编辑</button>`;
  }
  return emptyState({ iconName: 'lock', title: '无权操作', desc: '这条提醒不属于当前账号。' });
}

function bind(root, ctx) {
  const id = ctx.params.id;
  const copyBtn = root.querySelector('#copy-url');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const url = root.querySelector('.kv-val .truncate')?.textContent?.trim();
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        toastOk('公告链接已复制');
      } catch {
        toastErr('复制失败，请长按链接手动复制');
      }
    });
  }

  const editBtn = root.querySelector('#edit-reminder');
  if (editBtn) editBtn.addEventListener('click', () => { window.location.hash = `/reminders/${id}/edit`; });

  const loginBtn = root.querySelector('#login-to-clone');
  if (loginBtn) loginBtn.addEventListener('click', () => { window.location.hash = '/login'; });

  const toggleBtn = root.querySelector('#toggle-status');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      try {
        const current = document.querySelector('.badge-success') ? 'done' : 'active';
        const next = current === 'done' ? 'active' : 'done';
        await api.updateReminder(id, { status: next });
        toastOk(next === 'done' ? '已标记完成' : '已恢复为进行中');
        location.reload();
      } catch (err) {
        toastErr(err.message);
      }
    });
  }

  const cloneBtn = root.querySelector('#clone-reminder');
  if (cloneBtn) {
    cloneBtn.addEventListener('click', async () => {
      try {
        const { reminder } = await api.cloneReminder(id);
        toastOk('已加入我的提醒');
        window.location.hash = `/reminders/${reminder.id}`;
      } catch (err) {
        toastErr(err.message);
      }
    });
  }

  const siteBtn = root.querySelector('#open-site');
  if (siteBtn) {
    siteBtn.addEventListener('click', () => {
      const link = root.querySelector('.kv-val a.link-out');
      if (link) window.open(link.href, '_blank', 'noopener');
      else toastErr('该节点未填写公告链接');
    });
  }

  const delBtn = root.querySelector('#delete-reminder');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: '删除这条提醒？',
        desc: '删除后无法恢复，相关审计记录仍会保留在安全日志中。',
        confirmText: '确认删除',
        danger: true,
      });
      if (!ok) return;
      try {
        await api.deleteReminder(id);
        toastOk('提醒已删除');
        window.location.hash = '/';
      } catch (err) {
        toastErr(err.message);
      }
    });
  }
}
