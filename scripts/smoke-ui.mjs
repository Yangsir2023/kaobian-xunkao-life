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

/**
 * 组装一个"没有代理"的子进程环境。
 * 本机（以及 CI/沙箱）常注入 HTTP_PROXY / HTTPS_PROXY 指向 127.0.0.1 的转发代理，
 * 无头 Chrome 会把访问本机 127.0.0.1:<port> 的请求也送进代理，从而 ERR_CONNECTION_REFUSED。
 * 因此剥掉代理类环境变量，并显式声明 NO_PROXY 覆盖回环地址。
 */
function cleanEnv() {
  const env = { ...process.env };
  for (const k of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
    delete env[k];
  }
  env.NO_PROXY = '127.0.0.1,localhost,::1';
  env.no_proxy = env.NO_PROXY;
  return env;
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
    '--proxy-server=direct://',
    '--proxy-bypass-list=*',
    'about:blank',
  ], { stdio: 'ignore', env: cleanEnv() });

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

    console.log('\n[7b] 历年公告：入口横幅 + 归档弹层');
    await cdp.send('Page.navigate', { url: `${BASE}/#/positions?u=${Date.now()}` });
    await sleep(1900);
    const arcBanner = await cdp.eval(`(() => {
      const b = document.querySelector('[data-archive]');
      if (!b) return { found: false };
      const r = b.getBoundingClientRect();
      return {
        found: true,
        tag: b.tagName,
        title: b.querySelector('.best-banner-title')?.textContent || '',
        lines: b.querySelectorAll('.best-banner-line').length,
        w: Math.round(r.width), h: Math.round(r.height),
        x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
        barAction: !!document.querySelector('[data-bar-action="archive"]'),
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    check('岗位页存在历年公告入口横幅', arcBanner.found, arcBanner.found ? `${arcBanner.w}×${arcBanner.h}` : '未找到');
    check('横幅标题写明归档份数与年份区间', arcBanner.found && /历年公告 · \d+ 份往年原文（\d{4}–\d{4}）/.test(arcBanner.title), arcBanner.title);
    check('横幅有标题与两行摘要', arcBanner.found && arcBanner.lines === 2);
    check('顶栏有历年公告图标按钮', arcBanner.barAction === true);
    check('480px 下横幅不撑破页面', arcBanner.found && arcBanner.docOverflow <= 1, `+${arcBanner.docOverflow}`);

    await cdp.click(arcBanner.x, arcBanner.y);
    await sleep(900);
    const arcSheet = await cdp.eval(`(() => {
      const t = document.querySelector('.sheet-body')?.innerText || '';
      return {
        open: !!document.querySelector('.sheet-panel'),
        title: document.querySelector('.sheet-title')?.textContent || '',
        groups: document.querySelectorAll('.sheet-body .filter-group').length,
        items: document.querySelectorAll('.sheet-body .ann-item').length,
        years: document.querySelectorAll('.sheet-body .ann-year').length,
        timeline: document.querySelectorAll('.sheet-body .ann-item .kv').length,
        sources: document.querySelectorAll('.sheet-body .ann-item .link-out').length,
        badges: document.querySelectorAll('.sheet-body .ann-item .badge').length,
        levels: ['官方公告', '第三方整理', '预测推算'].filter((k) => t.includes(k)).length,
        caveats: /收录范围有限/.test(t),
        has2025: t.includes('2025'),
        bodyOverflow: (() => { const b = document.querySelector('.sheet-body'); return b ? b.scrollWidth - b.clientWidth : -1; })(),
      };
    })()`);
    check('点击后归档弹层打开', arcSheet.open === true);
    check('弹层标题正确', arcSheet.title === '历年公告', arcSheet.title);
    check('按考试类型分组渲染', arcSheet.groups >= 5, `${arcSheet.groups} 组`);
    check('公告卡渲染', arcSheet.items >= 10, `${arcSheet.items} 份`);
    check('每份公告带年份徽标', arcSheet.years >= 10, `${arcSheet.years} 个`);
    check('时间节点渲染', arcSheet.timeline >= 40, `${arcSheet.timeline} 行`);
    check('来源外链渲染', arcSheet.sources >= 10, `${arcSheet.sources} 条`);
    check('数据级别徽标渲染', arcSheet.badges >= 10, `${arcSheet.badges} 个`);
    check('三档级别图例齐全', arcSheet.levels === 3, `${arcSheet.levels}/3`);
    check('收录范围声明在（不承诺穷举）', arcSheet.caveats === true);
    check('归档含往年度（2025 及以前）', arcSheet.has2025 === true);
    check('480px 下归档弹层无横向溢出', arcSheet.bodyOverflow <= 1, `+${arcSheet.bodyOverflow}`);
    await cdp.eval(`document.querySelector('.sheet-backdrop')?.click()`);
    await sleep(400);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 360, height: 780, deviceScaleFactor: 1, mobile: false,
    });
    await cdp.send('Page.navigate', { url: `${BASE}/#/positions?u=${Date.now()}` });
    await sleep(1900);
    const arcNarrow = await cdp.eval(`(() => {
      document.querySelector('[data-archive]')?.click();
      return { clicked: true };
    })()`);
    await sleep(900);
    const arcNarrowState = await cdp.eval(`(() => {
      const body = document.querySelector('.sheet-body');
      const panel = document.querySelector('.sheet-panel');
      return {
        open: !!panel,
        overflow: body ? body.scrollWidth - body.clientWidth : -1,
        panelOverflow: panel ? panel.scrollWidth - panel.clientWidth : -1,
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    check('360px 下归档弹层仍能打开', arcNarrowState.open === true && arcNarrow.clicked === true);
    check('360px 下归档弹层无横向溢出（弹层 / 面板 / 整页）',
      arcNarrowState.overflow <= 1 && arcNarrowState.panelOverflow <= 1 && arcNarrowState.docOverflow <= 1,
      `body+${arcNarrowState.overflow} panel+${arcNarrowState.panelOverflow} doc+${arcNarrowState.docOverflow}`);
    await cdp.eval(`document.querySelector('.sheet-backdrop')?.click()`);
    await sleep(300);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 480, height: 900, deviceScaleFactor: 1, mobile: false,
    });

    console.log('\n[7c] 外地可考 · 户籍口径弹层');
    await cdp.send('Page.navigate', { url: `${BASE}/#/positions?u=${Date.now()}` });
    await sleep(1900);
    const hukouChip = await cdp.eval(`(() => {
      const c = document.querySelector('[data-hukou]');
      if (!c) return { found: false };
      // 标签条是横向滚动容器：先把目标标签滑到视野内，否则鼠标点的是容器外的位置
      c.scrollIntoView({ block: 'nearest', inline: 'center' });
      const r = c.getBoundingClientRect();
      return {
        found: true,
        label: c.textContent.trim(),
        x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    check('岗位页有「外地可考」标签', hukouChip.found === true, hukouChip.label);
    check('标签页不撑破 480px 页面', hukouChip.found && hukouChip.docOverflow <= 1, `+${hukouChip.docOverflow}`);

    await cdp.click(hukouChip.x, hukouChip.y);
    await sleep(900);
    const hukouSheet = await cdp.eval(`(() => {
      const t = document.querySelector('.sheet-body')?.innerText || '';
      return {
        open: !!document.querySelector('.sheet-panel'),
        title: document.querySelector('.sheet-title')?.textContent || '',
        groups: document.querySelectorAll('.sheet-body .filter-group').length,
        cards: document.querySelectorAll('.sheet-body .best-pick').length,
        badges: document.querySelectorAll('.sheet-body .best-pick .badge').length,
        quotes: document.querySelectorAll('.sheet-body .best-pick .note-box').length,
        sources: document.querySelectorAll('.sheet-body .best-pick .link-out').length,
        levels: ['不限户籍', '应届不限', '限本地', '逐公告看'].filter((k) => t.includes(k)).length,
        noHukouCaveat: /没出现在这份清单里/.test(t),
        hasHenan: /乡村振兴村级协理员/.test(t),
        hasXibu: /西部计划/.test(t),
        hasCunban: /村级后备干部/.test(t),
        hasShequ: /社区工作者/.test(t),
        overflow: (() => { const b = document.querySelector('.sheet-body'); return b ? b.scrollWidth - b.clientWidth : -1; })(),
      };
    })()`);
    check('点击后户籍口径弹层打开', hukouSheet.open === true);
    check('弹层标题正确', hukouSheet.title === '外地可考 · 户籍口径', hukouSheet.title);
    check('按口径分三组渲染', hukouSheet.groups >= 4, `${hukouSheet.groups} 组`);
    check('考试卡渲染', hukouSheet.cards >= 5, `${hukouSheet.cards} 张`);
    check('每条带口径徽标', hukouSheet.badges >= 5, `${hukouSheet.badges} 个`);
    check('每条带依据原文', hukouSheet.quotes >= 5, `${hukouSheet.quotes} 段`);
    check('来源外链渲染', hukouSheet.sources >= 5, `${hukouSheet.sources} 条`);
    check('四档口径图例齐全', hukouSheet.levels === 4, `${hukouSheet.levels}/4`);
    check('「没出现 ≠ 限户籍」声明在', hukouSheet.noHukouCaveat === true);
    check('含河南村级协理员（不限户籍带编）', hukouSheet.hasHenan === true);
    check('含西部计划', hukouSheet.hasXibu === true);
    check('含村级后备干部（村官类）', hukouSheet.hasCunban === true);
    check('含社区工作者（应届不限）', hukouSheet.hasShequ === true);
    check('480px 下无横向溢出', hukouSheet.overflow <= 1, `+${hukouSheet.overflow}`);
    await cdp.eval(`document.querySelector('.sheet-backdrop')?.click()`);
    await sleep(400);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 360, height: 780, deviceScaleFactor: 1, mobile: false,
    });
    await cdp.send('Page.navigate', { url: `${BASE}/#/positions?u=${Date.now()}` });
    await sleep(1900);
    await cdp.eval(`document.querySelector('[data-hukou]')?.click()`);
    await sleep(900);
    const hukouNarrow = await cdp.eval(`(() => {
      const body = document.querySelector('.sheet-body');
      const panel = document.querySelector('.sheet-panel');
      return {
        open: !!panel,
        overflow: body ? body.scrollWidth - body.clientWidth : -1,
        panelOverflow: panel ? panel.scrollWidth - panel.clientWidth : -1,
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    check('360px 下户籍口径弹层仍能打开', hukouNarrow.open === true);
    check('360px 下无横向溢出（弹层 / 面板 / 整页）',
      hukouNarrow.overflow <= 1 && hukouNarrow.panelOverflow <= 1 && hukouNarrow.docOverflow <= 1,
      `body+${hukouNarrow.overflow} panel+${hukouNarrow.panelOverflow} doc+${hukouNarrow.docOverflow}`);
    await cdp.eval(`document.querySelector('.sheet-backdrop')?.click()`);
    await sleep(300);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 480, height: 900, deviceScaleFactor: 1, mobile: false,
    });

    console.log('\n[7d] 冷门统考弹层');
    await cdp.send('Page.navigate', { url: `${BASE}/#/positions?u=${Date.now()}` });
    await sleep(1900);
    const coldChip = await cdp.eval(`(() => {
      const c = document.querySelector('[data-cold]');
      if (!c) return { found: false };
      c.scrollIntoView({ block: 'nearest', inline: 'center' });
      const r = c.getBoundingClientRect();
      return {
        found: true,
        label: c.textContent.trim(),
        x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
      };
    })()`);
    check('岗位页有「冷门统考」标签', coldChip.found === true, coldChip.label);
    await cdp.click(coldChip.x, coldChip.y);
    await sleep(900);
    const coldSheet = await cdp.eval(`(() => {
      const t = document.querySelector('.sheet-body')?.innerText || '';
      return {
        open: !!document.querySelector('.sheet-panel'),
        title: document.querySelector('.sheet-title')?.textContent || '',
        groups: document.querySelectorAll('.sheet-body .filter-group').length,
        cards: document.querySelectorAll('.sheet-body .best-pick').length,
        quotes: document.querySelectorAll('.sheet-body .best-pick .note-box').length,
        sources: document.querySelectorAll('.sheet-body .best-pick .link-out').length,
        hasZhuanli: /专利审查员/.test(t),
        hasYancao: /烟草/.test(t),
        hasDianwang: /电网/.test(t),
        hasNongxin: /农商行/.test(t),
        hasXiaofang: /消防/.test(t),
        hasPending: /待核实/.test(t),
        overflow: (() => { const b = document.querySelector('.sheet-body'); return b ? b.scrollWidth - b.clientWidth : -1; })(),
      };
    })()`);
    check('点击后冷门统考弹层打开', coldSheet.open === true);
    check('弹层标题正确', coldSheet.title === '冷门统考', coldSheet.title);
    check('按组织方分组渲染', coldSheet.groups >= 5, `${coldSheet.groups} 组`);
    check('考试卡渲染', coldSheet.cards >= 5, `${coldSheet.cards} 张`);
    check('每条带依据原文', coldSheet.quotes >= 5, `${coldSheet.quotes} 段`);
    check('每条带来源外链', coldSheet.sources >= 5, `${coldSheet.sources} 条`);
    check('含专利审查员', coldSheet.hasZhuanli === true);
    check('含烟草系统', coldSheet.hasYancao === true);
    check('含电网系统', coldSheet.hasDianwang === true);
    check('含农商行 / 农信社', coldSheet.hasNongxin === true);
    check('含消防救援招录', coldSheet.hasXiaofang === true);
    check('待核实清单在（不冒充已核实）', coldSheet.hasPending === true);
    check('480px 下无横向溢出', coldSheet.overflow <= 1, `+${coldSheet.overflow}`);
    await cdp.eval(`document.querySelector('.sheet-backdrop')?.click()`);
    await sleep(400);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 360, height: 780, deviceScaleFactor: 1, mobile: false,
    });
    await cdp.send('Page.navigate', { url: `${BASE}/#/positions?u=${Date.now()}` });
    await sleep(1900);
    await cdp.eval(`document.querySelector('[data-cold]')?.click()`);
    await sleep(900);
    const coldNarrow = await cdp.eval(`(() => {
      const body = document.querySelector('.sheet-body');
      const panel = document.querySelector('.sheet-panel');
      return {
        open: !!panel,
        overflow: body ? body.scrollWidth - body.clientWidth : -1,
        panelOverflow: panel ? panel.scrollWidth - panel.clientWidth : -1,
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    check('360px 下冷门统考弹层仍能打开', coldNarrow.open === true);
    check('360px 下无横向溢出（弹层 / 面板 / 整页）',
      coldNarrow.overflow <= 1 && coldNarrow.panelOverflow <= 1 && coldNarrow.docOverflow <= 1,
      `body+${coldNarrow.overflow} panel+${coldNarrow.panelOverflow} doc+${coldNarrow.docOverflow}`);
    await cdp.eval(`document.querySelector('.sheet-backdrop')?.click()`);
    await sleep(300);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 480, height: 900, deviceScaleFactor: 1, mobile: false,
    });

    console.log('\n[7e] 分类详情页（/category/:key）');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 480, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    await cdp.send('Page.navigate', { url: `${BASE}/#/categories?u=${Date.now()}` });
    await sleep(1900);
    const catGrid = await cdp.eval(`(() => ({
      cards: document.querySelectorAll('.cat-card').length,
      docOverflow: document.documentElement.scrollWidth - window.innerWidth,
    }))()`);
    check('分类页渲染十七张类别卡', catGrid.cards === 17, `${catGrid.cards} 张`);
    check('分类页不撑破 480px 页面', catGrid.docOverflow <= 1, `+${catGrid.docOverflow}`);

    const rencaiCard = await cdp.eval(`(() => {
      const c = Array.from(document.querySelectorAll('.cat-card')).find((el) => el.dataset.cat === 'rencai');
      if (!c) return { found: false };
      c.scrollIntoView({ block: 'nearest', inline: 'center' });
      const r = c.getBoundingClientRect();
      return {
        found: true,
        name: c.querySelector('.cat-name')?.textContent || '',
        x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
      };
    })()`);
    check('找到「人才引进」类别卡', rencaiCard.found === true, rencaiCard.name);
    await cdp.click(rencaiCard.x, rencaiCard.y);
    await sleep(1300);
    const detail = await cdp.eval(`(() => {
      const t = document.getElementById('app-main')?.innerText || '';
      return {
        hash: location.hash,
        hero: !!document.querySelector('.cd-hero'),
        heroName: document.querySelector('.cd-hero-name')?.textContent || '',
        summary: !!document.querySelector('.cd-summary'),
        points: document.querySelectorAll('#app-main .cd-point').length,
        sources: document.querySelectorAll('#app-main .link-out').length,
        posBanner: !!document.querySelector('[data-cd-positions]'),
        posText: document.querySelector('[data-cd-positions] .best-banner-title')?.textContent || '',
        back: !!document.querySelector('[data-nav-back]'),
        hasThisYear: t.includes('今年动态'),
        hasForecast: t.includes('明年预测'),
        hasHukou: t.includes('户籍口径'),
        hasQs200: t.includes('QS 前 200'),
        hasDingxi: t.includes('定西'),
        hasUnverified: t.includes('未核实'),
        hasOfficialSite: t.includes('官方入口'),
        hasNotes: t.includes('注意事项'),
        hasExamInfo: t.includes('考什么 · 备什么'),
        hasPrep: t.includes('留服认证') && t.includes('以当年公告原文为准'),
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    check('点击卡片进入详情页（hash 变为 /category/rencai）', detail.hash.startsWith('#/category/rencai'), detail.hash);
    check('详情页顶栏有返回按钮', detail.back === true);
    check('头部渲染类别名', detail.hero && detail.heroName.includes('人才引进'), detail.heroName);
    check('今年状态摘要渲染', detail.summary === true && detail.hasThisYear === true);
    check('今年动态 / 明年预测 / 户籍口径三块齐全',
      detail.hasThisYear && detail.hasForecast && detail.hasHukou);
    check('户籍未核实显式标注（不静默省略）', detail.hasUnverified === true);
    check('QS 前 200 真实公告渲染（含定西）', detail.points >= 5 && detail.hasQs200 && detail.hasDingxi, `${detail.points} 个信息点`);
    check('来源外链渲染', detail.sources >= 6, `${detail.sources} 条`);
    check('岗位深链横幅渲染', detail.posBanner === true && /岗位库 · \d+ 个公共岗位/.test(detail.posText), detail.posText);
    check('官方入口与注意事项渲染', detail.hasOfficialSite && detail.hasNotes);
    check('考什么 · 备什么板块渲染（含留服认证准备项）',
      detail.hasExamInfo === true && detail.hasPrep === true,
      `examInfo=${detail.hasExamInfo} prep=${detail.hasPrep}`);
    check('480px 下详情页无横向溢出', detail.docOverflow <= 1, `+${detail.docOverflow}`);

    await cdp.eval(`document.querySelector('[data-cd-positions]')?.click()`);
    await sleep(1500);
    const deepLink = await cdp.eval(`(() => ({
      hash: location.hash,
      listText: (document.getElementById('pos-list')?.innerText || '').slice(0, 300),
    }))()`);
    check('深链跳到岗位库并带 examType=rencai', deepLink.hash.includes('examType=rencai'), deepLink.hash);
    check('岗位库按人才引进过滤（列表出现该考试类型）', /人才引进/.test(deepLink.listText), deepLink.listText.slice(0, 60));

    // 公考雷达式跳转：每条岗位卡都带「公告 / 来源」或该类考试官方入口
    const posLinks = await cdp.eval(`(() => ({
      cards: document.querySelectorAll('.pos-card').length,
      linkRows: document.querySelectorAll('.pos-card .pos-links').length,
      linkTexts: [...document.querySelectorAll('.pos-card .pos-links a')].slice(0, 4).map((a) => a.textContent.trim()),
      hrefs: [...document.querySelectorAll('.pos-card .pos-links a')].slice(0, 4).map((a) => a.href),
    }))()`);
    check('岗位卡带跳转链接行（公告原文或官方入口）',
      posLinks.cards > 0 && posLinks.linkRows > 0,
      `${posLinks.linkRows}/${posLinks.cards} 张卡 · ${posLinks.linkTexts.join(' | ').slice(0, 60)}`);
    check('跳转链接都是真实 http(s) 地址',
      posLinks.hrefs.length > 0 && posLinks.hrefs.every((h) => h.startsWith('http')));

    // 岗位详情弹层：考什么 · 备什么板块 + 无来源时退到官方入口按钮
    await cdp.eval(`document.querySelector('.pos-card')?.click()`);
    await sleep(1200);
    const posDetail = await cdp.eval(`(() => {
      const sheet = document.querySelector('.sheet-backdrop');
      const t = sheet?.innerText || '';
      return {
        open: !!sheet,
        hasExamInfo: t.includes('考什么'),
        hasPrepList: t.includes('面试') || t.includes('留服认证'),
        hasOfficialBtn: !!sheet?.querySelector('a.btn'),
        officialBtnText: sheet?.querySelector('a.btn')?.textContent.trim() || '',
      };
    })()`);
    check('岗位详情弹层打开', posDetail.open === true);
    check('岗位详情弹层有「这类考试考什么」板块', posDetail.hasExamInfo === true && posDetail.hasPrepList === true);
    check('详情弹层跳转按钮可用（公告原文或官方入口）', posDetail.hasOfficialBtn === true, posDetail.officialBtnText.slice(0, 40));
    await cdp.eval(`document.querySelector('.sheet-backdrop')?.click()`);
    await sleep(500);

    await cdp.send('Page.navigate', { url: `${BASE}/#/category/xiaofang?u=${Date.now()}` });
    await sleep(1400);
    const cold = await cdp.eval(`(() => {
      const t = document.getElementById('app-main')?.innerText || '';
      return {
        hero: document.querySelector('.cd-hero-name')?.textContent || '',
        hasOpen: t.includes('全国可报'),
        has17000: t.includes('17000'),
        hasMale: t.includes('仅招男性'),
        hasExamInfo: t.includes('考什么 · 备什么') && t.includes('体能测试'),
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    check('消防救援详情页渲染', cold.hero.includes('消防救援'), cold.hero);
    check('户籍口径为全国可报', cold.hasOpen === true);
    check('今年动态含招录规模与限制', cold.has17000 && cold.hasMale);
    check('考什么板块含体能测试（消防救援不考行测申论）', cold.hasExamInfo === true);
    check('480px 下无横向溢出', cold.docOverflow <= 1, `+${cold.docOverflow}`);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 360, height: 780, deviceScaleFactor: 1, mobile: false,
    });
    await cdp.send('Page.navigate', { url: `${BASE}/#/category/rencai?u=${Date.now()}` });
    await sleep(1400);
    const detailNarrow = await cdp.eval(`(() => {
      const main = document.getElementById('app-main');
      return {
        hero: !!main?.querySelector('.cd-hero'),
        overflow: main ? main.scrollWidth - main.clientWidth : -1,
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    check('360px 下详情页仍渲染', detailNarrow.hero === true);
    check('360px 下无横向溢出（内容区 / 整页）',
      detailNarrow.overflow <= 1 && detailNarrow.docOverflow <= 1,
      `main+${detailNarrow.overflow} doc+${detailNarrow.docOverflow}`);
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

    // 分类卡片的「考什么」一行概要
    await cdp.send('Page.navigate', { url: `${BASE}/#/categories?u=${Date.now()}` });
    await sleep(1600);
    const catExam = await cdp.eval(`(() => ({
      cards: document.querySelectorAll('.cat-card').length,
      examLines: document.querySelectorAll('.cat-card .cat-exam').length,
      sample: document.querySelector('.cat-card .cat-exam')?.textContent.trim() || '',
    }))()`);
    check('分类卡带考什么一行概要', catExam.cards === 17 && catExam.examLines >= 17, `${catExam.examLines}/${catExam.cards} 张 · 示例「${catExam.sample.slice(0, 30)}」`);

    // 运营商：岗位库已收录但公告未核 —— 详情页显式「待核实」，且仍能跳官方入口与岗位
    await cdp.send('Page.navigate', { url: `${BASE}/#/category/yunyingshang?u=${Date.now()}` });
    await sleep(1400);
    const yunyingshang = await cdp.eval(`(() => {
      const t = document.getElementById('app-main')?.innerText || '';
      return {
        hero: document.querySelector('.cd-hero-name')?.textContent || '',
        hasUnverified: t.includes('未核实') && t.includes('示例'),
        hasExamInfo: t.includes('考什么 · 备什么'),
        hasOfficialSite: t.includes('官方入口'),
        posBanner: !!document.querySelector('[data-cd-positions]'),
        hasThisYear: t.includes('今年动态'),
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    check('运营商详情页渲染', yunyingshang.hero.includes('运营商'), yunyingshang.hero);
    check('运营商公告未核显式标注（不冒充已核实）', yunyingshang.hasUnverified === true && yunyingshang.hasThisYear === false);
    check('运营商仍有考什么与官方入口', yunyingshang.hasExamInfo && yunyingshang.hasOfficialSite);
    check('运营商仍有岗位深链横幅', yunyingshang.posBanner === true);
    check('480px 下运营商详情页无横向溢出', yunyingshang.docOverflow <= 1, `+${yunyingshang.docOverflow}`);

    console.log('\n[7f] 社区工作者详情页 · 全国公告清单');
    await cdp.send('Page.navigate', { url: `${BASE}/#/category/shequ?u=${Date.now()}` });
    await sleep(1400);
    const shequ = await cdp.eval(`(() => {
      const t = document.getElementById('app-main')?.innerText || '';
      return {
        hero: document.querySelector('.cd-hero-name')?.textContent || '',
        hasCj: t.includes('全国公告清单'),
        hasStats: t.includes('清单内合计人数'),
        hasChip: !!document.querySelector('.cj-chip'),
        hasGroup: !!document.querySelector('.cj-group'),
        hasHubei: t.includes('武汉') || t.includes('湖北'),
        hasAbroad: t.includes('留学生') || t.includes('国（境）外'),
        hasCaveat: t.includes('不是全国穷举'),
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    check('社区工作者详情页渲染', shequ.hero.includes('社区工作者'), shequ.hero);
    check('含「全国公告清单」板块', shequ.hasCj === true);
    check('清单含统计数字（人数 / 省份 / 条数）', shequ.hasStats === true);
    check('有省份筛选 chip', shequ.hasChip === true);
    check('有省份折叠分组', shequ.hasGroup === true);
    check('清单含武汉/湖北条目', shequ.hasHubei === true);
    check('有留学生口径高亮', shequ.hasAbroad === true);
    check('有覆盖度声明（不承诺穷举）', shequ.hasCaveat === true);
    check('480px 下社区工作者详情页无横向溢出', shequ.docOverflow <= 1, `+${shequ.docOverflow}`);

    // 点击省份 chip 过滤：默认「全部」选中，切换到「上海」后其他省份隐藏
    await cdp.eval(`(() => {
      const chip = [...document.querySelectorAll('.cj-chip')].find((c) => c.textContent.includes('上海'));
      if (chip) chip.click();
    })()`);
    await sleep(400);
    const cjFilter = await cdp.eval(`(() => ({
      shanghaiVisible: !!document.querySelector('[data-cj-province="shanghai"]:not([hidden])'),
      beijingHidden: document.querySelector('[data-cj-province="beijing"]')?.hidden === true,
    }))()`);
    check('点击上海 chip 后上海分组可见', cjFilter.shanghaiVisible === true);
    check('点击上海 chip 后北京分组隐藏', cjFilter.beijingHidden === true);

    // [7g] 三大新板：乡村振兴协理员（cunban）/ 网格员（shequ）/ 武汉双盲（shiye）
    await cdp.send('Page.navigate', { url: `${BASE}/#/category/cunban?u=${Date.now()}` });
    await sleep(1400);
    const cunban = await cdp.eval(`(() => {
      const t = document.getElementById('app-main')?.innerText || '';
      return {
        hasRj: t.includes('乡村振兴协理员'),
        hasHenan: t.includes('河南'),
        hasNoHukou: t.includes('不限户籍'),
        hasGroup: !!document.querySelector('[data-rj-province]'),
        hasCaveat: t.includes('覆盖度声明'),
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    check('村官详情页含乡村振兴协理员板块', cunban.hasRj === true);
    check('协理员板块含河南（带编不限户籍）', cunban.hasHenan && cunban.hasNoHukou === true);
    check('协理员板块有省份分组', cunban.hasGroup === true);
    check('协理员板块有覆盖度声明', cunban.hasCaveat === true);
    check('480px 下村官详情页无横向溢出', cunban.docOverflow <= 1, `+${cunban.docOverflow}`);

    await cdp.send('Page.navigate', { url: `${BASE}/#/category/shequ?u=${Date.now()}` });
    await sleep(1400);
    const grid = await cdp.eval(`(() => {
      const t = document.getElementById('app-main')?.innerText || '';
      return {
        hasGj: t.includes('网格员'),
        hasGroup: !!document.querySelector('[data-gj-province]'),
        hasTemp: t.includes('临聘') || t.includes('编外'),
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    check('社区工作者详情页含网格员板块', grid.hasGj === true);
    check('网格员板块有省份分组', grid.hasGroup === true);
    check('网格员板块说明临聘/编外无编', grid.hasTemp === true);
    check('480px 下网格员板块无横向溢出', grid.docOverflow <= 1, `+${grid.docOverflow}`);

    await cdp.send('Page.navigate', { url: `${BASE}/#/category/shiye?u=${Date.now()}` });
    await sleep(1400);
    const wuhan = await cdp.eval(`(() => {
      const t = document.getElementById('app-main')?.innerText || '';
      return {
        hasWj: t.includes('双盲'),
        hasMechanism: t.includes('抽签'),
        hasGroup: !!document.querySelector('[data-wj-province]'),
        hasTag: !!document.querySelector('.cj-tag-blind'),
        hasWuhan: t.includes('武汉'),
        docOverflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    })()`);
    check('事业单位详情页含武汉双盲板块', wuhan.hasWj === true);
    check('双盲板块说明抽签机制', wuhan.hasMechanism === true);
    check('双盲板块有武汉分组', wuhan.hasGroup === true);
    check('双盲面试有标签渲染', wuhan.hasTag === true);
    check('双盲板块含武汉两场', wuhan.hasWuhan === true);
    check('480px 下双盲板块无横向溢出', wuhan.docOverflow <= 1, `+${wuhan.docOverflow}`);
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
