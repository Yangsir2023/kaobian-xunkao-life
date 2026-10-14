#!/usr/bin/env node
/**
 * 界面冒烟脚本（零依赖）：用 Chrome 无头模式 + CDP 驱动真实鼠标事件，
 * 校验关键交互是否真的生效 —— 补上"只有语法校验、没有浏览器验证"的短板。
 *
 * 用法：
 *   1) 先启动服务：PORT=8790 node server/index.mjs
 *   2) node scripts/smoke-ui.mjs http://127.0.0.1:8790
 *
 * 为什么不用 Playwright：本项目验收要求零外部依赖；CDP 直连更可控。
 * 当前覆盖：横向筛选标签条（.chip-scroll / .chip-rail）的拖动滑动与左右翻页。
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:8790';
const PORT = Number(process.argv[3] || 9345);
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  for (const p of CHROME_CANDIDATES) if (existsSync(p)) return p;
  throw new Error('未找到 Chrome / Edge，请先安装或改用 Playwright');
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
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
      expression, awaitPromise: true, returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(`页面内求值异常：${r.exceptionDetails.text}`);
    return r.result?.value;
  }

  mouse(type, x, y, extra = {}) {
    return this.send('Input.dispatchMouseEvent', {
      type, x, y, button: 'left', clickCount: 1, ...extra,
    });
  }

  /** 真实拖拽：按下 → 分步移动 → 松开 */
  async drag(from, dx, steps = 6) {
    await this.mouse('mousePressed', from.x, from.y, { buttons: 1 });
    for (let i = 1; i <= steps; i += 1) {
      await this.mouse('mouseMoved', from.x + (dx * i) / steps, from.y, { buttons: 1 });
      await sleep(16);
    }
    await this.mouse('mouseReleased', from.x + dx, from.y, { buttons: 0 });
    await sleep(200);
  }

  async click(x, y) {
    await this.mouse('mousePressed', x, y, { buttons: 1 });
    await sleep(40);
    await this.mouse('mouseReleased', x, y, { buttons: 0 });
  }
}

async function connect() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
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

/* ───────────────────────── 用例 ───────────────────────── */

const RAIL_STATE = `Array.from(document.querySelectorAll('.chip-rail')).map((rail) => {
  const sc = rail.querySelector('.chip-scroll');
  const shown = (n) => getComputedStyle(n).display !== 'none';
  return {
    chips: sc.querySelectorAll('.chip').length,
    scrollLeft: Math.round(sc.scrollLeft),
    scrollWidth: sc.scrollWidth,
    clientWidth: sc.clientWidth,
    overflow: sc.scrollWidth - sc.clientWidth > 1,
    hasPrev: rail.classList.contains('has-prev'),
    hasNext: rail.classList.contains('has-next'),
    prevShown: shown(rail.querySelector('.chip-nav.is-prev')),
    nextShown: shown(rail.querySelector('.chip-nav.is-next')),
    cursor: getComputedStyle(sc).cursor,
    marginTop: getComputedStyle(rail).marginTop,
  };
})`;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

/** 取第 index 条标签条的水平端点，用于派发鼠标事件 */
const railPoint = (index, side) => `(() => {
  const sc = document.querySelectorAll('.chip-rail .chip-scroll')[${index}];
  const r = sc.getBoundingClientRect();
  const x = ${side === 'right' ? 'r.right - 60' : 'r.left + 60'};
  return { x: Math.round(x), y: Math.round(r.top + r.height / 2) };
})()`;

/** 取第 index 条标签条上某个翻页按钮的中心点（按钮是 absolute 定位，必须按它自己的 rect 取） */
const navPoint = (index, side) => `(() => {
  const rail = document.querySelectorAll('.chip-rail')[${index}];
  const btn = rail.querySelector('.chip-nav.is-${side}');
  const r = btn.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height),
           x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
})()`;

const barTitle = `document.querySelector('.bar-title')?.textContent || ''`;

async function main() {
  const child = spawn(findChrome(), [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=480,960',
    '--no-proxy-server',
    'about:blank',
  ], { stdio: 'ignore' });

  let cdp;
  try {
    cdp = await connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 480, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    await cdp.send('Page.navigate', { url: `${BASE}/#/positions` });
    await sleep(2400);

    console.log('\n[1] 筛选标签条被自动增强');
    const rails = await cdp.eval(RAIL_STATE);
    if (!rails.length) {
      const diag = await cdp.eval(`({ url: location.href, title: ${barTitle},
        chipScrolls: document.querySelectorAll('.chip-scroll').length,
        head: document.body.innerText.slice(0, 160) })`);
      console.log('    诊断：', JSON.stringify(diag));
      check('岗位页存在 .chip-rail', false, '0 条，请看上方诊断');
      throw new Error('标签条未被增强');
    }
    check('岗位页存在多条 .chip-rail', rails.length >= 2, `${rails.length} 条`);
    check('标签条确实溢出（右侧内容原本看不到）',
      rails.every((r) => r.overflow),
      rails.map((r) => `${r.scrollWidth}>${r.clientWidth}`).join(' / '));
    check('起点处右侧翻页按钮浮出，左侧隐藏',
      rails.every((r) => r.nextShown && !r.prevShown));
    check('鼠标样式为可拖拽 grab', rails.every((r) => r.cursor === 'grab'));
    check('外边距工具类被搬到外层容器（间距未丢）', rails[0].marginTop === '10px', rails[0].marginTop);

    console.log('\n[2] 按住鼠标左右拖动');
    const start = await cdp.eval(railPoint(0, 'right'));
    const beforeDrag = (await cdp.eval(RAIL_STATE))[0].scrollLeft;
    await cdp.drag(start, -180);
    const afterDrag = (await cdp.eval(RAIL_STATE))[0];
    check('拖动后横向滚动前进', afterDrag.scrollLeft > beforeDrag,
      `${beforeDrag} → ${afterDrag.scrollLeft}`);
    check('拖动后左侧翻页按钮浮出', afterDrag.prevShown);
    check('拖动未误触标签（松手后的 click 被吞掉）',
      (await cdp.eval(`document.querySelector('[data-bargain]')?.classList.contains('is-active')`)) === false);

    console.log('\n[3] 点击右侧翻页按钮');
    const nav = await cdp.eval(navPoint(0, 'next'));
    check('右侧翻页按钮有实际尺寸（未被容器裁掉）', nav.w > 20 && nav.h > 20, `${nav.w}×${nav.h}`);
    const beforeNav = (await cdp.eval(RAIL_STATE))[0].scrollLeft;
    await cdp.click(nav.x, nav.y);
    await sleep(650);
    const afterNav = (await cdp.eval(RAIL_STATE))[0].scrollLeft;
    check('翻页按钮使横向滚动前进', afterNav > beforeNav, `${beforeNav} → ${afterNav}`);

    console.log('\n[4] 省份行同样生效');
    const start2 = await cdp.eval(railPoint(1, 'right'));
    const p0 = (await cdp.eval(RAIL_STATE))[1].scrollLeft;
    await cdp.drag(start2, -180);
    const p1 = (await cdp.eval(RAIL_STATE))[1].scrollLeft;
    check('省份行拖动后横向滚动前进', p1 > p0, `${p0} → ${p1}`);
    check('省份拖动未误选省份',
      (await cdp.eval(`document.querySelectorAll('[data-province].is-active').length`)) === 0);

    console.log('\n[5] 选中标签后滚动位置不被重置');
    // 页面点标签会 innerHTML 重建整块（positions.mjs#rerender），
    // 若不记忆位置，用户"滑到内蒙古点一下"就会被弹回最左边。
    const box = await cdp.eval(`(() => {
      const sc = document.querySelectorAll('.chip-rail .chip-scroll')[0];
      const r = sc.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    await cdp.drag(await cdp.eval(railPoint(0, 'right')), -180);
    const kept = (await cdp.eval(RAIL_STATE))[0].scrollLeft;
    check('拖动后已有非零滚动位置', kept > 0, String(kept));
    await cdp.click(box.x, box.y); // 点中间某个标签，触发一次整块重建
    await sleep(900);
    const afterRender = (await cdp.eval(RAIL_STATE))[0].scrollLeft;
    check('重建后滚动位置被还原', afterRender === kept, `${kept} → ${afterRender}`);

    console.log('\n[6] 最佳推荐区域：入口横幅 + 弹层内容');
    await cdp.send('Page.navigate', { url: `${BASE}/#/positions` });
    await sleep(1900);
    const banner = await cdp.eval(`(() => {
      const b = document.querySelector('[data-best]');
      if (!b) return { found: false };
      const r = b.getBoundingClientRect();
      return {
        found: true,
        tag: b.tagName,
        title: b.querySelector('.best-banner-title')?.textContent || '',
        lines: b.querySelectorAll('.best-banner-line').length,
        w: Math.round(r.width), h: Math.round(r.height),
        x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
        chip: !!document.querySelector('.chip-best'),
        barAction: !!document.querySelector('[data-bar-action="best"]'),
      };
    })()`);
    check('岗位页存在最佳推荐入口横幅', banner.found, banner.found ? `${banner.w}×${banner.h}` : '未找到');
    check('横幅有标题与两行摘要', banner.found && banner.title.includes('最佳推荐') && banner.lines === 2);
    check('标签条里有「最佳推荐」标签', banner.chip === true);
    check('顶栏有最佳推荐图标按钮', banner.barAction === true);
    await cdp.click(banner.x, banner.y);
    await sleep(800);
    const sheet = await cdp.eval(`(() => {
      const t = document.body.innerText;
      return {
        open: !!document.querySelector('.sheet-panel'),
        title: document.querySelector('.sheet-title')?.textContent || '',
        blocks: ['今年国考', '省考', '其他考试'].filter((k) => t.includes(k)).length,
        levels: ['官方公告', '第三方整理', '预测推算'].filter((k) => t.includes(k)).length,
        picks: document.querySelectorAll('.best-pick').length,
        ranks: document.querySelectorAll('.best-rank').length,
        seq: document.querySelectorAll('.best-seq li').length,
        sources: document.querySelectorAll('.best-pick .link-out').length,
        window: t.includes('2026-10-15') && t.includes('2026-10-24'),
        factBadges: document.querySelectorAll('.kv-val .badge').length,
      };
    })()`);
    check('点击后弹层打开', sheet.open === true);
    check('弹层标题正确', sheet.title === '最佳推荐区域', sheet.title);
    check('三大板块齐全（国考 / 省考 / 其他考试）', sheet.blocks === 3, `${sheet.blocks}/3`);
    check('三档数据级别图例齐全（官方 / 第三方 / 预测）', sheet.levels === 3, `${sheet.levels}/3`);
    check('推荐条目卡渲染', sheet.picks >= 20, `${sheet.picks} 张`);
    check('排名徽标渲染', sheet.ranks >= 8, `${sheet.ranks} 个`);
    check('行动时间轴渲染', sheet.seq >= 10, `${sheet.seq} 条`);
    check('来源外链渲染', sheet.sources >= 15, `${sheet.sources} 条`);
    check('考情速览逐条带数据级别徽标', sheet.factBadges >= 10, `${sheet.factBadges} 个`);
    check('含国考报名窗口具体日期', sheet.window === true);

    const wide = await cdp.eval(`(() => {
      const body = document.querySelector('.sheet-body');
      const cards = [...document.querySelectorAll('.sheet-body .best-pick, .sheet-body .best-seq li')];
      return {
        overflow: body ? body.scrollWidth - body.clientWidth : -1,
        cardW: cards.length ? Math.round(Math.max(...cards.map((e) => e.getBoundingClientRect().width))) : 0,
        bodyW: body ? Math.round(body.getBoundingClientRect().width) : 0,
      };
    })()`);
    check('480px 下弹层无横向溢出', wide.overflow <= 1, `+${wide.overflow}`);
    check('推荐卡宽度不超出弹层内容区', wide.cardW <= wide.bodyW, `${wide.cardW} <= ${wide.bodyW}`);

    const closeOk = await cdp.eval(`(() => {
      const b = document.querySelector('.sheet-backdrop');
      return !!b;
    })()`);
    check('弹层容器可关闭（backdrop 存在）', closeOk === true);
    await cdp.eval(`document.querySelector('.sheet-backdrop')?.click()`);
    await sleep(400);

    console.log('\n[7] 窄屏 360px 下弹层仍然不横向溢出');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 360, height: 780, deviceScaleFactor: 1, mobile: false,
    });
    await cdp.send('Page.navigate', { url: `${BASE}/#/positions` });
    await sleep(1900);
    await cdp.eval(`document.querySelector('[data-best]')?.click()`);
    await sleep(900);
    const narrow = await cdp.eval(`(() => {
      const body = document.querySelector('.sheet-body');
      const panel = document.querySelector('.sheet-panel');
      const cards = [...document.querySelectorAll('.sheet-body .best-pick, .sheet-body .best-seq li')];
      return {
        open: !!panel,
        overflow: body ? body.scrollWidth - body.clientWidth : -1,
        panelOverflow: panel ? panel.scrollWidth - panel.clientWidth : -1,
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
        cardW: cards.length ? Math.round(Math.max(...cards.map((e) => e.getBoundingClientRect().width))) : 0,
        bodyW: body ? Math.round(body.getBoundingClientRect().width) : 0,
      };
    })()`);
    check('360px 下弹层仍能打开', narrow.open === true);
    check('360px 下无横向溢出（弹层 / 面板 / 整页）',
      narrow.overflow <= 1 && narrow.panelOverflow <= 1 && narrow.docOverflow <= 1,
      `body+${narrow.overflow} panel+${narrow.panelOverflow} doc+${narrow.docOverflow}`);
    check('360px 下推荐卡不超出内容区', narrow.cardW <= narrow.bodyW, `${narrow.cardW} <= ${narrow.bodyW}`);
    await cdp.eval(`document.querySelector('.sheet-backdrop')?.click()`);
    await sleep(300);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 480, height: 900, deviceScaleFactor: 1, mobile: false,
    });

    console.log('\n[8] 首页 / 分类页的标签条也自动增强');
    for (const hash of ['/', '/categories']) {
      await cdp.send('Page.navigate', { url: `${BASE}/#${hash}` });
      await sleep(1800);
      const r = await cdp.eval(RAIL_STATE);
      check(`${hash} 已增强（${r.length} 条，溢出 ${r.filter((x) => x.overflow).length} 条）`, r.length >= 1);
    }
  } finally {
    try {
      await cdp?.send('Page.close');
    } catch {
      /* ignore */
    }
    child.kill();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n界面冒烟：${results.length - failed.length}/${results.length} 通过`);
  if (failed.length) {
    console.log('失败项：' + failed.map((f) => f.name).join(' | '));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('冒烟脚本出错：', err.message || err);
  process.exitCode = 1;
});
