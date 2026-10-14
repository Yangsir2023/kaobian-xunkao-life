/** 前端通用工具：日期倒计时、格式化、分类元数据、DOM 小助手 */

export const pad2 = (n) => String(n).padStart(2, '0');

/** 与服务端 catalog.deadlineMeta 保持同一算法，保证列表与详情口径一致 */
export function countdown(deadline, deadlineTime) {
  const timePart = deadlineTime && /^\d{2}:\d{2}$/.test(deadlineTime) ? `${deadlineTime}:00` : '23:59:59';
  const target = new Date(`${deadline}T${timePart}`);
  const diffMs = target.getTime() - Date.now();
  const days = Math.ceil(diffMs / 86_400_000);
  let level = 'normal';
  if (diffMs < 0) level = 'expired';
  else if (days <= 3) level = 'urgent';
  else if (days <= 14) level = 'soon';
  return {
    days,
    expired: diffMs < 0,
    level,
    label: diffMs < 0 ? `已截止 ${Math.abs(days)} 天` : days === 0 ? '今天截止' : `还有 ${days} 天`,
    unitLabel: diffMs < 0 ? '天前截止' : days === 0 ? '今天' : '天后截止',
  };
}

export function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  const base = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  if (!withTime) return base;
  return `${base} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function relativeTime(value) {
  if (!value) return '—';
  const diff = Date.now() - Date.parse(value);
  if (!Number.isFinite(diff)) return value;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return formatDate(value, true);
}

export function todayLabel() {
  const now = new Date();
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
  return `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 · ${week}`;
}

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

/** 提交前对公告 URL 做与后端一致的宽松校验 */
export function normalizeUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return { ok: true, value: null };
  let candidate = raw;
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return { ok: false, reason: '仅支持 http/https 链接' };
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false, reason: '链接格式不正确' };
  }
}

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function passwordStrength(password = '') {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Za-z]/.test(password) && /[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const level = score >= 4 ? 'strong' : score >= 3 ? 'mid' : 'weak';
  const label = { weak: '强度偏弱', mid: '强度中等', strong: '强度良好' }[level];
  return { score, level, label };
}

/** 分类徽标（列表页在等宽 tile 上显示） */
export function categoryChip(reminder) {
  return `<span class="badge" style="background:${reminder.categoryAccent};color:${reminder.categoryColor}">
    <span class="badge-dot" style="background:${reminder.categoryColor}"></span>${escapeHtml(reminder.categoryName)}
  </span>`;
}

export function countdownClass(level) {
  return `countdown lv-${level}`;
}

export function debounce(fn, wait = 260) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function monthDayLabel(deadline, deadlineTime) {
  const [, month, day] = deadline.split('-');
  return `${Number(month)} 月 ${Number(day)} 日${deadlineTime ? ` ${deadlineTime}` : ''}`;
}
