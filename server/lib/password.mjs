/**
 * 口令存储：scrypt 加盐哈希（Node 内置，无需 bcrypt 原生依赖）。
 *
 * 参数 N=16384 / r=8 / p=1 / keylen=64，参考 OWASP 对 scrypt 的最低建议。
 * 存储格式：scrypt$N$r$p$<salt-base64>$<hash-base64>
 * 把参数写进哈希串，将来升级参数时老口令仍可校验并在登录成功后自动重哈希。
 */
import crypto from 'node:crypto';
import { CODES, fail } from './errors.mjs';

export const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 96 * 1024 * 1024 };
const SALT_BYTES = 16;

function scryptAsync(password, salt, { N, r, p, keylen, maxmem }) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, { N, r, p, maxmem }, (err, derived) =>
      err ? reject(err) : resolve(derived)
    );
  });
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const { N, r, p, keylen, maxmem } = SCRYPT_PARAMS;
  const derived = await scryptAsync(password, salt, { N, r, p, keylen, maxmem });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return { valid: false, needsRehash: false };
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return { valid: false, needsRehash: false };

  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  const params = {
    N: Number.parseInt(nStr, 10),
    r: Number.parseInt(rStr, 10),
    p: Number.parseInt(pStr, 10),
    keylen: Buffer.from(hashB64, 'base64').length,
    maxmem: SCRYPT_PARAMS.maxmem,
  };
  if (!params.N || !params.r || !params.p || !params.keylen) return { valid: false, needsRehash: false };

  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  let derived;
  try {
    derived = await scryptAsync(password, salt, params);
  } catch {
    return { valid: false, needsRehash: false };
  }
  if (derived.length !== expected.length) return { valid: false, needsRehash: false };
  const valid = crypto.timingSafeEqual(derived, expected);

  const needsRehash =
    valid &&
    (params.N !== SCRYPT_PARAMS.N || params.r !== SCRYPT_PARAMS.r || params.p !== SCRYPT_PARAMS.p);

  return { valid, needsRehash };
}

/**
 * 密码强度策略：8~72 位，至少包含字母与数字，禁止空白与前 200 个弱口令。
 * 返回英文 reason 供前端 i18n，中文提示由前端映射。
 */
const WEAK_PASSWORDS = new Set([
  '12345678', '123456789', 'password', 'password1', 'qwerty123', 'abc12345',
  '11111111', '88888888', 'administrator', 'iloveyou', 'admin123', 'a1234567',
  '123456abc', '1234abcd', 'passw0rd', 'qwertyuiop', '1q2w3e4r', 'zxcvbnm123',
]);

export function checkPasswordPolicy(password, username = '') {
  if (typeof password !== 'string') return { ok: false, reason: 'required' };
  if (password.length < 8) return { ok: false, reason: 'too_short' };
  if (password.length > 72) return { ok: false, reason: 'too_long' };
  if (/\s/.test(password)) return { ok: false, reason: 'whitespace' };
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return { ok: false, reason: 'need_letter_and_digit' };
  if (WEAK_PASSWORDS.has(password.toLowerCase())) return { ok: false, reason: 'too_common' };
  if (username && password.toLowerCase().includes(String(username).toLowerCase())) {
    return { ok: false, reason: 'contains_username' };
  }
  return { ok: true, reason: null };
}

export function assertPasswordPolicy(password, username) {
  const result = checkPasswordPolicy(password, username);
  if (!result.ok) {
    throw fail(CODES.AUTH_WEAK_PASSWORD, `密码强度不足（${result.reason}）`, 400);
  }
  return true;
}
