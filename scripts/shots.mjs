#!/usr/bin/env node
/**
 * CDP 截图脚本（零依赖）：用 Chrome 无头模式 + 全局 WebSocket 抓界面截图。
 *
 * 用法：
 *   1) 先启动服务：PORT=8790 node server/index.mjs
 *   2) node scripts/shots.mjs http://127.0.0.1:8790 docs/screenshots
 *
 * 为什么不用 agent-browser：本项目验收要求零外部依赖，且 agent-browser 在
 * 本机不稳定；CDP 直连更可控。
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:8790';
const OUT = process.argv[3] || 'docs/screenshots';
const PORT = 9333;
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

function findChrome() {
  for (const p of CHROME_CANDIDATES) if (existsSync(p)) return p;
  throw new Error('未找到 Chrome / Edge');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return res.json();
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP 超时：${method}`));
        }
      }, 20000);
    });
  }

  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return r.result?.value;
  }
}

async function connect() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const list = await fetchJson('/json/list');
      const page = list.find((t) => t.type === 'page');
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          ws.addEventListener('open', resolve, { once: true });
          ws.addEventListener('error', reject, { once: true });
        });
        return new Cdp(ws);
      }
    } catch {
      /* retry */
    }
    await sleep(250);
  }
  throw new Error('无法连接 CDP');
}

async function shot(cdp, name, opts = {}) {
  const { clip, beyond = true } = opts;
  const params = { format: 'png', captureBeyondViewport: clip ? false : beyond };
  if (clip) params.clip = clip;
  const { data } = await cdp.send('Page.captureScreenshot', params);
  const file = join(OUT, `${name}.png`);
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`  ✓ ${file}`);
}

/** 只截首屏（480×560），用于校验统计条与筛选 chips 的数字 */
const viewportClip = { x: 0, y: 0, width: 480, height: 560, scale: 1 };
/** 弹层截图：position:fixed 的弹层必须关掉 captureBeyondViewport，否则会截成背后整页 */
const sheetShot = (cdp, name) => shot(cdp, name, { beyond: false });

async function main() {
  mkdirSync(OUT, { recursive: true });
  const chrome = findChrome();
  const child = spawn(
    chrome,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      '--remote-allow-origins=*',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--window-size=480,960',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let cdp;
  try {
    cdp = await connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 480,
      height: 960,
      deviceScaleFactor: 2,
      mobile: true,
    });

    const goto = async (hash) => {
      await cdp.send('Page.navigate', { url: `${BASE}/#${hash}` });
      await sleep(1600);
    };
    /** 整页长图用 1x 采样，避免 42 张卡片压出 3MB 的 PNG */
    const setScale = (s) =>
      cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 480,
        height: 960,
        deviceScaleFactor: s,
        mobile: true,
      });
    const shotLong = async (name) => {
      await setScale(1);
      await shot(cdp, name);
      await setScale(2);
    };
    const click = async (selector) => {
      await cdp.eval(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) el.click(); return Boolean(el); })()`
      );
      await sleep(1100);
    };
    /** 关闭当前弹层：点遮罩自身（openSheet 的遮罩点击即关闭） */
    const closeSheet = async () => {
      await cdp.eval(
        `(() => { const b = document.querySelector('.sheet-backdrop'); if (b) b.click(); return Boolean(b); })()`
      );
      await sleep(700);
    };
    /** 把弹层里可滚动的容器滚到指定比例 */
    const scrollSheet = async (ratio) => {
      const v = await cdp.eval(
        `(() => {
          const cands = [document.querySelector('.sheet-panel'), document.querySelector('.sheet-body')]
            .filter(Boolean)
            .filter((e) => e.scrollHeight > e.clientHeight + 4);
          if (!cands.length) return 'no-scroller';
          const el = cands[0];
          el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * ${ratio});
          return el.className + ':' + el.scrollTop + '/' + (el.scrollHeight - el.clientHeight);
        })()`
      );
      await sleep(500);
      return v;
    };

    console.log(`\n截图输出到 ${OUT}\n`);

    // 0. 首屏：统计条 8 格 + 筛选 chips（全量）
    await goto('/positions');
    await shot(cdp, '17-positions-stats-top', { clip: viewportClip });

    // 1. 岗位库全量列表（整页）
    await shotLong('17-positions-stats');

    // 2. 准捡漏专区
    await click('[data-near]');
    await shot(cdp, '17-near-bargain-list-top', { clip: viewportClip });
    await shotLong('17-near-bargain-list');

    // 3. 低报名专区（先关掉准捡漏，两者是可叠加的独立筛选）
    await click('[data-near]');
    await click('[data-lowapply]');
    await shot(cdp, '18-low-apply-list-top', { clip: viewportClip });
    await shotLong('18-low-apply-list');

    await click('[data-lowapply]');

    // 4. 准入一条准捡漏岗位详情：卡片里带「准捡漏」徽标的
    const clicked = await cdp.eval(
      `(() => {
        const badge = [...document.querySelectorAll('.nearbargain-badge')][0];
        const card = badge && badge.closest('.pos-card');
        if (card) { card.click(); return card.dataset.id; }
        return null;
      })()`
    );
    console.log(`  详情卡片 id=${clicked}`);
    await sleep(2000);
    await sheetShot(cdp, '18-score-caliber');
    await scrollSheet(0.45);
    await sheetShot(cdp, '18-score-caliber-detail');
    await closeSheet();

    // 4b. 云南行详情：53.35（平均分口径）→ 折合总分 106.7 与官方合格线 95 的比对 + 报名数据待核验
    await goto('/positions?'); 
    await cdp.eval(
      `(() => {
        const card = [...document.querySelectorAll('.pos-card')]
          .find((c) => c.querySelector('.pos-title').textContent.includes('行政执法 01'));
        if (card) card.click();
        return Boolean(card);
      })()`
    );
    await sleep(2000);
    await sheetShot(cdp, '18-caliber-yunnan-top');
    await scrollSheet(0.5);
    await sheetShot(cdp, '18-caliber-yunnan-mid');
    await closeSheet();

    // 5. 捡漏攻略：人才引进 + 低门槛考试 + 分数校准
    await goto('/positions');
    await click('[data-guide]');
    await sleep(1200);
    await scrollSheet(0.55);
    await sheetShot(cdp, '19-rencai-qs200');
    await scrollSheet(1);
    await sheetShot(cdp, '20-no-ratio-exams');

    // 6. 政策依据：云南省考合格线
    await closeSheet();
    await goto('/positions');
    await click('[data-policy]');
    await sleep(1500);
    await scrollSheet(0.3);
    await sheetShot(cdp, '21-policy-yunnan-lines');

    // 7. 提醒首页（公共招考节点）与分类页：十条战线都在提醒里
    await closeSheet();
    await goto('/');
    await shotLong('22-reminders-home');
    await goto('/categories');
    await shotLong('23-categories-ten');

    // 8. 最佳推荐区域：入口横幅 + 弹层三段（国考 / 省考 / 其他考试）
    await goto('/positions');
    await shot(cdp, '26-best-banner', { clip: viewportClip });
    await click('[data-best]');
    await sleep(1200);
    await sheetShot(cdp, '27-best-recommend-guokao');
    await scrollSheet(0.42);
    await sheetShot(cdp, '28-best-recommend-shengkao');
    await scrollSheet(1);
    await sheetShot(cdp, '29-best-recommend-others');
  } finally {
    try {
      if (cdp) await cdp.send('Browser.close');
    } catch {
      /* ignore */
    }
    child.kill();
  }
}

main().catch((err) => {
  console.error('截图失败：', err.message);
  process.exit(1);
});
