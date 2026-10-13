/** 极简 User-Agent 解析：只为了在“登录设备”里显示人能看懂的名字 */
const BROWSERS = [
  [/Edg[A-Za-z]*\/([\d.]+)/, 'Edge'],
  [/OPR\/([\d.]+)/, 'Opera'],
  [/MicroMessenger\/([\d.]+)/, '微信内置浏览器'],
  [/Firefox\/([\d.]+)/, 'Firefox'],
  [/Chrome\/([\d.]+)/, 'Chrome'],
  [/Version\/([\d.]+).*Safari/, 'Safari'],
];

const SYSTEMS = [
  [/Windows NT 10/, 'Windows 10/11'],
  [/Windows NT 6\.1/, 'Windows 7'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android\s?([\d.]+)?/, 'Android'],
  [/Mac OS X/, 'macOS'],
  [/Linux/, 'Linux'],
  [/HarmonyOS/, 'HarmonyOS'],
];

export function parseUserAgent(ua = '') {
  let browser = '未知浏览器';
  for (const [re, name] of BROWSERS) {
    const m = re.exec(ua);
    if (m) {
      browser = `${name} ${m[1] || ''}`.trim();
      break;
    }
  }
  let system = '未知系统';
  for (const [re, name] of SYSTEMS) {
    if (re.test(ua)) {
      system = name;
      break;
    }
  }
  const isMobile = /Mobile|Android|iPhone|iPad|HarmonyOS/i.test(ua);
  return { browser, system, isMobile, label: `${system} · ${browser}` };
}

/** 兜底设备名：iOS · Chrome → iPhone · Chrome；桌面端则标“电脑” */
export function defaultDeviceName(ua = '') {
  const { browser, system, isMobile } = parseUserAgent(ua);
  if (!isMobile) return `${system} 电脑 · ${browser}`;
  if (system === 'iOS') return `iPhone · ${browser}`;
  if (system === 'Android') return `Android 手机 · ${browser}`;
  return `${system} 设备 · ${browser}`;
}

/** 取真实客户端 IP：优先代理透传头，其次回落到 socket 地址 */
export function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    const first = xff.split(',')[0].trim();
    if (first) return first.replace(/^::ffff:/, '');
  }
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real) return real.replace(/^::ffff:/, '');
  const socketIp = req.socket?.remoteAddress || '';
  return socketIp.replace(/^::ffff:/, '') || '127.0.0.1';
}
