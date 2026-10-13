/**
 * 新增 / 编辑提醒表单页
 * 表单字段：标题、考试类型、截止日期（可选时间）、公告链接 URL、备注、提醒节点、公告截图
 * 截图先在浏览器端用 canvas 压到长边 1600px / JPEG 0.82 再上传，避免移动网络下的大图上传失败。
 */
import { api } from '../api.mjs';
import { session } from '../session.mjs';
import { icon } from '../icons.mjs';
import { escapeHtml, normalizeUrl } from '../utils.mjs';
import { toastOk, toastErr, confirmDialog } from '../ui.mjs';

const DEFAULT_OFFSETS = [30, 14, 7, 3, 1];
const OFFSET_CHOICES = [1, 3, 7, 14, 30, 60];

export default {
  tab: 'new',
  requireAuth: true,

  bar(ctx) {
    const editing = Boolean(ctx.params.id);
    return {
      title: editing ? '编辑提醒' : '新增提醒',
      subtitle: editing ? '修改后立即生效' : '把关键节点记下来，倒计时会自动提醒',
      back: true,
    };
  },

  async render(ctx) {
    let reminder = null;
    if (ctx.params.id) {
      const data = await api.reminder(ctx.params.id);
      reminder = data.reminder;
      if (!reminder.owned && !session.isAdmin()) {
        return `<div class="notice notice-danger">${icon('lock', { size: 17 })}<div class="grow">这条提醒不属于当前账号，无法编辑。</div></div>`;
      }
    }
    const catalog = await api.categories();
    return formHtml(reminder, catalog.categories);
  },

  mount(root, ctx) {
    bind(root, ctx);
  },
};

function formHtml(r, categories) {
  const editing = Boolean(r);
  const defaultDeadline = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const attachments = r?.attachments || [];

  return `
  <form id="reminder-form" novalidate>
    <div class="card card-pad">
      <div class="field">
        <label class="field-label" for="f-title">标题<span class="req">*</span>
          <span class="field-hint">2-80 字，建议写清「年度 + 事项」</span>
        </label>
        <input class="input" id="f-title" name="title" maxlength="80" placeholder="例如：2027 年度国考网上报名截止"
          value="${escapeHtml(r?.title || '')}" autocomplete="off" />
        <div class="field-error hidden" id="e-title">${icon('alert', { size: 13, className: 'icon icon-sm' })}<span></span></div>
      </div>

      <div class="field">
        <label class="field-label">考试类型<span class="req">*</span></label>
        <div class="cat-picker" id="f-category">
          ${categories
            .map(
              (c) => `<button type="button" class="cat-option ${r?.category === c.key ? 'is-active' : ''}" data-cat="${c.key}">
                <span class="swatch" style="background:${c.color}"></span>${escapeHtml(c.short)}
              </button>`
            )
            .join('')}
        </div>
        <div class="field-error hidden" id="e-category">${icon('alert', { size: 13, className: 'icon icon-sm' })}<span>请选择考试类型</span></div>
        <div class="small muted mt-6" id="category-hint">${escapeHtml(
          categories.find((c) => c.key === r?.category)?.description || '选择后会在详情页展示该类别的一般规律说明。'
        )}</div>
      </div>

      <div class="field">
        <label class="field-label" for="f-deadline">截止日期<span class="req">*</span>
          <span class="field-hint">报名/笔试/查询的截止当天</span>
        </label>
        <input class="input" id="f-deadline" name="deadline" type="date" value="${escapeHtml(r?.deadline || defaultDeadline)}" />
        <div class="field-error hidden" id="e-deadline">${icon('alert', { size: 13, className: 'icon icon-sm' })}<span></span></div>
        <div class="row mt-6" style="gap:8px">
          <button type="button" class="icon-btn" data-quick-days="7">一周后</button>
          <button type="button" class="icon-btn" data-quick-days="30">一个月后</button>
          <button type="button" class="icon-btn" data-quick-days="90">三个月后</button>
        </div>
      </div>

      <div class="field">
        <label class="field-label" for="f-time">截止时间
          <span class="field-hint">选填，留空按当日 24:00 计</span>
        </label>
        <input class="input" id="f-time" name="deadlineTime" type="time" value="${escapeHtml(r?.deadlineTime || '')}" />
      </div>

      <div class="field">
        <label class="field-label" for="f-url">公告链接
          <span class="field-hint">选填，支持省略 https://</span>
        </label>
        <input class="input" id="f-url" name="announcementUrl" inputmode="url" placeholder="https://www.hbsrsksy.cn/..."
          value="${escapeHtml(r?.announcementUrl || '')}" autocomplete="off" />
        <div class="field-error hidden" id="e-url">${icon('alert', { size: 13, className: 'icon icon-sm' })}<span></span></div>
      </div>

      <div class="field">
        <label class="field-label" for="f-notes">备注
          <span class="field-hint">资格审查要点、材料清单、考点城市…</span>
        </label>
        <textarea class="textarea" id="f-notes" name="notes" maxlength="2000"
          placeholder="例如：报名需上传学历认证报告，资格审查被退回后须在 24 小时内改报。">${escapeHtml(r?.notes || '')}</textarea>
        <div class="small muted mt-6"><span id="notes-count">0</span> / 2000</div>
      </div>
    </div>

    <div class="card card-pad mt-14">
      <div class="section-head"><h2 class="section-title">提醒节点</h2><span class="section-hint">可多选</span></div>
      <div class="offset-row" id="f-offsets">
        ${OFFSET_CHOICES.map(
          (d) =>
            `<button type="button" class="offset-pill ${(r?.remindOffsets || DEFAULT_OFFSETS).includes(d) ? 'is-active' : ''}" data-offset="${d}">${d} 天前</button>`
        ).join('')}
      </div>
      <div class="small muted mt-6">倒计时按这些节点在首页高亮提示（默认 30/14/7/3/1 天）。</div>
    </div>

    <div class="card card-pad mt-14">
      <div class="section-head"><h2 class="section-title">公告截图</h2><span class="section-hint">选填，最多 6 张</span></div>
      <input type="file" id="f-file" accept="image/png,image/jpeg,image/webp" multiple class="hidden" />
      <button type="button" class="btn btn-ghost btn-block" id="pick-file">
        ${icon('upload', { size: 17 })}选择图片（自动压缩后上传）
      </button>
      <div class="thumb-row mt-10" id="attachment-list">${attachmentHtml(attachments)}</div>
      <div class="small muted mt-6" id="upload-hint">图片会先在本地压缩到长边 1600px，再上传到云端存储。</div>
    </div>

    <div class="mt-14">
      <button class="btn btn-block" id="save-reminder" type="submit">${icon('check', { size: 17 })}${editing ? '保存修改' : '创建提醒'}</button>
    </div>
    ${editing
      ? `<div class="mt-10"><button type="button" class="btn btn-danger-ghost btn-block" id="delete-from-editor">${icon('trash', { size: 17 })}删除提醒</button></div>`
      : ''}
  </form>`;
}

function attachmentHtml(list) {
  if (!list.length) return '<div class="small muted">还没有上传截图</div>';
  return list
    .map(
      (a, index) => `<div style="position:relative">
      <img class="thumb" src="${escapeHtml(a.url)}" alt="${escapeHtml(a.name)}" />
      <button type="button" class="icon-btn danger" data-remove-attachment="${index}"
        style="position:absolute;top:-6px;right:-6px;height:24px;padding:0 6px;border-radius:8px">
        ${icon('close', { size: 12, className: 'icon icon-sm' })}
      </button>
    </div>`
    )
    .join('');
}

/* ───────────────── 交互 ───────────────── */

function bind(root, ctx) {
  const editing = Boolean(ctx.params.id);
  const form = root.querySelector('#reminder-form');
  const state = {
    category: root.querySelector('.cat-option.is-active')?.dataset.cat || '',
    offsets: Array.from(root.querySelectorAll('.offset-pill.is-active')).map((b) => Number(b.dataset.offset)),
    attachments: [],
    saving: false,
  };

  // 预填已有附件（编辑态）
  if (editing) {
    api.reminder(ctx.params.id).then(({ reminder }) => {
      state.attachments = reminder.attachments || [];
    }).catch(() => {});
  }

  const notes = root.querySelector('#f-notes');
  const count = root.querySelector('#notes-count');
  const syncCount = () => { count.textContent = String(notes.value.length); };
  notes.addEventListener('input', syncCount);
  syncCount();

  root.querySelectorAll('.cat-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.category = btn.dataset.cat;
      root.querySelectorAll('.cat-option').forEach((b) => b.classList.toggle('is-active', b === btn));
      root.querySelector('#e-category').classList.add('hidden');
      const hint = root.querySelector('#category-hint');
      hint.textContent = ctx.meta?.categories?.find((c) => c.key === btn.dataset.cat)?.description || '';
    });
  });

  root.querySelectorAll('.offset-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const days = Number(btn.dataset.offset);
      if (state.offsets.includes(days)) state.offsets = state.offsets.filter((d) => d !== days);
      else state.offsets = [...state.offsets, days];
      btn.classList.toggle('is-active', state.offsets.includes(days));
    });
  });

  root.querySelectorAll('[data-quick-days]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const days = Number(btn.dataset.quickDays);
      const date = new Date(Date.now() + days * 86_400_000);
      root.querySelector('#f-deadline').value = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
    });
  });

  /* 图片选择 + 压缩 + 上传 */
  const fileInput = root.querySelector('#f-file');
  root.querySelector('#pick-file').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files || []);
    fileInput.value = '';
    for (const file of files.slice(0, 6 - state.attachments.length)) {
      const hint = root.querySelector('#upload-hint');
      hint.textContent = `正在压缩并上传 ${file.name}…`;
      try {
        const compressed = await compressImage(file);
        const data = await api.upload({
          filename: file.name,
          mime: compressed.mime,
          data: compressed.base64,
        });
        state.attachments = [...state.attachments, data.file];
        root.querySelector('#attachment-list').innerHTML = attachmentHtml(state.attachments);
        bindAttachmentRemoval(root, state);
        const kb = (data.file.size / 1024).toFixed(0);
        hint.textContent = `已上传 ${file.name}（压缩后 ${kb}KB）`;
      } catch (err) {
        hint.textContent = '上传失败';
        toastErr(err.message);
      }
    }
  });
  bindAttachmentRemoval(root, state);

  /* 提交 */
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state.saving) return;

    const title = root.querySelector('#f-title').value.trim();
    const deadline = root.querySelector('#f-deadline').value;
    const deadlineTime = root.querySelector('#f-time').value || null;
    const urlRaw = root.querySelector('#f-url').value.trim();
    const notesValue = notes.value.trim();

    let valid = true;
    valid = setError(root, 'title', title.length < 2 ? '标题至少 2 个字' : '') && valid;
    valid = setError(root, 'deadline', /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? '' : '请选择截止日期') && valid;
    if (!state.category) {
      root.querySelector('#e-category').classList.remove('hidden');
      valid = false;
    }

    const urlCheck = normalizeUrl(urlRaw);
    if (!urlCheck.ok) {
      setError(root, 'url', urlCheck.reason);
      valid = false;
    } else {
      setError(root, 'url', '');
    }
    if (!valid) {
      toastErr('请先修正表单中标红的字段');
      return;
    }

    state.saving = true;
    const button = root.querySelector('#save-reminder');
    button.disabled = true;
    button.innerHTML = `${icon('refresh', { size: 17, className: 'icon spin' })}保存中…`;

    const payload = {
      title,
      category: state.category,
      deadline,
      deadlineTime: deadlineTime || null,
      announcementUrl: urlCheck.value,
      notes: notesValue,
      remindOffsets: state.offsets.length ? state.offsets : DEFAULT_OFFSETS,
      attachments: state.attachments.map((a) => ({ name: a.name, url: a.url, size: a.size, mime: a.mime })),
    };

    try {
      if (editing) {
        await api.updateReminder(ctx.params.id, payload);
        toastOk('已保存修改');
        window.location.hash = `/reminders/${ctx.params.id}`;
      } else {
        const data = await api.createReminder(payload);
        toastOk('提醒已创建');
        window.location.hash = `/reminders/${data.reminder.id}`;
      }
    } catch (err) {
      toastErr(err.message);
      button.disabled = false;
      button.innerHTML = `${icon('check', { size: 17 })}${editing ? '保存修改' : '创建提醒'}`;
      state.saving = false;
    }
  });

  const delBtn = root.querySelector('#delete-from-editor');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: '删除这条提醒？',
        desc: '删除后无法恢复。',
        confirmText: '确认删除',
        danger: true,
      });
      if (!ok) return;
      try {
        await api.deleteReminder(ctx.params.id);
        toastOk('提醒已删除');
        window.location.hash = '/';
      } catch (err) {
        toastErr(err.message);
      }
    });
  }
}

function bindAttachmentRemoval(root, state) {
  root.querySelectorAll('[data-remove-attachment]').forEach((btn) => {
    btn.onclick = () => {
      const index = Number(btn.dataset.removeAttachment);
      state.attachments = state.attachments.filter((_, i) => i !== index);
      root.querySelector('#attachment-list').innerHTML = attachmentHtml(state.attachments);
      bindAttachmentRemoval(root, state);
    };
  });
}

function setError(root, field, message) {
  const box = root.querySelector(`#e-${field}`);
  const input = root.querySelector(`#f-${field}`);
  if (!box) return message === '';
  const span = box.querySelector('span');
  if (message) {
    span.textContent = message;
    box.classList.remove('hidden');
    if (input) input.classList.add('has-error');
    return false;
  }
  box.classList.add('hidden');
  if (input) input.classList.remove('has-error');
  return true;
}

/** 浏览器端压缩：长边 ≤1600px，JPEG 质量 0.82（PNG 透明图仍转 JPEG，公告截图无透明需求） */
function compressImage(file) {
  const MAX_EDGE = 1600;
  const QUALITY = 0.82;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片解析失败'));
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, width, height);
        context.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
        resolve({ mime: 'image/jpeg', base64: dataUrl.split(',')[1], width, height });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
