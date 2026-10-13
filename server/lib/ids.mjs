import crypto from 'node:crypto';

/** 短 ID：时间有序，便于按创建时间排序与人工排查（22 字符 base32 风格） */
export function newId(prefix = '') {
  const ts = Date.now().toString(36).padStart(9, '0');
  const rand = crypto.randomBytes(8).toString('hex');
  return `${prefix}${prefix ? '_' : ''}${ts}${rand}`;
}

/** 不透明随机令牌（刷新令牌、OAuth state 用），32 字节 = 256 bit 熵 */
export function newOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** 令牌落库前一律哈希，数据库泄露也拿不到可用令牌 */
export function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function nowIso() {
  return new Date().toISOString();
}

export function isoPlusSeconds(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export function isExpired(isoString) {
  if (!isoString) return false;
  return Date.parse(isoString) <= Date.now();
}
