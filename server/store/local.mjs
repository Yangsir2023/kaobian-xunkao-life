/**
 * 本地 JSON 集合驱动（默认驱动，零配置开箱即跑）。
 *
 * 设计要点：
 * 1) 每个集合一个 JSON 文件，内存缓存 + 写队列串行落盘；
 * 2) 落盘用「写临时文件 + rename」保证原子性，避免进程被杀导致文件半截；
 * 3) 暴露的查询接口与 CloudBase 驱动完全一致（find/findOne/insertOne/updateById/...），
 *    路由层只依赖接口、不依赖具体驱动 —— 换云只改一个环境变量。
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { matchOne } from '../lib/matcher.mjs';
import { newId } from '../lib/ids.mjs';

class LocalCollection {
  constructor(name, file) {
    this.name = name;
    this.file = file;
    this.docs = [];
    this.queue = Promise.resolve();
  }

  async load() {
    try {
      const text = await fsp.readFile(this.file, 'utf8');
      const parsed = JSON.parse(text);
      this.docs = Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn(`[store] 集合 ${this.name} 读取失败（按空集合处理）：${err.message}`);
      }
      this.docs = [];
    }
    return this;
  }

  persist() {
    this.queue = this.queue.then(async () => {
      const tmp = `${this.file}.${process.pid}.tmp`;
      await fsp.mkdir(path.dirname(this.file), { recursive: true });
      await fsp.writeFile(tmp, JSON.stringify(this.docs, null, 2), 'utf8');
      await fsp.rename(tmp, this.file);
    });
    return this.queue;
  }

  async find(filter = {}, options = {}) {
    let rows = this.docs.filter((doc) => matchOne(doc, filter));
    if (options.sort) {
      const { field, order = 'asc' } = options.sort;
      rows = [...rows].sort((a, b) => {
        const av = a[field] ?? '';
        const bv = b[field] ?? '';
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * (order === 'desc' ? -1 : 1);
      });
    }
    if (options.offset) rows = rows.slice(options.offset);
    if (options.limit != null) rows = rows.slice(0, options.limit);
    return rows.map((doc) => structuredClone(doc));
  }

  async findOne(filter = {}) {
    const doc = this.docs.find((item) => matchOne(item, filter));
    return doc ? structuredClone(doc) : null;
  }

  async findById(id) {
    return this.findOne({ id });
  }

  async count(filter = {}) {
    return this.docs.filter((doc) => matchOne(doc, filter)).length;
  }

  async insertOne(doc) {
    const row = { id: doc.id || newId(), ...doc };
    this.docs.push(row);
    await this.persist();
    return structuredClone(row);
  }

  async insertMany(docs) {
    const rows = docs.map((doc) => ({ id: doc.id || newId(), ...doc }));
    this.docs.push(...rows);
    await this.persist();
    return rows.map((row) => structuredClone(row));
  }

  async updateById(id, patch) {
    const index = this.docs.findIndex((doc) => doc.id === id);
    if (index < 0) return null;
    this.docs[index] = { ...this.docs[index], ...patch, id };
    await this.persist();
    return structuredClone(this.docs[index]);
  }

  async updateMany(filter, patch) {
    let affected = 0;
    this.docs = this.docs.map((doc) => {
      if (!matchOne(doc, filter)) return doc;
      affected += 1;
      return { ...doc, ...patch, id: doc.id };
    });
    if (affected) await this.persist();
    return affected;
  }

  async deleteById(id) {
    const before = this.docs.length;
    this.docs = this.docs.filter((doc) => doc.id !== id);
    if (this.docs.length !== before) {
      await this.persist();
      return true;
    }
    return false;
  }

  async deleteMany(filter) {
    const before = this.docs.length;
    this.docs = this.docs.filter((doc) => !matchOne(doc, filter));
    const affected = before - this.docs.length;
    if (affected) await this.persist();
    return affected;
  }

  /** 仅供运维/测试：整集合重写（种子数据用） */
  async replaceAll(docs) {
    this.docs = docs.map((doc) => ({ id: doc.id || newId(), ...doc }));
    await this.persist();
    return this.docs.length;
  }
}

export function createLocalDriver(dataDir) {
  const dbDir = path.join(dataDir, 'db');
  const collectionNames = ['users', 'reminders', 'refresh_tokens', 'audit_logs', 'devices'];

  return {
    driver: 'local',
    dbDir,
    async init() {
      await fsp.mkdir(dbDir, { recursive: true });
      const collections = {};
      for (const name of collectionNames) {
        const col = new LocalCollection(name, path.join(dbDir, `${name}.json`));
        await col.load();
        collections[name] = col;
      }
      return { collections };
    },
    async health() {
      return { ok: fs.existsSync(dbDir), detail: `本地数据目录 ${dbDir}` };
    },
    async close() {},
  };
}
