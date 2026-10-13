/**
 * 腾讯云开发 CloudBase 驱动：云数据库（文档型集合）+ 云存储。
 *
 * 与本地驱动实现完全相同的集合接口，路由层零改动即可切云。
 * SDK 走 optionalDependencies 懒加载：只有 DB_DRIVER=cloudbase 时才 require，
 * 本地演示环境不需要安装任何依赖。
 *
 * 对应集合（需在 CloudBase 控制台创建，权限建议「仅管理端可读写」）：
 *   users / reminders / refresh_tokens / audit_logs / devices
 */
import { createRequire } from 'node:module';
import { toCloudBaseWhere } from '../lib/matcher.mjs';
import { newId } from '../lib/ids.mjs';

let tcbSdk = null;
// ESM 里没有 require，用 createRequire 构造以便懒加载可选依赖
const require = createRequire(import.meta.url);

function loadSdk() {
  if (tcbSdk) return tcbSdk;
  try {
    tcbSdk = require('@cloudbase/node-sdk');
  } catch {
    throw new Error(
      '未安装 @cloudbase/node-sdk。请执行 `npm i @cloudbase/node-sdk`，或把 DB_DRIVER 改回 local。'
    );
  }
  return tcbSdk;
}


class CloudBaseCollection {
  constructor(db, command, name) {
    this.db = db;
    this._ = command;
    this.name = name;
  }

  get col() {
    return this.db.collection(this.name);
  }

  async find(filter = {}, options = {}) {
    let query = this.col.where(toCloudBaseWhere(filter, this._));
    if (options.sort) query = query.orderBy(options.sort.field, options.sort.order || 'asc');
    if (options.offset) query = query.skip(options.offset);
    query = query.limit(options.limit ?? 100);
    const { data } = await query.get();
    return data || [];
  }

  async findOne(filter = {}) {
    const { data } = await this.col.where(toCloudBaseWhere(filter, this._)).limit(1).get();
    return data && data.length ? data[0] : null;
  }

  async findById(id) {
    return this.findOne({ id });
  }

  async count(filter = {}) {
    const { total } = await this.col.where(toCloudBaseWhere(filter, this._)).count();
    return total || 0;
  }

  async insertOne(doc) {
    const row = { id: doc.id || newId(), _id: doc.id || newId(), ...doc };
    delete row._id; // 让云数据库自行分配 _id，业务主键统一用 id 字段
    await this.col.add(row);
    return row;
  }

  async insertMany(docs) {
    const rows = docs.map((doc) => ({ id: doc.id || newId(), ...doc }));
    await this.col.add(rows);
    return rows;
  }

  async updateById(id, patch) {
    const { updated } = await this.col.where({ id }).update(patch);
    if (!updated) return null;
    return this.findById(id);
  }

  async updateMany(filter, patch) {
    const { updated } = await this.col.where(toCloudBaseWhere(filter, this._)).update(patch);
    return updated || 0;
  }

  async deleteById(id) {
    const { deleted } = await this.col.where({ id }).remove();
    return Boolean(deleted);
  }

  async deleteMany(filter) {
    const { deleted } = await this.col.where(toCloudBaseWhere(filter, this._)).remove();
    return deleted || 0;
  }

  async replaceAll(docs) {
    await this.deleteMany({});
    if (docs.length) await this.insertMany(docs);
    return docs.length;
  }
}

export function createCloudBaseDriver(options) {
  const { envId, secretId, secretKey, collectionPrefix = '' } = options;
  let app = null;
  let collections = null;

  return {
    driver: 'cloudbase',
    async init() {
      const tcb = loadSdk();
      app = tcb.init({ env: envId, secretId, secretKey, timeout: 10000 });
      const db = app.database();
      const command = db.command;
      const names = ['users', 'reminders', 'refresh_tokens', 'audit_logs', 'devices'];
      collections = {};
      for (const name of names) {
        collections[name] = new CloudBaseCollection(db, command, `${collectionPrefix}${name}`);
      }
      return { collections };
    },
    async health() {
      try {
        await collections.users.count({});
        return { ok: true, detail: `CloudBase 环境 ${envId}` };
      } catch (err) {
        return { ok: false, detail: `CloudBase 不可用：${err.message}` };
      }
    },
    /** 云存储：上传用户公告截图，返回可直接访问的临时链接 */
    async uploadFile({ cloudPath, buffer }) {
      const result = await app.uploadFile({ cloudPath, fileContent: buffer });
      const urlResult = await app.getTempFileURL({ fileList: [result.fileID] });
      const file = urlResult.fileList?.[0];
      return { fileId: result.fileID, url: file?.tempFileURL || result.fileID };
    },
    async close() {},
  };
}
