/**
 * 微信授权回跳落点（真实通道 / 模拟通道共用）
 *
 * 服务端回调不会把令牌塞进 URL（会留在浏览器历史与访问日志里），
 * 而是给一次性票据（60 秒、单次使用），本页用票据换正式令牌。
 */
import { api } from '../api.mjs';
import { session } from '../session.mjs';
import { icon } from '../icons.mjs';
import { toastErr } from '../ui.mjs';
import { redirectAfterLogin } from './login.mjs';

export default {
  tab: null,

  bar() {
    return { title: '正在完成登录', subtitle: '微信授权回调处理中', back: false };
  },

  async render(ctx) {
    const ticket = ctx.query.get('ticket');
    if (!ticket) {
      return `<div class="empty"><div class="empty-icon">${icon('alert', { size: 26 })}</div>
        <h3 class="empty-title">缺少登录票据</h3>
        <p class="empty-desc">授权回调链接不完整，请重新发起微信登录。</p>
        <button class="btn" id="t-back">返回登录</button></div>`;
    }
    return `<div class="boot-splash">
      <div class="boot-mark"></div>
      <p class="boot-text">正在校验授权票据并签发令牌…</p>
    </div>`;
  },

  mount(root, ctx) {
    const ticket = ctx.query.get('ticket');
    root.querySelector('#t-back')?.addEventListener('click', () => {
      window.location.hash = '/login';
    });
    if (!ticket) return;

    (async () => {
      try {
        const data = await api.wechatTicket(ticket);
        session.set(data);
        redirectAfterLogin();
      } catch (err) {
        toastErr(err.message);
        window.location.hash = '/login';
      }
    })();
  },
};
