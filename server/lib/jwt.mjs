/**
 * 无状态鉴权令牌：JWT HS256。
 * 不引入第三方库 —— 用 node:crypto 的 HMAC 实现，签名校验使用定时安全比较。
 * 载荷只放非敏感信息（sub / role / jti），不放密码哈希、不放手机号。
 */
import crypto from 'node:crypto';
import { config } from '../config.mjs';
import { newId } from './ids.mjs';
import { CODES, fail } from './errors.mjs';

const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromB64url = (input) => Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

export function signAccessToken({ userId, username, role, sessionId }, ttlSeconds = config.jwt.accessTokenTtl) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: config.jwt.algorithm, typ: 'JWT' };
  const payload = {
    iss: config.jwt.issuer,
    sub: userId,
    usr: username,
    role,
    sid: sessionId || null,
    jti: newId(),
    iat: now,
    exp: now + ttlSeconds,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = crypto.createHmac('sha256', config.jwt.secret).update(signingInput).digest();
  return {
    token: `${signingInput}.${b64url(signature)}`,
    expiresIn: ttlSeconds,
    expiresAt: new Date((now + ttlSeconds) * 1000).toISOString(),
  };
}

export function verifyAccessToken(token) {
  if (typeof token !== 'string') throw fail(CODES.AUTH_TOKEN_INVALID, undefined, 401);
  const parts = token.split('.');
  if (parts.length !== 3) throw fail(CODES.AUTH_TOKEN_INVALID, undefined, 401);

  const [headerPart, payloadPart, signaturePart] = parts;
  const expected = crypto.createHmac('sha256', config.jwt.secret).update(`${headerPart}.${payloadPart}`).digest();
  const actual = Buffer.from(signaturePart.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

  // 长度不等时 timingSafeEqual 会抛错，先做长度守卫
  if (actual.length !== expected.length) throw fail(CODES.AUTH_TOKEN_INVALID, undefined, 401);
  if (!crypto.timingSafeEqual(actual, expected)) throw fail(CODES.AUTH_TOKEN_INVALID, undefined, 401);

  let header;
  let payload;
  try {
    header = JSON.parse(fromB64url(headerPart));
    payload = JSON.parse(fromB64url(payloadPart));
  } catch {
    throw fail(CODES.AUTH_TOKEN_INVALID, undefined, 401);
  }

  if (header.alg !== config.jwt.algorithm) throw fail(CODES.AUTH_TOKEN_INVALID, undefined, 401);
  if (payload.iss !== config.jwt.issuer) throw fail(CODES.AUTH_TOKEN_INVALID, undefined, 401);
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
    throw fail(CODES.AUTH_TOKEN_INVALID, '登录状态已过期，请重新登录', 401);
  }
  return payload;
}

/** 从 Authorization: Bearer xxx 中取出原始令牌 */
export function bearerFromHeader(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
  return match ? match[1] : null;
}
