/**
 * 登录 / 注册页
 * 两条通道：
 *   1) 数据库账号：用户名 + 密码（注册时本地做强度校验，服务端二次校验 + scrypt 加盐存储）
 *   2) 微信授权：OAuth2 授权码流程；未配置 AppID 时走本地模拟授权通道并明确标注
 */
import { api } from '../api.mjs';
import { session } from '../session.mjs';
import { icon } from '../icons.mjs';
import { escapeHtml, passwordStrength } from '../utils.mjs';
import { toastOk, toastErr } from '../ui.mjs';

export default {
  tab: null,

  bar() {
    return {
      title: '登录巡考日历',
      subtitle: '账号密码 / 微信授权 两种方式',
      back: true,
    };
  },

  async render(ctx) {
    const wechatError = ctx.query.get('wechatError');
    const message = ctx.query.get('message');
    let wechat = { mode: 'mock', notice: '' };
    try {
      wechat = await api.wechatUrl(sessionStorage.getItem('xunkao.redirect') || '/');
    } catch {
      wechat = { mode: 'mock', notice: '无法获取微信授权配置，可直接使用账号密码登录' };
    }
    const html = pageHtml(wechat);
    if (wechatError) {
      setTimeout(() => toastErr(`微信授权失败：${message || wechatError}`), 60);
    }
    return html;
  },

  mount(root) {
    bind(root);
  },
};

function pageHtml(wechat) {
  return `
  <div class="auth-wrap fade-in">
    <div class="auth-brand">
      <div class="auth-logo">${icon('bell', { size: 28, strokeWidth: 1.9 })}</div>
      <h2 class="auth-title">巡考日历</h2>
      <p class="auth-sub">国考 · 省考 · 事业编 · 选调 · 军队文职 · 三支一扶 · 留服认证</p>
    </div>

    <div class="segmented" id="auth-tabs">
      <button class="is-active" data-tab="login">登录</button>
      <button data-tab="register">注册</button>
    </div>

    <form id="auth-form" novalidate>
      <div class="field">
        <label class="field-label" for="a-username">用户名</label>
        <input class="input" id="a-username" autocomplete="username" autocapitalize="off" spellcheck="false"
          placeholder="字母开头，3-32 位" />
        <div class="field-error hidden" id="ae-username">${icon('alert', { size: 13, className: 'icon icon-sm' })}<span></span></div>
      </div>

      <div class="field">
        <label class="field-label" for="a-password">密码</label>
        <input class="input" id="a-password" type="password" autocomplete="current-password" placeholder="至少 8 位，含字母与数字" />
        <div class="pw-meter hidden" id="a-meter">
          <i></i><i></i><i></i><i></i>
        </div>
        <div class="small muted mt-6 hidden" id="a-meter-label"></div>
        <div class="field-error hidden" id="ae-password">${icon('alert', { size: 13, className: 'icon icon-sm' })}<span></span></div>
      </div>

      <div class="field hidden" id="a-display-field">
        <label class="field-label" for="a-display">昵称
          <span class="field-hint">选填</span>
        </label>
        <input class="input" id="a-display" maxlength="40" placeholder="用于页面问候语" />
      </div>

      <button class="btn btn-block" id="a-submit" type="submit">${icon('lock', { size: 17 })}登录</button>
    </form>

    <div class="auth-alt"><span>或</span></div>

    <button class="btn btn-wechat btn-block" id="a-wechat">
      ${icon('wechat', { size: 19 })}微信一键登录
    </button>
    <div class="notice ${wechat.mode === 'mock' ? 'notice-warn' : 'notice-info'} mt-10">
      ${icon(wechat.mode === 'mock' ? 'alert' : 'info', { size: 16 })}
      <div class="grow">${
        wechat.mode === 'mock'
          ? '当前环境未配置微信 AppID/AppSecret，将走<strong>本地模拟授权</strong>通道（链路与真实授权一致，仅不访问微信服务器）。填写 .env 中的 WECHAT_APP_ID / WECHAT_APP_SECRET 即切换为真实授权。'
          : '将跳转微信开放平台完成 OAuth2 授权，授权后自动返回本应用。'
      }</div>
    </div>

    <button class="btn btn-ghost btn-block mt-10" id="a-guest">先以游客身份浏览</button>

    <div class="card card-pad mt-14">
      <div class="section-head"><h2 class="section-title">安全说明</h2></div>
      <div class="kv-list">
        <div class="kv">
          <div class="kv-key">口令存储</div>
          <div class="kv-val">服务端 scrypt 加盐哈希（N=16384, r=8, p=1），数据库不存明文</div>
        </div>
        <div class="kv">
          <div class="kv-key">会话机制</div>
          <div class="kv-val">JWT 无状态鉴权（15 分钟）+ 刷新令牌轮换（30 天，单次有效、重放即全族吊销）</div>
        </div>
        <div class="kv">
          <div class="kv-key">权限模型</div>
          <div class="kv-val">RBAC 三角色：游客 / 用户 / 管理员，越权访问会被拦截并记录审计</div>
        </div>
      </div>
    </div>
  </div>`;
}

function bind(root) {
  const tabs = root.querySelector('#auth-tabs');
  const submit = root.querySelector('#a-submit');
  const displayField = root.querySelector('#a-display-field');
  const meter = root.querySelector('#a-meter');
  const meterLabel = root.querySelector('#a-meter-label');
  let mode = 'login';

  tabs.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.tab;
      tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === btn));
      submit.innerHTML =
        mode === 'register'
          ? `${icon('user', { size: 17 })}创建账号`
          : `${icon('lock', { size: 17 })}登录`;
      displayField.classList.toggle('hidden', mode !== 'register');
      meter.classList.toggle('hidden', mode !== 'register');
      meterLabel.classList.toggle('hidden', mode !== 'register');
      root.querySelector('#a-password').setAttribute('autocomplete', mode === 'register' ? 'new-password' : 'current-password');
    });
  });

  const passwordInput = root.querySelector('#a-password');
  passwordInput.addEventListener('input', () => {
    if (mode !== 'register') return;
    const { score, level, label } = passwordStrength(passwordInput.value);
    meterLabel.textContent = passwordInput.value ? `密码${label}` : '';
    Array.from(meter.querySelectorAll('i')).forEach((bar, index) => {
      const on = index < score;
      bar.className = on ? `on-${level}` : '';
    });
  });

  root.querySelector('#auth-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = root.querySelector('#a-username').value.trim();
    const password = passwordInput.value;
    const displayName = root.querySelector('#a-display').value.trim();

    let valid = true;
    valid = markError(root, 'username', username.length < 3 ? '用户名至少 3 位' : '') && valid;
    if (mode === 'register') {
      const policy = passwordStrength(password);
      valid =
        markError(
          root,
          'password',
          password.length < 8
            ? '密码至少 8 位'
            : !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)
              ? '密码需同时包含字母与数字'
              : ''
        ) && valid;
      if (policy.level === 'weak' && valid) toastErr('密码强度偏弱，建议加入大写字母或符号');
    } else {
      valid = markError(root, 'password', password ? '' : '请输入密码') && valid;
    }
    if (!valid) return;

    submit.disabled = true;
    submit.innerHTML = `${icon('refresh', { size: 17, className: 'icon spin' })}处理中…`;
    try {
      const data =
        mode === 'register'
          ? await api.register({ username, password, displayName: displayName || undefined })
          : await api.login({ username, password });
      session.set(data);
      toastOk(mode === 'register' ? `注册成功，欢迎 ${data.user.displayName}` : `欢迎回来，${data.user.displayName}`);
      redirectAfterLogin();
    } catch (err) {
      toastErr(err.message);
      submit.disabled = false;
      submit.innerHTML = mode === 'register' ? `${icon('user', { size: 17 })}创建账号` : `${icon('lock', { size: 17 })}登录`;
    }
  });

  root.querySelector('#a-wechat').addEventListener('click', async () => {
    try {
      const info = await api.wechatUrl(sessionStorage.getItem('xunkao.redirect') || '/');
      if (info.mode === 'mock') {
        // 模拟通道：不跳外网，直接进入应用内的「模拟授权确认页」
        window.location.hash = `/wechat-authorize?state=${encodeURIComponent(info.state)}`;
      } else {
        window.location.href = info.authorizeUrl;
      }
    } catch (err) {
      toastErr(err.message);
    }
  });

  root.querySelector('#a-guest').addEventListener('click', () => {
    sessionStorage.removeItem('xunkao.redirect');
    window.location.hash = '/';
  });
}

function markError(root, field, message) {
  const box = root.querySelector(`#ae-${field}`);
  const input = root.querySelector(`#a-${field}`);
  if (message) {
    box.querySelector('span').textContent = message;
    box.classList.remove('hidden');
    input?.classList.add('has-error');
    return false;
  }
  box.classList.add('hidden');
  input?.classList.remove('has-error');
  return true;
}

export function redirectAfterLogin() {
  const target = sessionStorage.getItem('xunkao.redirect') || '/';
  sessionStorage.removeItem('xunkao.redirect');
  window.location.hash = target;
  // 强制重新渲染，保证顶栏/底部导航反映最新登录态
  setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), 30);
}
