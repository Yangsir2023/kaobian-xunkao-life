/**
 * 模拟微信授权确认页（Mock 通道专用）
 *
 * 真实通道下用户会被跳转到微信开放平台；未配置 AppID/AppSecret 时走到这里，
 * 目的是把「授权 → 回调 → 换档案 → 票据换令牌」的完整链路在本地也能跑通与自动化测试。
 * 页面顶部明确标注「模拟授权」，避免误以为已接入真实微信。
 */
import { api } from '../api.mjs';
import { icon } from '../icons.mjs';
import { escapeHtml } from '../utils.mjs';
import { toastErr } from '../ui.mjs';
import { redirectAfterLogin } from './login.mjs';

export default {
  tab: null,

  bar() {
    return { title: '微信授权', subtitle: '模拟通道 · 仅用于本地联调', back: true };
  },

  async render(ctx) {
    const state = ctx.query.get('state') || '';
    return `
    <div class="auth-wrap fade-in">
      <div class="auth-brand">
        <div class="auth-logo" style="background:#07C160;box-shadow:0 10px 24px rgba(7,193,96,.22)">
          ${icon('wechat', { size: 30, strokeWidth: 1.7 })}
        </div>
        <h2 class="auth-title">微信授权登录</h2>
        <p class="auth-sub">巡考日历 请求获得以下权限</p>
      </div>

      <div class="notice notice-warn">
        ${icon('alert', { size: 16 })}
        <div class="grow">当前为<strong>模拟授权通道</strong>：不会访问微信服务器，仅按 OAuth2 授权码流程在本地生成一个稳定的虚拟 OpenID 用于联调。配置 WECHAT_APP_ID / WECHAT_APP_SECRET 后本页不再出现。</div>
      </div>

      <section class="card card-pad mt-14">
        <div class="kv-list">
          <div class="kv"><div class="kv-key">授权范围</div><div class="kv-val">snsapi_login（获取昵称、头像等公开信息）</div></div>
          <div class="kv"><div class="kv-key">授权后</div><div class="kv-val">自动创建或复用本地账号，并签发 15 分钟访问令牌 + 30 天刷新令牌</div></div>
          <div class="kv"><div class="kv-key">state</div><div class="kv-val num small truncate">${escapeHtml(state || '（缺失）')}</div></div>
        </div>
      </section>

      <div class="field mt-14">
        <label class="field-label" for="m-account">模拟的微信账号
          <span class="field-hint">不同取值 → 不同 OpenID</span>
        </label>
        <input class="input" id="m-account" value="demo" maxlength="40" />
        <div class="small muted mt-6">用于验证「同一微信账号重复授权会归并到同一个本地账号」。</div>
      </div>

      <button class="btn btn-wechat btn-block" id="m-confirm">${icon('check', { size: 17 })}同意授权</button>
      <button class="btn btn-ghost btn-block mt-10" id="m-cancel">取消</button>
    </div>`;
  },

  mount(root, ctx) {
    const state = ctx.query.get('state') || '';
    root.querySelector('#m-cancel').addEventListener('click', () => {
      window.location.hash = '/login';
    });
    root.querySelector('#m-confirm').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.innerHTML = `${icon('refresh', { size: 17, className: 'icon spin' })}授权中…`;
      try {
        const account = root.querySelector('#m-account').value.trim() || 'demo';
        // 第一步：模拟「用户同意授权 → 微信回调带回 code」
        const { ticket } = await api.wechatMockAuthorize({ state, demoAccount: account });
        // 第二步：票据换令牌（与真实通道完全相同的落点）
        const data = await api.wechatTicket(ticket);
        const { session } = await import('../session.mjs');
        session.set(data);
        redirectAfterLogin();
      } catch (err) {
        toastErr(err.message);
        button.disabled = false;
        button.innerHTML = `${icon('check', { size: 17 })}同意授权`;
      }
    });
  },
};
