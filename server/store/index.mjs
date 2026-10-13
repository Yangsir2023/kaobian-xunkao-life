/**
 * 存储门面：根据配置选择驱动，向路由层暴露统一的 db 接口。
 * 这是「换存储不改业务代码」的唯一接触点。
 */
import { config } from '../config.mjs';
import { createLocalDriver } from './local.mjs';

let driver = null;
let collections = {};
let fallbackNotice = null;

export async function initStore() {
  if (driver) return driver;

  if (config.dbDriver === 'cloudbase') {
    if (!config.cloudbase.configured) {
      fallbackNotice = 'CLOUDBASE_* 环境变量不完整，已自动回退到本地 JSON 驱动';
      console.warn(`[store] ${fallbackNotice}`);
      driver = createLocalDriver(config.dataDir);
    } else {
      const { createCloudBaseDriver } = await import('./cloudbase.mjs');
      driver = createCloudBaseDriver(config.cloudbase);
    }
  } else {
    driver = createLocalDriver(config.dataDir);
  }

  const initialized = await driver.init();
  collections = initialized.collections;
  return driver;
}

export function getCollection(name) {
  if (!collections[name]) throw new Error(`未知集合：${name}`);
  return collections[name];
}

export const db = {
  users: () => getCollection('users'),
  reminders: () => getCollection('reminders'),
  refreshTokens: () => getCollection('refresh_tokens'),
  auditLogs: () => getCollection('audit_logs'),
  devices: () => getCollection('devices'),
};

export function storeInfo() {
  return {
    driver: driver?.driver || config.dbDriver,
    fallbackNotice,
    /** 是否拥有云存储能力（本地驱动写磁盘，云驱动写 COS） */
    cloudStorage: driver?.driver === 'cloudbase' && typeof driver.uploadFile === 'function',
  };
}

export async function storeHealth() {
  if (!driver) return { ok: false, detail: '存储未初始化' };
  const result = await driver.health();
  return { ...result, driver: driver.driver };
}

export async function closeStore() {
  if (driver) await driver.close();
}

/** 上传能力抽象：本地写盘返回 /uploads/xxx，云驱动走 CloudBase 云存储 */
export async function persistUpload({ filename, buffer }) {
  if (driver?.driver === 'cloudbase' && typeof driver.uploadFile === 'function') {
    return driver.uploadFile({ cloudPath: `announcements/${filename}`, buffer });
  }
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  await fs.mkdir(config.uploadsDir, { recursive: true });
  await fs.writeFile(path.join(config.uploadsDir, filename), buffer);
  return { fileId: null, url: `/uploads/${filename}` };
}
