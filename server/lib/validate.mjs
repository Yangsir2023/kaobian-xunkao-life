/** 轻量参数校验：不引第三方库，统一抛 1001/2001 类错误码 */
import { CODES, fail } from './errors.mjs';

export function str(value, field, { min = 1, max = 200, required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw fail(CODES.AUTH_INVALID_PARAMS, `缺少必填字段：${field}`, 400);
    return null;
  }
  if (typeof value !== 'string') throw fail(CODES.AUTH_INVALID_PARAMS, `${field} 必须是字符串`, 400);
  const trimmed = value.trim();
  if (trimmed.length < min) throw fail(CODES.AUTH_INVALID_PARAMS, `${field} 至少 ${min} 个字符`, 400);
  if (trimmed.length > max) throw fail(CODES.AUTH_INVALID_PARAMS, `${field} 最多 ${max} 个字符`, 400);
  return trimmed;
}

export function username(value) {
  const raw = str(value, 'username', { min: 3, max: 32 });
  if (!/^[A-Za-z0-9_.-]+$/.test(raw)) {
    throw fail(CODES.AUTH_INVALID_PARAMS, '用户名只能包含字母、数字、下划线、点或短横线', 400);
  }
  if (/^\d+$/.test(raw)) {
    throw fail(CODES.AUTH_INVALID_PARAMS, '用户名不能是纯数字', 400);
  }
  return raw.toLowerCase();
}

export function dateOnly(value, field = 'deadline') {
  const raw = str(value, field, { min: 8, max: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw fail(CODES.REMINDER_BAD_DEADLINE, `${field} 格式应为 YYYY-MM-DD`, 400);
  }
  const [year, month, day] = raw.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  // 必须用「本地日期分量」回比：用 toISOString 会因为时区偏移把本地 00:00 变成前一天
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw fail(CODES.REMINDER_BAD_DEADLINE, `${field} 不是有效日期`, 400);
  }
  if (year < 2000 || year > 2100) {
    throw fail(CODES.REMINDER_BAD_DEADLINE, `${field} 年份超出合理范围`, 400);
  }
  return raw;
}

export function timeOnly(value) {
  if (value === undefined || value === null || value === '') return null;
  const raw = String(value).trim();
  if (!/^\d{2}:\d{2}$/.test(raw)) {
    throw fail(CODES.REMINDER_INVALID_PARAMS, 'deadlineTime 格式应为 HH:mm', 400);
  }
  const [h, m] = raw.split(':').map(Number);
  if (h > 23 || m > 59) throw fail(CODES.REMINDER_INVALID_PARAMS, 'deadlineTime 不是有效时间', 400);
  return raw;
}

export function httpUrl(value, field = 'announcementUrl', { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw fail(CODES.REMINDER_INVALID_PARAMS, `缺少必填字段：${field}`, 400);
    return null;
  }
  const raw = String(value).trim();
  if (raw.length > 1000) throw fail(CODES.REMINDER_BAD_URL, `${field} 过长`, 400);

  // 与前端一致地宽容处理：用户常直接粘贴域名（bm.scs.gov.cn），自动补 https://
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw fail(CODES.REMINDER_BAD_URL, `${field} 不是合法链接`, 400);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw fail(CODES.REMINDER_BAD_URL, `${field} 必须以 http:// 或 https:// 开头`, 400);
  }
  return parsed.toString();
}

export function intInRange(value, field, { min, max, fallback }) {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num) || num < min || num > max) {
    throw fail(CODES.AUTH_INVALID_PARAMS, `${field} 需在 ${min}~${max} 之间`, 400);
  }
  return num;
}

export function oneOf(value, allowed, field, { fallback = null } = {}) {
  if (value === undefined || value === null || value === '') return fallback;
  if (!allowed.includes(value)) {
    throw fail(CODES.AUTH_INVALID_PARAMS, `${field} 只能是：${allowed.join(' / ')}`, 400);
  }
  return value;
}
