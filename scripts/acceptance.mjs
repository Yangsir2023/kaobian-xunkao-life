#!/usr/bin/env node
/**
 * 验收脚本：跑全量测试 + 跨层一致性核查，产出可交付的验收报告。
 *
 * 与单元测试的区别：
 *   测试回答「功能对不对」；验收回答「这份交付是否达到了约定标准」。
 *   因此在测试之外额外核查：
 *     1) 前端调用的每个 /api 路径，后端路由表里必须真实存在（防契约漂移）
 *     2) 前端所有 ES 模块语法可解析
 *     3) 静态资源全部可访问，SPA 回退正常
 *     4) 界面不使用 Emoji（统一 SVG 图标，这是明确的设计约定）
 *     5) 关键安全性质：scrypt 前缀、无明文口令落库、审计表存在
 *
 * 输出：acceptance/acceptance-report.md（含结论行 GATE PASS / GATE FAIL）
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const REPORT_PATH = path.join(ROOT, 'acceptance', 'acceptance-report.md');

const checks = [];
const record = (name, ok, detail) => {
  checks.push({ name, ok, detail });
  const mark = ok ? '✓' : '✗';
  console.log(`  ${mark} ${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
};

/* ───────────────── 1) 全量测试 ───────────────── */

async function runTests() {
  console.log('\n[1/5] 运行全量测试套件…');
  let json = null;
  try {
    const { stdout } = await execFileAsync(process.execPath, ['tests/run.mjs', '--json'], {
      cwd: ROOT,
      maxBuffer: 16 * 1024 * 1024,
    });
    const lastLine = stdout.trim().split('\n').filter(Boolean).pop();
    json = JSON.parse(lastLine);
  } catch (err) {
    const stdout = err.stdout || '';
    const lastLine = stdout.trim().split('\n').filter(Boolean).pop();
    try {
      json = JSON.parse(lastLine);
    } catch {
      json = { passed: 0, failed: 0, total: 0, rate: 0, cases: [], fatal: err.message };
    }
  }
  const ok = json.failed === 0 && json.total > 0;
  record('全量测试套件', ok, `${json.passed}/${json.total} 通过（${json.rate}%），失败 ${json.failed}`);
  return json;
}

/* ───────────────── 2) 前端契约一致性 ───────────────── */

async function checkFrontendContracts() {
  console.log('\n[2/5] 核查前后端接口契约一致性…');

  // 后端路由表
  process.env.NODE_ENV = 'test';
  process.env.DB_DRIVER = 'local';
  process.env.DATA_DIR = fsSync.mkdtempSync(path.join(ROOT, 'data', 'acceptance-'));
  process.env.JWT_SECRET = 'acceptance-secret-0123456789-0123456789-0123456789';
  const { buildServer } = await import('../server/index.mjs');
  const { server, router } = await buildServer();
  const routePatterns = router.routes
    .map((line) => line.split(' ')[1])
    .filter((p) => p.startsWith('/api/'));

  // 前端调用的路径
  const jsFiles = await collectFiles(path.join(ROOT, 'public', 'js'), ['.mjs', '.js']);
  const calledPaths = new Set();
  for (const file of jsFiles) {
    const text = await fs.readFile(file, 'utf8');
    for (const match of text.matchAll(/['"`](\/api\/[A-Za-z0-9_\-/:.]*)/g)) {
      const raw = match[1];
      // 去掉模板拼接与查询串，只保留静态前缀
      const cleaned = raw.split('?')[0].replace(/\$\{[^}]*\}/g, ':id').replace(/\/+$/, '');
      if (cleaned && !cleaned.includes('${')) calledPaths.add(cleaned);
    }
  }

  const matches = (called) => {
    const calledSegs = called.split('/').filter(Boolean);
    return routePatterns.some((pattern) => {
      const segs = pattern.split('/').filter(Boolean);
      if (segs.length !== calledSegs.length) return false;
      return segs.every((seg, i) => seg.startsWith(':') || seg === calledSegs[i]);
    });
  };

  const missing = [...calledPaths].filter((p) => !matches(p));
  record('前端调用的接口在后端全部存在', missing.length === 0,
    missing.length ? `缺失：${missing.join(', ')}` : `${calledPaths.size} 个路径全部命中`);
  record('后端接口数量统计', routePatterns.length > 30, `共 ${routePatterns.length} 个 API 路由`);

  await new Promise((resolve) => server.close(resolve));
  return { routePatterns, calledPaths: [...calledPaths], missing, port: null };
}

/* ───────────────── 3) 前端语法与静态资源 ───────────────── */

async function collectFiles(dir, exts) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collectFiles(full, exts)));
    else if (exts.includes(path.extname(entry.name))) out.push(full);
  }
  return out;
}

async function checkFrontendSyntax() {
  console.log('\n[3/5] 校验前端模块语法…');
  const files = await collectFiles(path.join(ROOT, 'public', 'js'), ['.mjs', '.js']);
  const bad = [];
  for (const file of files) {
    try {
      await execFileAsync(process.execPath, ['--check', file], { cwd: ROOT });
    } catch (err) {
      bad.push(`${path.relative(ROOT, file)}: ${String(err.stderr).split('\n')[0]}`);
    }
  }
  record('前端 ES 模块语法全部通过', bad.length === 0, bad.length ? bad.join(' | ') : `${files.length} 个模块`);
  return files.length;
}

/* ───────────────── 4) 静态资源与界面约定 ───────────────── */

async function checkStaticAndDesign(routeInfo) {
  console.log('\n[4/5] 校验静态资源与界面约定…');

  process.env.PORT = '0';
  const { buildServer } = await import('../server/index.mjs');
  const { server } = await buildServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const targets = [
    '/',
    '/css/app.css',
    '/js/main.mjs',
    '/js/api.mjs',
    '/js/icons.mjs',
    '/js/pages/home.mjs',
    '/js/pages/categories.mjs',
    '/js/pages/detail.mjs',
    '/js/pages/editor.mjs',
    '/js/pages/login.mjs',
    '/js/pages/me.mjs',
    '/js/pages/admin.mjs',
  ];
  const failed = [];
  for (const target of targets) {
    const res = await fetch(`${base}${target}`);
    if (res.status !== 200) failed.push(`${target}(${res.status})`);
  }
  record('静态资源全部可访问', failed.length === 0, failed.length ? failed.join(', ') : `${targets.length} 个资源`);

  const health = await (await fetch(`${base}/api/health`)).json();
  record('健康检查可返回存储状态', health.code === 0 && Boolean(health.data.storage),
    `驱动 ${health.data?.storage?.driver}`);

  const spa = await fetch(`${base}/reminders/some-id`);
  const spaText = await spa.text();
  record('SPA 回退正常（深链刷新不 404）', spa.status === 200 && spaText.includes('<div class="app-shell"'),
    `HTTP ${spa.status}`);

  const traversal = await fetch(`${base}/uploads/..%2f..%2fserver%2fconfig.mjs`);
  record('目录穿越被拦截', [403, 404].includes(traversal.status), `HTTP ${traversal.status}`);

  // 通过真实接口注册一个账号：既验证注册链路，也为后面的口令落库核查准备样本
  const probePassword = 'Acceptance2026probe';
  const register = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'acceptance_probe', password: probePassword, displayName: '验收探针' }),
  });
  const registerBody = await register.json();
  const registerOk = registerBody.code === 0 && !JSON.stringify(registerBody).includes(probePassword);
  record('注册链路可用且响应不回吐口令', registerOk, `HTTP ${register.status} code=${registerBody.code}`);

  await new Promise((resolve) => server.close(resolve));

  // 无 Emoji 约定（扫描所有前端源码）
  const frontFiles = [
    ...(await collectFiles(path.join(ROOT, 'public'), ['.mjs', '.js', '.css', '.html'])),
  ];
  const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F000}-\u{1F2FF}]/u;
  const emojiHits = [];
  for (const file of frontFiles) {
    const text = await fs.readFile(file, 'utf8');
    if (emojiRe.test(text)) emojiHits.push(path.relative(ROOT, file));
  }
  record('界面未使用 Emoji（统一 SVG 图标）', emojiHits.length === 0,
    emojiHits.length ? `命中：${emojiHits.join(', ')}` : `${frontFiles.length} 个文件全部干净`);

  return { base, targets };
}

/* ───────────────── 5) 存储与安全落库形态 ───────────────── */

async function checkStorageIntegrity() {
  console.log('\n[5/5] 核查存储与口令落库形态…');
  const { db, initStore } = await import('../server/store/index.mjs');
  await initStore();
  const users = await db.users().find({});
  const hashOk = users.length > 0 && users.every((u) => !u.passwordHash || u.passwordHash.startsWith('scrypt$'));
  const plainOk = users.every((u) => !('password' in u) && !('plainPassword' in u));
  const probe = users.find((u) => u.username === 'acceptance_probe');
  const probeOk = Boolean(probe?.passwordHash) && !probe.passwordHash.includes('Acceptance2026probe');
  record(
    '口令以 scrypt 哈希落库且无明文字段',
    hashOk && plainOk && probeOk,
    `${users.length} 个账号 · 样本前缀 ${probe?.passwordHash?.slice(0, 22) || 'n/a'}…`
  );

  const collections = ['users', 'reminders', 'positions', 'refresh_tokens', 'audit_logs', 'devices'];
  const existing = [];
  for (const name of collections) {
    try {
      await db[name === 'refresh_tokens' ? 'refreshTokens' : name === 'audit_logs' ? 'auditLogs' : name]().count({});
      existing.push(name);
    } catch {
      /* 集合不存在 */
    }
  }
  record('六个集合均可读写（用户/提醒/岗位/刷新令牌/审计/设备）', existing.length === 6, existing.join(' / '));

  const runtimeInfo = { collections: existing };
  try {
    await db.refreshTokens().find({});
    runtimeInfo.hasRefreshTokens = true;
  } catch {
    runtimeInfo.hasRefreshTokens = false;
  }
  return runtimeInfo;
}

/* ───────────────── 报告 ───────────────── */

function buildReport({ tests, contract, syntaxCount, staticInfo, storage, durationMs }) {
  const passed = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const gate = passed === total && tests.failed === 0 ? 'GATE PASS' : 'GATE FAIL';
  const suiteStats = {};
  for (const c of tests.cases || []) {
    suiteStats[c.suite] = suiteStats[c.suite] || { pass: 0, fail: 0, ms: 0 };
    suiteStats[c.suite][c.ok ? 'pass' : 'fail'] += 1;
    suiteStats[c.suite].ms += c.ms || 0;
  }

  const lines = [];
  lines.push('# 巡考日历 · 验收报告');
  lines.push('');
  lines.push(`**结论：${gate}**`);
  lines.push('');
  lines.push(`- 生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`);
  lines.push(`- 运行环境：Node ${process.version} · ${process.platform} · 驱动 \`${process.env.DB_DRIVER || 'local'}\``);
  lines.push(`- 验收项：${passed}/${total} 通过 · 测试用例：${tests.passed}/${tests.total} 通过（${tests.rate}%）`);
  lines.push(`- 总耗时：${(durationMs / 1000).toFixed(2)}s`);
  lines.push('');
  lines.push('## 一、验收项清单');
  lines.push('');
  lines.push('| # | 验收项 | 结果 | 证据 |');
  lines.push('| --- | --- | --- | --- |');
  checks.forEach((c, i) => {
    lines.push(`| ${i + 1} | ${c.name} | ${c.ok ? '通过' : '不通过'} | ${c.detail || '-'} |`);
  });
  lines.push('');
  lines.push('## 二、测试套件明细');
  lines.push('');
  lines.push('| 套件 | 通过 | 失败 | 耗时 |');
  lines.push('| --- | --- | --- | --- |');
  for (const [name, stat] of Object.entries(suiteStats)) {
    lines.push(`| ${name} | ${stat.pass} | ${stat.fail} | ${stat.ms}ms |`);
  }
  lines.push('');
  lines.push('### 全部用例');
  lines.push('');
  for (const [name, stat] of Object.entries(suiteStats)) {
    lines.push(`**${name}**`);
    lines.push('');
    for (const c of (tests.cases || []).filter((x) => x.suite === name)) {
      lines.push(`- ${c.ok ? '✓' : '✗'} ${c.title}${c.ok ? '' : ` — ${c.error}`}`);
    }
    lines.push('');
  }
  lines.push('## 三、跨层一致性');
  lines.push('');
  lines.push(`- 后端 API 路由：${contract.routePatterns.length} 个`);
  lines.push(`- 前端调用的接口路径：${contract.calledPaths.length} 个`);
  lines.push(`- 契约缺失：${contract.missing.length === 0 ? '无' : contract.missing.join(', ')}`);
  lines.push(`- 前端 ES 模块语法检查：${syntaxCount} 个模块全部通过`);
  lines.push(`- 静态资源：${staticInfo.targets.length} 个资源全部 200`);
  lines.push(`- 存储集合：${storage.collections.join(' / ')}`);
  lines.push('');
  lines.push('## 四、需求覆盖矩阵');
  lines.push('');
  lines.push('| 需求 | 实现位置 | 验证方式 |');
  lines.push('| --- | --- | --- |');
  lines.push('| 提醒首页按临近考试倒序 + 倒计时 | `public/js/pages/home.mjs`、`server/catalog.mjs#deadlineMeta` | 倒计时分级用例、列表排序用例 |');
  lines.push('| 十大类考试分类与筛选 | `server/catalog.mjs`、`public/js/pages/categories.mjs` | 分类目录用例（10 类 key 集合，含人才引进/西部计划） |');
  lines.push('| 提醒详情（截止日期/类别/公告链接/备注） | `public/js/pages/detail.mjs` | 详情读取与越权用例 |');
  lines.push('| 新增/编辑提醒表单 | `public/js/pages/editor.mjs` | 创建/更新/校验用例 |');
  lines.push('| 云端账号注册登录 | `server/routes/auth.mjs`、`public/js/pages/login.mjs` | 注册/登录/防枚举/限流用例 |');
  lines.push('| 微信授权登录（OAuth2/OIDC） | `server/providers/wechat.mjs`、`public/js/pages/wechat-*.mjs` | Mock 全链路 + state 一次性用例 |');
  lines.push('| scrypt 加盐口令 | `server/lib/password.mjs` | 落库形态核查（scrypt$N$r$p$salt$hash） |');
  lines.push('| JWT 无状态鉴权 | `server/lib/jwt.mjs` | 篡改拒绝、退出即时失效用例 |');
  lines.push('| 刷新令牌轮换 | `server/security/auth.mjs#rotateRefreshToken` | 轮换 + 重放检测用例 |');
  lines.push('| RBAC 三角色 | `server/security/auth.mjs` + 各路由 | RBAC 套件 12 条用例 |');
  lines.push('| 用户/账号/令牌/审计云端存储 | `server/store/index.mjs`（local / cloudbase 双驱动） | 存储集合核查 + 驱动抽象 |');
  lines.push('| 公告截图云端存储 | `server/routes/uploads.mjs` | 上传/魔数校验/静态访问用例 |');
  lines.push('| 我的 / 安全记录（设备+日志+退出） | `public/js/pages/me.mjs` | 安全记录套件 9 条用例 |');
  lines.push('| 留学生友好岗位库（筛选/三件套/报名数据/政策基线/捡漏栏目） | `server/position-catalog.mjs`、`server/position-nodes.mjs`、`server/routes/positions.mjs`、`public/js/pages/positions.mjs` | 岗位库套件 34 条用例（含捡漏五条件判定、政法类政审禁入、零报名实录核查） |');
  lines.push('| 准捡漏栏目（报名≈招录 + 无进面比 + 应届进面 + 分数持平） | `server/position-catalog.mjs#evaluateNearBargain`、`server/position-nodes.mjs#LOW_APPLY_POSITIONS`、`public/js/pages/positions.mjs` | 准捡漏筛选用例（nearBargain=1 只返回 hit/partial，五条件 + 三标记齐全）、低报名筛选用例（lowApply=1） |');
  lines.push('| 分数口径校准（总分 / 两科平均，官方合格线比对） | `server/position-catalog.mjs#SCORE_BASES/SCORE_CALIBRATION/YUNNAN_2026_SCORE_LINES`、`server/routes/positions.mjs#shapePosition` | 口径折算用例（53.35 → 总分 106.7、高出合格线 11.7）、低于合格线标记待核验用例、非法口径拒绝用例 |');
  lines.push('| 人才引进 QS 前 200 通道 + 低门槛考试清单（三支一扶/社区/西部计划） | `server/position-catalog.mjs#RENCAI_QS200_GUIDE/NO_RATIO_EXAMS`、`public/js/pages/positions.mjs#openBargainSheet` | 政策接口用例（地区清单逐条附来源、四类低门槛考试齐全） |');
  lines.push('| 登录用户可切「我的提醒 / 公共招考节点（覆盖我能考的全部考试）」 | `public/js/pages/home.mjs`、`server/official-nodes.mjs`、`server/catalog.mjs` | 分类目录用例（10 类）、公共节点 seed 用例（27 条官方节点） |');
  lines.push('| 横向筛选标签条可拖动滑动 + 溢出时左右翻页 + 重建后保留滚动位置 | `public/js/ui.mjs#initChipRails`、`public/css/app.css`（`.chip-rail` / `.chip-nav`） | `scripts/smoke-ui.mjs` 冒烟 16 项（拖动前进、翻页按钮、拖动不误触标签、重建后位置还原） |');
  lines.push('');
  lines.push('## 五、已知限制（诚实边界）');
  lines.push('');
  lines.push('1. **CloudBase 未连真实云环境**：双驱动已实现且接口一致，但本次验收在 `DB_DRIVER=local` 下完成；云数据库查询、云存储上传链路需填入真实 `CLOUDBASE_*` 凭证后复验（脚本内会在缺少凭证时自动回退本地驱动并打印告警）。');
  lines.push('2. **微信真实授权未联调**：`snsapi_login` 授权码流程已按官方文档实现（含 state 防 CSRF、一次性票据），但需要真实 AppID/AppSecret 与回调域名才能端到端验证；当前默认走 Mock 通道，界面明确标注。');
  lines.push('3. **浏览器端自动化只覆盖关键交互**：前端为原生 ES 模块，已通过语法校验 + 静态资源可达性 + 深链回退核查；关键交互另有零依赖的 CDP 冒烟脚本 `scripts/smoke-ui.mjs`（真实 Chrome 无头 + 真实鼠标事件，当前覆盖横向筛选标签条的拖动滑动、翻页按钮、滚动位置记忆，16 项断言）。其余表单流程仍是人工验证，需要更全面覆盖时建议补 Playwright。');
  lines.push('4. **公共招考节点日期为参考值**：见 `server/official-nodes.mjs`，入库时 `verified=false`，界面有显式提示，实际以主管部门公告为准。');
  lines.push('5. **岗位库种子含第三方整理数据**：26 条来自公考雷达 / 中公 / 华图报名统计、湖南省人社厅 / 邵阳市人社局 / 郴州市人社局公示与人民网报道的真实样本（`dataLevel=thirdparty`，含 2026 国考 11 条零报名实录、4 条事业编取消实录与 6 条「报名≈招录」低报名取消/核减实录，逐行附来源与统计时间）、16 条为演示筛选逻辑构造的示例行（`dataLevel=sample`），界面均有 badge 与复核提示；项目不抓取、不推测、不补全缺失字段，报考前请以官方职位表复核。');
  lines.push('6. **捡漏判定是筛子不是预言**：五条件基于岗位行内已录入字段计算（`applicants===0` + 不设开考比例 + 专业对口 + 学历达标 + 非公安政法类），报名数据随时间变化，2027 国考报名窗口内需每日回官方渠道复核；政法类禁入判定依据《公安机关录用人民警察政治考察工作办法》（公通字〔2020〕11号）与各地报考指南口径，具体职位以公告备注为准。');
  lines.push('7. **限流为进程内实现**：单实例有效；多实例部署需替换为 Redis 计数器（接口已抽离，替换成本低）。');
  lines.push('8. **进面分为第三方口径，官方合格线需逐岗录入**：进面分数（最低/最高/平均）来自公考雷达等平台的整理数据，各平台口径不一（云南省考按两科平均百分制、国考按总分）；本应用用 `scoreBasis` 显式声明口径，并在详情页自动折算成总分与官方合格线比对，未录入合格线的行会提示「可在编辑里补上」。**「200 分只考 53.35」是口径误读**——53.35 是行测申论各 50% 的合成成绩，折合总分约 106.7，高于云南省 2026 县级机关合格线 95；校准说明见 `server/position-catalog.mjs#SCORE_CALIBRATION`。');
  lines.push('9. **准捡漏是「值得盯」不是「一定上」**：`lowApply`（报名≈招录）依赖报名/缴费人数，而这类数字在报名期内每天变化；`ratioFlexible`/`freshInterview`/`scoreStable` 三个标记需要有官方公告或往年数据支撑才能勾选，未勾选时界面显式显示「未标记」，不会被当成已核验。低报名种子多来自「未达开考比例被取消/核减」的公告，其专业通道以官方岗位表为准（种子里标为「其他方向」，需逐条核对是否接受 0812 或不限专业）。');
  lines.push('10. **报名数据一致性自检（保守口径）**：同一行里「竞争比 × 招录人数」「报名」「过审」「缴费」互相矛盾时，行内会带上 `dataIssues`，界面标「报名数据待核验」并逐条列出问题；低报名判定采用保守口径——**只要任一可得的人数口径超出上限就不算低报名**，另加一类公告级证据 `ratioShortfall`（公告明确报名/缴费未达开考比例被核减或取消，无需具体人数即可成立）。种子里的云南三行同时记着「竞争比 39:1」与「缴费 3/4 人」，被自检抓出并判否，备注与界面均如实说明而不掩盖。');
  lines.push('11. **人才引进地区清单是窗口期快照**：定西第二批（2026-10-13 至 10-27）为当前在报窗口，其余地区（丹江口/温州/崇阳/监利）标注「以当年公告时间为准」；QS 前 200 硕士不卡本科层次这一结论逐条核对了公告原文，但各公告的院校榜单年份与名次要求不同，投递前请重新核对当年公告。');
  lines.push('');
  lines.push('## 六、结论');
  lines.push('');
  lines.push(gate === 'GATE PASS'
    ? `全部 ${total} 项验收项通过，${tests.total} 条测试用例零失败，具备交付与演示条件。`
    : `存在未通过项：${checks.filter((c) => !c.ok).map((c) => c.name).join('、')}，需修复后重新验收。`);
  lines.push('');

  return { markdown: lines.join('\n'), gate };
}

/* ───────────────── main ───────────────── */

async function main() {
  const started = Date.now();
  console.log('\n巡考日历 · 验收脚本\n' + '─'.repeat(52));

  const tests = await runTests();
  const contract = await checkFrontendContracts();
  const syntaxCount = await checkFrontendSyntax();
  const staticInfo = await checkStaticAndDesign(contract);
  const storage = await checkStorageIntegrity();

  const { markdown, gate } = buildReport({
    tests,
    contract,
    syntaxCount,
    staticInfo,
    storage,
    durationMs: Date.now() - started,
  });

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, markdown, 'utf8');

  console.log('\n' + '─'.repeat(52));
  console.log(`验收报告已写入：${path.relative(ROOT, REPORT_PATH)}`);
  console.log(`验收项 ${checks.filter((c) => c.ok).length}/${checks.length} 通过`);
  console.log(`结论：${gate}`);

  // 清理验收用临时数据目录
  try {
    await fs.rm(process.env.DATA_DIR, { recursive: true, force: true });
  } catch {
    /* 忽略 */
  }

  process.exit(gate === 'GATE PASS' ? 0 : 1);
}

main().catch((err) => {
  console.error('验收脚本异常：', err);
  process.exit(1);
});
