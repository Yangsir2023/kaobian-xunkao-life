/**
 * 配置层：读取 .env（零依赖手写解析）+ 默认值 + 运行期常量。
 * 所有可调项都从这里出口，其它模块不允许直接读 process.env。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));

/** 极简 .env 解析：支持注释、引号、空行；已存在的真实环境变量优先 */
function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv(path.join(ROOT, '.env'));

const env = (key, fallback = '') => {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
};

const num = (key, fallback) => {
  const v = Number.parseInt(env(key, ''), 10);
  return Number.isFinite(v) ? v : fallback;
};

const DATA_DIR = path.isAbsolute(env('DATA_DIR', './data'))
  ? env('DATA_DIR', './data')
  : path.resolve(ROOT, env('DATA_DIR', './data'));

/**
 * JWT 密钥：生产必须由环境变量提供。
 * 开发模式为了“开箱即跑”，首次启动自动生成并落盘（该文件已被 .gitignore 忽略）。
 */
function resolveJwtSecret() {
  const fromEnv = env('JWT_SECRET', '');
  if (fromEnv) {
    if (fromEnv.length < 32 && env('NODE_ENV', 'development') === 'production') {
      throw new Error('JWT_SECRET 长度不足 32 位，生产环境拒绝启动');
    }
    return { secret: fromEnv, generated: false };
  }
  if (env('NODE_ENV', 'development') === 'production') {
    throw new Error('生产环境必须显式设置 JWT_SECRET');
  }
  const secretFile = path.join(DATA_DIR, '.jwt_secret');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(secretFile)) {
    return { secret: fs.readFileSync(secretFile, 'utf8').trim(), generated: false };
  }
  const secret = crypto.randomBytes(48).toString('base64url');
  fs.writeFileSync(secretFile, secret, { mode: 0o600 });
  return { secret, generated: true };
}

const jwt = resolveJwtSecret();

export const config = {
  port: num('PORT', 8787),
  host: env('HOST', '127.0.0.1'),
  nodeEnv: env('NODE_ENV', 'development'),
  isProd: env('NODE_ENV', 'development') === 'production',

  dbDriver: env('DB_DRIVER', 'local').toLowerCase(),
  dataDir: DATA_DIR,
  uploadsDir: path.join(DATA_DIR, 'uploads'),

  cloudbase: {
    envId: env('CLOUDBASE_ENV_ID', ''),
    secretId: env('CLOUDBASE_SECRET_ID', ''),
    secretKey: env('CLOUDBASE_SECRET_KEY', ''),
    collectionPrefix: env('CLOUDBASE_COLLECTION_PREFIX', ''),
    get configured() {
      return Boolean(this.envId && this.secretId && this.secretKey);
    },
  },

  jwt: {
    secret: jwt.secret,
    secretGenerated: jwt.generated,
    issuer: 'xunkao-calendar',
    algorithm: 'HS256',
    accessTokenTtl: num('ACCESS_TOKEN_TTL', 900), // 15 分钟
    refreshTokenTtl: num('REFRESH_TOKEN_TTL', 60 * 60 * 24 * 30), // 30 天
  },

  wechat: {
    appId: env('WECHAT_APP_ID', ''),
    appSecret: env('WECHAT_APP_SECRET', ''),
    scope: env('WECHAT_SCOPE', 'snsapi_login'),
    redirectUri: env('WECHAT_REDIRECT_URI', `http://127.0.0.1:${num('PORT', 8787)}/api/auth/wechat/callback`),
    /** 未配置 AppID/Secret 时自动降级为 Mock 授权通道 */
    get mock() {
      return !(this.appId && this.appSecret);
    },
  },

  corsOrigin: env('CORS_ORIGIN', '*'),
  uploadMaxBytes: num('UPLOAD_MAX_BYTES', 3 * 1024 * 1024),

  /** 集合名（本地驱动为 <DATA_DIR>/db/<name>.json，云开发为集合名） */
  collections: {
    users: 'users',
    reminders: 'reminders',
    refreshTokens: 'refresh_tokens',
    auditLogs: 'audit_logs',
    devices: 'devices',
  },
};

/** 启动时的自检提示（不抛错，只提示，方便用户知道当前跑在什么模式） */
export function startupNotices() {
  const out = [];
  out.push(`运行模式      ${config.nodeEnv}`);
  out.push(`数据驱动      ${config.dbDriver}`);
  if (config.dbDriver === 'cloudbase') {
    out.push(
      config.cloudbase.configured
        ? `CloudBase 环境  ${config.cloudbase.envId}（已配置密钥）`
        : 'CloudBase 环境  ⚠ 未配置 CLOUDBASE_ENV_ID / SECRET_ID / SECRET_KEY，将回退到本地驱动'
    );
  } else {
    out.push(`本地数据目录  ${config.dataDir}`);
  }
  out.push(
    config.jwt.secretGenerated
      ? 'JWT 密钥      开发模式自动生成（data/.jwt_secret，已 gitignore）'
      : 'JWT 密钥      来自环境变量'
  );
  out.push(config.wechat.mock ? '微信授权      Mock 通道（未配置 AppID/Secret）' : `微信授权      真实通道（AppID ${config.wechat.appId.slice(0, 6)}***）`);
  return out;
}
