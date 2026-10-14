/**
 * 我的 / 安全记录页
 * 包含：账号资料与角色、登录设备管理、安全审计日志、退出登录（当前设备 / 全部设备）
 */
import { api } from '../api.mjs';
import { session } from '../session.mjs';
import { icon } from '../icons.mjs';
import { escapeHtml, relativeTime, formatDate } from '../utils.mjs';
import { confirmDialog, toastOk, toastErr, emptyState, openSheet } from '../ui.mjs';

export default {
  tab: 'me',
  requireAuth: true,

  bar() {
    return {
      title: '我的',
      subtitle: '账号、登录设备与安全审计记录',
      actions: [
        { key: 'add', icon: 'plus', label: '新增提醒', onClick: () => { window.location.hash = '/reminders/new'; } },
      ],
    };
  },

  async render() {
    const [me, devices, logs, summary] = await Promise.all([
      api.me(),
      api.devices(),
      api.auditLogs({ limit: 20 }),
      api.securitySummary(),
    ]);
    return pageHtml(me, devices, logs, summary);
  },

  mount(root) {
    bind(root);
  },
};

function pageHtml(me, devices, logs, summary) {
  const user = me.user;
  const initial = (user.displayName || user.username).slice(0, 1).toUpperCase();
  return `
  <section class="profile-card fade-in">
    <div class="row">
      <div class="profile-avatar">${escapeHtml(initial)}</div>
      <div class="grow">
        <div class="profile-name">${escapeHtml(user.displayName)}</div>
        <div class="profile-sub">@${escapeHtml(user.username)} · ${roleLabel(user.role)}</div>
      </div>
      <span class="badge badge-role ${user.role}" style="background:rgba(255,255,255,.22);color:#fff">
        ${user.role === 'admin' ? icon('shield', { size: 12, className: 'icon icon-sm' }) : ''}${roleLabel(user.role)}
      </span>
    </div>
    <div class="profile-stats">
      <div class="profile-stat"><b>${me.stats.reminders}</b><span>提醒总数</span></div>
      <div class="profile-stat"><b>${me.stats.active}</b><span>进行中</span></div>
      <div class="profile-stat"><b>${me.stats.devices}</b><span>在线设备</span></div>
      <div class="profile-stat"><b>${me.stats.auditLogs}</b><span>审计记录</span></div>
    </div>
  </section>

  <section class="card card-pad mt-14">
    <div class="section-head">
      <h2 class="section-title">账号绑定</h2>
      <span class="storage-pill">${storageLabel(me.storage)}</span>
    </div>
    <div class="menu-list">
      <div class="menu-item" style="cursor:default">
        <div class="menu-icon">${icon('key', { size: 17 })}</div>
        <div class="grow">
          <div class="menu-label">密码登录</div>
          <div class="small muted">${user.bindings.password ? '已设置 · scrypt 加盐哈希存储' : '未设置'}</div>
        </div>
        <span class="badge ${user.bindings.password ? 'badge-success' : 'badge-outline'}">${user.bindings.password ? '已启用' : '未启用'}</span>
      </div>
      <div class="menu-item" style="cursor:default">
        <div class="menu-icon">${icon('wechat', { size: 17 })}</div>
        <div class="grow">
          <div class="menu-label">微信授权</div>
          <div class="small muted">${user.bindings.wechat ? '已绑定 OpenID' : '未绑定，可绑定后一键登录'}</div>
        </div>
        <span class="badge ${user.bindings.wechat ? 'badge-success' : 'badge-outline'}">${user.bindings.wechat ? '已绑定' : '未绑定'}</span>
      </div>
      <div class="menu-item" style="cursor:default">
        <div class="menu-icon">${icon('clock', { size: 17 })}</div>
        <div class="grow">
          <div class="menu-label">当前会话</div>
          <div class="small muted">${escapeHtml(me.security.currentSession.deviceName || '未知设备')} · ${
            me.security.currentSession.loginMethod === 'wechat' ? '微信授权' : '密码登录'
          } · 已轮换 ${me.security.currentSession.rotateCount} 次</div>
        </div>
      </div>
    </div>
    ${user.role === 'admin'
      ? `<button class="btn btn-soft btn-block mt-10" id="go-admin">${icon('settings', { size: 17 })}进入管理后台</button>`
      : ''}
  </section>

  <section class="card card-pad mt-14">
    <div class="section-head">
      <h2 class="section-title">登录设备</h2>
      <span class="section-hint">${devices.active} 台在线 / 共 ${devices.total} 台</span>
    </div>
    <div id="device-list">
      ${devices.devices.length ? devices.devices.map(deviceHtml).join('') : emptyState({ iconName: 'smartphone', title: '暂无设备记录' })}
    </div>
    <div class="small muted mt-10">
      吊销设备会立即使该设备上的会话失效（访问令牌也会被拒绝），令牌只存在服务端的哈希副本，泄露也无法复用。
    </div>
  </section>

  <section class="card card-pad mt-14">
    <div class="section-head">
      <h2 class="section-title">安全提示</h2>
      <span class="section-hint">基于当前状态生成</span>
    </div>
    ${summary.riskTips
      .map(
        (tip) => `<div class="notice ${tip.level === 'warn' ? 'notice-warn' : tip.level === 'ok' ? 'notice-info' : 'notice-info'} mt-6">
        ${icon(tip.level === 'warn' ? 'alert' : tip.level === 'ok' ? 'shield' : 'info', { size: 16 })}
        <div class="grow">${escapeHtml(tip.text)}</div>
      </div>`
      )
      .join('')}
  </section>

  <section class="card card-pad mt-14">
    <div class="section-head">
      <h2 class="section-title">安全审计日志</h2>
      <button class="section-link" id="filter-logs">${icon('filter', { size: 13, className: 'icon icon-sm' })}筛选</button>
    </div>
    <div id="log-list">${logsHtml(logs.logs)}</div>
    ${logs.total > logs.logs.length
      ? `<button class="btn btn-ghost btn-block mt-10" id="load-more-logs">查看更早的 ${logs.total - logs.logs.length} 条</button>`
      : ''}
  </section>

  <section class="mt-14">
    <button class="btn btn-ghost btn-block" id="logout-current">${icon('logout', { size: 17 })}退出登录（当前设备）</button>
    <button class="btn btn-danger-ghost btn-block mt-10" id="logout-all">${icon('logout', { size: 17 })}退出全部设备</button>
  </section>

  <div class="small muted mt-14" style="text-align:center">
    巡考日历 v1.0.0 · 数据存储：${escapeHtml(me.storage.driver === 'cloudbase' ? 'CloudBase 云数据库' : '本地 JSON 数据文件')}
  </div>`;
}

function roleLabel(role) {
  return { admin: '管理员', user: '普通用户', guest: '访客' }[role] || role;
}

function storageLabel(storage) {
  return storage.driver === 'cloudbase' ? '云数据库 + 云存储' : '本地数据文件';
}

function deviceHtml(device) {
  const isMobile = /iPhone|Android|移动|手机/i.test(device.name || '');
  return `<div class="device ${device.current ? 'is-current' : ''} ${device.revoked ? 'is-revoked' : ''}" data-device="${device.id}">
    <div class="device-icon">${icon(isMobile ? 'smartphone' : 'monitor', { size: 18 })}</div>
    <div class="grow">
      <div class="device-name">
        ${escapeHtml(device.name || '未知设备')}
        ${device.current ? '<span class="badge badge-success" style="margin-left:6px">当前设备</span>' : ''}
        ${device.revoked ? '<span class="badge badge-fail" style="margin-left:6px">已吊销</span>' : ''}
      </div>
      <div class="device-sub num">${escapeHtml(device.ip)} · 最近活跃 ${escapeHtml(relativeTime(device.lastSeenAt))}</div>
    </div>
    ${device.revoked
      ? ''
      : `<button class="icon-btn danger" data-revoke="${device.id}">${icon('close', { size: 14, className: 'icon icon-sm' })}下线</button>`}
  </div>`;
}

function logsHtml(logs) {
  if (!logs.length) return emptyState({ iconName: 'list', title: '暂无审计记录' });
  return `<div class="timeline">${logs
    .map(
      (log) => `<div class="tl-item is-${log.result}">
      <div class="tl-dot"></div>
      <div class="tl-head">
        <span class="tl-title">${escapeHtml(log.actionLabel)}</span>
        <span class="tl-time">${escapeHtml(formatDate(log.createdAt, true).slice(5))}</span>
      </div>
      <div class="tl-desc">
        ${log.message ? `${escapeHtml(log.message)}<br/>` : ''}
        <span class="num">${escapeHtml(log.ip)}</span>${log.deviceName ? ` · ${escapeHtml(log.deviceName)}` : ''}
      </div>
    </div>`
    )
    .join('')}</div>`;
}

/* ───────────────── 交互 ───────────────── */

function bind(root) {
  const state = { logs: null, logFilter: '' };

  root.querySelectorAll('[data-revoke]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: '吊销这台设备？',
        desc: '该设备上的登录状态会立即失效，需要重新登录。',
        confirmText: '确认吊销',
        danger: true,
      });
      if (!ok) return;
      try {
        const data = await api.revokeDevice(btn.dataset.revoke);
        toastOk(`已吊销，失效会话 ${data.revokedSessions} 个`);
        rerender();
      } catch (err) {
        toastErr(err.message);
      }
    });
  });

  const adminBtn = root.querySelector('#go-admin');
  if (adminBtn) adminBtn.addEventListener('click', () => { window.location.hash = '/admin'; });

  const filterBtn = root.querySelector('#filter-logs');
  if (filterBtn) {
    filterBtn.addEventListener('click', () => {
      openSheet({
        title: '筛选审计日志',
        subtitle: '按结果或动作前缀过滤',
        content: `
          <div class="filter-group">
            <div class="filter-group-title">结果</div>
            <div class="chip-scroll" style="flex-wrap:wrap;overflow:visible">
              <button class="chip tint ${!state.logFilter ? 'is-active' : ''}" data-result="">全部</button>
              <button class="chip tint ${state.logFilter === 'success' ? 'is-active' : ''}" data-result="success">成功</button>
              <button class="chip tint ${state.logFilter === 'failure' ? 'is-active' : ''}" data-result="failure">失败 / 拦截</button>
            </div>
          </div>
          <div class="filter-group">
            <div class="filter-group-title">动作前缀</div>
            <div class="chip-scroll" style="flex-wrap:wrap;overflow:visible">
              ${['', 'auth.', 'reminder.', 'me.', 'upload.', 'admin.']
                .map(
                  (prefix) =>
                    `<button class="chip tint ${state.logFilter === prefix ? 'is-active' : ''}" data-prefix="${prefix}">${
                      prefix ? prefix.replace('.', '') : '全部'
                    }</button>`
                )
                .join('')}
            </div>
          </div>
          <button class="btn btn-block" id="log-apply">应用筛选</button>`,
        mount(body, close) {
          let result = state.logFilter.includes('.') ? '' : state.logFilter;
          let prefix = state.logFilter.includes('.') ? state.logFilter : '';
          body.querySelectorAll('[data-result]').forEach((b) => {
            b.addEventListener('click', () => {
              result = b.dataset.result;
              body.querySelectorAll('[data-result]').forEach((x) => x.classList.toggle('is-active', x === b));
            });
          });
          body.querySelectorAll('[data-prefix]').forEach((b) => {
            b.addEventListener('click', () => {
              prefix = b.dataset.prefix;
              body.querySelectorAll('[data-prefix]').forEach((x) => x.classList.toggle('is-active', x === b));
            });
          });
          body.querySelector('#log-apply').addEventListener('click', async () => {
            close();
            const query = {};
            if (result) query.result = result;
            if (prefix) query.action = prefix;
            const data = await api.auditLogs({ limit: 50, ...query });
            const list = root.querySelector('#log-list');
            list.innerHTML = logsHtml(data.logs);
            toastOk(`已显示 ${data.logs.length} 条记录`);
          });
        },
      });
    });
  }

  const moreBtn = root.querySelector('#load-more-logs');
  if (moreBtn) {
    moreBtn.addEventListener('click', async () => {
      const data = await api.auditLogs({ limit: 100 });
      root.querySelector('#log-list').innerHTML = logsHtml(data.logs);
      moreBtn.remove();
    });
  }

  root.querySelector('#logout-current').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '退出当前设备？',
      desc: '仅失效当前浏览器的登录状态，其他设备不受影响。',
      confirmText: '退出登录',
    });
    if (!ok) return;
    try {
      await api.logout();
    } catch {
      /* 即使请求失败也清空本地状态 */
    }
    session.clear();
    toastOk('已退出登录');
    window.location.hash = '/';
  });

  root.querySelector('#logout-all').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '退出全部设备？',
      desc: '所有设备（含当前设备）的登录状态都会被吊销，需重新登录。',
      confirmText: '全部退出',
      danger: true,
    });
    if (!ok) return;
    try {
      const data = await api.logoutAll();
      toastOk(`已吊销 ${data.revoked} 个会话`);
    } catch (err) {
      toastErr(err.message);
    }
    session.clear();
    window.location.hash = '/';
  });
}

function rerender() {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
