/**
 * 进程内滑动窗口限流。
 * 单机部署够用；多实例部署时应换成 Redis 计数器（接口保持一致即可平滑替换）。
 */
import { CODES, fail } from './errors.mjs';

const buckets = new Map();

export function createLimiter({ name, windowMs, max }) {
  return {
    name,
    /** 命中则返回剩余冷却秒数，未命中返回 0 */
    hit(key) {
      const now = Date.now();
      const bucketKey = `${name}:${key}`;
      let bucket = buckets.get(bucketKey);
      if (!bucket || now - bucket.start >= windowMs) {
        bucket = { start: now, count: 0 };
        buckets.set(bucketKey, bucket);
      }
      bucket.count += 1;
      if (bucket.count > max) {
        return Math.ceil((bucket.start + windowMs - now) / 1000);
      }
      return 0;
    },
    reset(key) {
      buckets.delete(`${name}:${key}`);
    },
  };
}

const loginLimiter = createLimiter({ name: 'login', windowMs: 60_000, max: 8 });
const registerLimiter = createLimiter({ name: 'register', windowMs: 600_000, max: 5 });
const refreshLimiter = createLimiter({ name: 'refresh', windowMs: 60_000, max: 30 });
const uploadLimiter = createLimiter({ name: 'upload', windowMs: 60_000, max: 20 });

export function enforce(limiter, key) {
  const retryAfter = limiter.hit(key);
  if (retryAfter > 0) {
    const error = fail(CODES.RATE_LIMITED, `操作过于频繁，请 ${retryAfter} 秒后再试`, 429);
    error.retryAfter = retryAfter;
    throw error;
  }
}

export const limiters = {
  login: (key) => enforce(loginLimiter, key),
  register: (key) => enforce(registerLimiter, key),
  refresh: (key) => enforce(refreshLimiter, key),
  upload: (key) => enforce(uploadLimiter, key),
  resetLogin: (key) => loginLimiter.reset(key),
};

/** 仅供测试使用：清空所有计数 */
export function resetAllLimiters() {
  buckets.clear();
}
