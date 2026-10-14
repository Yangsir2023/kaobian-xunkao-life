/**
 * 管理后台（仅 role=admin）
 * 运行概览 / 用户与角色管理（RBAC 演示）/ 全量安全审计日志
 */
import { api } from '../api.mjs';
import { session } from '../session.mjs';
import { icon } from '../icons.mjs';
import { escapeHtml, relativeTime, formatDate } from '../utils.mjs';
import { confirmDialog, toastOk, toastErr, emptyState } from '../ui.mjs';

export default {
  tab: null,
  requireAuth: true,

  bar() {
    return { title: '管理后台', subtitle: '用户 · 角色 · 全量审计', back: true };
  },

  async render() {
    if (!session.isAdmin()) {
      return `<div class="notice notice-danger">${icon('lock', { size: 17 })}<div class="grow">该页面仅管理员可访问（当前角色：${escapeHtml(session.role)}）。</div></div>`;
    }
    const [overview, users, logs] = await Promise.all([
      api.adminOverview(),
      api.adminUsers({ limit: 50 }),
      api.adminAuditLogs({ limit: 40 }),
    ]);
    return pageHtml(overview, users, logs);
  },

  mount(root) {
    bind(root);
  },
};

function pageHtml(overview, users, logs) {
  return `
  <section class="kpi-grid fade-in">
    <div class="kpi"><div class="kpi-label">注册用户</div><div class="kpi-value">${overview.users.total}</div></div>
    <div class="kpi"><div class="kpi-label">活跃会话</div><div class="kpi-value">${overview.sessions.active}</div></div>
    <div class="kpi"><div class="kpi-label">提醒总数</div><div class="kpi-value">${overview.reminders.total}</div></div>
    <div class="kpi"><div class="kpi-label">审计记录</div><div class="kpi-value">${overview.audit.total}</div></div>
  </section>

  <section class="card card-pad mt-14">
    <div class="section-head"><h2 class="section-title">存储与运行</h2></div>
    <div class="kv-list">
      <div class="kv"><div class="kv-key">数据驱动</div><div class="kv-val">${escapeHtml(overview.storage.driver)}${overview.storage.fallbackNotice ? `（${escapeHtml(overview.storage.fallbackNotice)}）` : ''}</div></div>
      <div class="kv"><div class="kv-key">健康状态</div><div class="kv-val">${overview.storage.health?.ok ? '<span class="badge badge-success">正常</span>' : '<span class="badge badge-fail">异常</span>'} ${escapeHtml(overview.storage.health?.detail || '')}</div></div>
      <div class="kv"><div class="kv-key">微信登录</div><div class="kv-val">已绑定微信账号 ${overview.users.wechatBound} 个</div></div>
      <div class="kv"><div class="kv-key">节点构成</div><div class="kv-val">公共节点 ${overview.reminders.official} 条 / 用户创建 ${overview.reminders.userCreated} 条</div></div>
    </div>
  </section>

  <section class="card card-pad mt-14">
    <div class="section-head"><h2 class="section-title">用户与角色</h2><span class="section-hint">共 ${users.total} 人</span></div>
    <div style="overflow-x:auto">
      <table class="table">
        <thead><tr><th>用户</th><th>角色</th><th>提醒</th><th>设备</th><th>操作</th></tr></thead>
        <tbody>
          ${users.users
            .map(
              (u) => `<tr>
            <td>
              <div class="strong">${escapeHtml(u.displayName)}</div>
              <div class="tiny muted">@${escapeHtml(u.username)}${u.wechatBound ? ' · 微信' : ''}</div>
            </td>
            <td><span class="badge badge-role ${u.role}">${roleLabel(u.role)}</span></td>
            <td class="num">${u.reminderCount}</td>
            <td class="num">${u.deviceCount}</td>
            <td>
              <select class="select" data-role-select="${u.id}" style="padding:6px 8px;font-size:12px;min-width:88px">
                ${['guest', 'user', 'admin']
                  .map((r) => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${roleLabel(r)}</option>`)
                  .join('')}
              </select>
            </td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
    <div class="small muted mt-10">调整角色会立即生效；被降级或状态变更的账号，其会话会被吊销需重新登录。</div>
  </section>

  <section class="card card-pad mt-14">
    <div class="section-head"><h2 class="section-title">全量安全审计</h2><span class="section-hint">最近 ${logs.logs.length} 条</span></div>
    ${logs.logs.length
      ? `<div class="timeline">${logs.logs
          .map(
            (log) => `<div class="tl-item is-${log.result}">
        <div class="tl-dot"></div>
        <div class="tl-head">
          <span class="tl-title">${escapeHtml(log.actionLabel)} · ${escapeHtml(log.actorName || '匿名')}</span>
          <span class="tl-time">${escapeHtml(formatDate(log.createdAt, true).slice(5))}</span>
        </div>
        <div class="tl-desc">
          ${log.message ? `${escapeHtml(log.message)}<br/>` : ''}
          <span class="num">${escapeHtml(log.ip)}</span> · ${escapeHtml(log.actorRole || 'guest')} · ${escapeHtml(relativeTime(log.createdAt))}
        </div>
      </div>`
          )
          .join('')}</div>`
      : emptyState({ iconName: 'list', title: '暂无审计记录' })}
  </section>`;
}

function roleLabel(role) {
  return { admin: '管理员', user: '普通用户', guest: '访客' }[role] || role;
}

function bind(root) {
  root.querySelectorAll('[data-role-select]').forEach((select) => {
    select.addEventListener('change', async () => {
      const userId = select.dataset.roleSelect;
      const role = select.value;
      const ok = await confirmDialog({
        title: `将角色改为「${roleLabel(role)}」？`,
        desc: '该操作会写入安全审计日志，且被调整账号的会话会被吊销。',
        confirmText: '确认调整',
      });
      if (!ok) {
        select.value = select.dataset.previous || select.value;
        return;
      }
      try {
        await api.adminSetRole(userId, role);
        toastOk('角色已更新');
        setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), 200);
      } catch (err) {
        toastErr(err.message);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    });
  });
}
