#!/usr/bin/env node
/**
 * 种子数据导入：把公共招考节点写入数据库（幂等，重复执行不会产生重复节点）。
 *
 * 用法：
 *   node server/seed.mjs                 # 导入（已存在同标题节点则跳过）
 *   node server/seed.mjs --reset         # 先清空公共节点再导入
 *   node server/seed.mjs --demo-account  # 额外创建演示账号（随机密码只打印一次）
 */
import { initStore, db } from './store/index.mjs';
import { newId, nowIso } from './lib/ids.mjs';
import { hashPassword } from './lib/password.mjs';
import { ROLES } from './security/auth.mjs';
import { importOfficialNodes, OFFICIAL_NODES } from './official-nodes.mjs';

async function run() {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const withDemo = args.includes('--demo-account');

  await initStore();

  console.log(`[seed] 数据集共 ${OFFICIAL_NODES.length} 条公共节点`);
  const result = await importOfficialNodes({ db, newId, nowIso, reset });
  console.log(`[seed] 导入完成：新增 ${result.inserted} 条，跳过已存在 ${result.skipped} 条，库内合计 ${result.total} 条`);

  if (withDemo) {
    const username = 'demo';
    const existing = await db.users().findOne({ username });
    if (existing) {
      console.log('[seed] 演示账号已存在，跳过创建');
    } else {
      const password = `Xk${Math.random().toString(36).slice(2, 8)}${Math.floor(Math.random() * 90 + 10)}`;
      const role = (await db.users().count({})) === 0 ? ROLES.ADMIN : ROLES.USER;
      await db.users().insertOne({
        id: newId('usr'),
        username,
        displayName: '演示账号',
        passwordHash: await hashPassword(password),
        role,
        status: 'active',
        wechatOpenId: null,
        createdAt: nowIso(),
        lastLoginAt: null,
        passwordUpdatedAt: nowIso(),
      });
      console.log(`[seed] 演示账号：${username} / ${password}（角色 ${role}）—— 密码仅显示本次，请登录后尽快修改`);
    }
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] 失败：', err);
  process.exit(1);
});
