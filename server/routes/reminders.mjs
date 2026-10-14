/**
 * 提醒业务路由。
 *
 * 权限模型（RBAC）：
 *   guest  只能读「公共招考节点」（官方公告导入的节点，source=official）
 *   user   可读写自己的提醒（ownerId === 自己），可标记完成
 *   admin  可读全量（含他人数据，用于运营排查）
 * 跨用户访问一律 403 并记审计，避免越权读。
 */
import { db } from '../store/index.mjs';
import { CODES, fail, ok } from '../lib/errors.mjs';
import * as V from '../lib/validate.mjs';
import { newId, nowIso } from '../lib/ids.mjs';
import { CATEGORY_KEYS, getCategory, deadlineMeta, publicCategories } from '../catalog.mjs';
import { ROLES, requireRole, requireAuth, roleAtLeast } from '../security/auth.mjs';
import { writeAudit, AUDIT_ACTIONS } from '../security/audit.mjs';

const STATUSES = ['active', 'done', 'archived'];
const SORTS = ['deadline_asc', 'deadline_desc', 'created_desc', 'created_asc'];

/** 分类校验单独成函数：分类错误必须回落 2003（业务错误码），而不是笼统的参数错误 */
function assertCategory(value) {
  if (typeof value !== 'string' || !CATEGORY_KEYS.includes(value)) {
    throw fail(CODES.REMINDER_BAD_CATEGORY, `考试类型不在支持的分类中：${value ?? '(空)'}`, 400);
  }
  return value;
}

/** 把文档转成前端契约结构（补上倒计时与分类信息，避免前端各页各算一遍） */
export function shapeReminder(doc, { viewer = null } = {}) {
  const category = getCategory(doc.category);
  const meta = deadlineMeta(doc.deadline, doc.deadlineTime);
  return {
    id: doc.id,
    title: doc.title,
    category: doc.category,
    categoryName: category?.short || doc.category,
    categoryFullName: category?.name || doc.category,
    categoryColor: category?.color || '#4B5563',
    categoryAccent: category?.accent || '#EEF0F3',
    categoryIcon: category?.icon || 'bell',
    deadline: doc.deadline,
    deadlineTime: doc.deadlineTime || null,
    deadlineLabel: `${doc.deadline}${doc.deadlineTime ? ` ${doc.deadlineTime}` : ''}`,
    countdown: meta,
    announcementUrl: doc.announcementUrl || null,
    announcementSource: doc.announcementSource || null,
    notes: doc.notes || '',
    attachments: doc.attachments || [],
    remindOffsets: doc.remindOffsets || [7, 3, 1],
    status: doc.status,
    source: doc.source,
    official: doc.source === 'official',
    ownerId: doc.ownerId,
    owned: viewer ? doc.ownerId === viewer.id : false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** 只允许更新业务字段，防止客户端伪造 ownerId / source 等 */
function pickWritable(body) {
  const patch = {};
  if (body.title !== undefined) patch.title = V.str(body.title, 'title', { min: 2, max: 80 });
  if (body.category !== undefined) {
    patch.category = assertCategory(body.category);
  }
  if (body.deadline !== undefined) patch.deadline = V.dateOnly(body.deadline);
  if (body.deadlineTime !== undefined) patch.deadlineTime = V.timeOnly(body.deadlineTime);
  if (body.announcementUrl !== undefined) {
    patch.announcementUrl = V.httpUrl(body.announcementUrl, 'announcementUrl', { required: false });
  }
  if (body.notes !== undefined) {
    patch.notes = body.notes === null ? '' : String(body.notes).slice(0, 2000);
  }
  if (body.status !== undefined) {
    patch.status = V.oneOf(body.status, STATUSES, 'status', { fallback: 'active' });
  }
  if (body.remindOffsets !== undefined) {
    if (!Array.isArray(body.remindOffsets)) throw fail(CODES.REMINDER_INVALID_PARAMS, 'remindOffsets 应为数组', 400);
    patch.remindOffsets = [...new Set(body.remindOffsets.map((n) => Number.parseInt(n, 10)))]
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 180)
      .sort((a, b) => b - a)
      .slice(0, 6);
  }
  if (body.attachments !== undefined) {
    if (!Array.isArray(body.attachments)) throw fail(CODES.REMINDER_INVALID_PARAMS, 'attachments 应为数组', 400);
    patch.attachments = body.attachments.slice(0, 6).map((item) => ({
      name: String(item?.name || '公告截图').slice(0, 120),
      url: V.httpUrl(item?.url, 'attachments[].url', { required: true }),
      size: Number.parseInt(item?.size, 10) || 0,
      mime: String(item?.mime || 'image/png').slice(0, 60),
    }));
  }
  return patch;
}

export function registerReminderRoutes(router) {
  /* ── 分类目录（游客可读） ─────────────────────────── */
  router.get('/api/catalog/categories', async (ctx) => {
    const identity = ctx.identity;
    const authed = Boolean(identity?.authenticated);
    const counts = {};
    const officialCounts = {};
    for (const key of CATEGORY_KEYS) {
      // 游客没有「我的提醒」概念，必须显式置 0，
      // 否则空 filter 会把官方节点也算进「我的」，界面计数会误导
      counts[key] = authed
        ? await db.reminders().count({ ownerId: identity.user.id, category: key, status: { $ne: 'archived' } })
        : 0;
      officialCounts[key] = await db.reminders().count({ category: key, source: 'official' });
    }
    return ok({
      categories: publicCategories().map((c) => ({
        ...c,
        myCount: counts[c.key] || 0,
        officialCount: officialCounts[c.key] || 0,
      })),
      statuses: STATUSES,
      sorts: SORTS,
    });
  });

  /* ── 列表（首页 + 筛选页共用） ────────────────────── */
  router.get('/api/reminders', async (ctx) => {
    const identity = ctx.identity;
    const scope = V.oneOf(ctx.query.get('scope'), ['mine', 'official', 'all'], 'scope', { fallback: null });
    const categoryParam = ctx.query.get('category');
    const categories = (categoryParam ? categoryParam.split(',') : []).filter((c) => CATEGORY_KEYS.includes(c));
    const status = V.oneOf(ctx.query.get('status'), STATUSES, 'status', { fallback: null });
    const sort = V.oneOf(ctx.query.get('sort'), SORTS, 'sort', { fallback: 'deadline_asc' });
    const q = (ctx.query.get('q') || '').trim().slice(0, 60);
    const withinDays = V.intInRange(ctx.query.get('withinDays'), 'withinDays', { min: 1, max: 730, fallback: null });
    const limit = V.intInRange(ctx.query.get('limit'), 'limit', { min: 1, max: 200, fallback: 100 });
    const offset = V.intInRange(ctx.query.get('offset'), 'offset', { min: 0, max: 10000, fallback: 0 });

    const filter = {};
    const effectiveScope = scope || (identity?.authenticated ? 'mine' : 'official');

    if (effectiveScope === 'official') {
      filter.source = 'official';
      if (!identity?.authenticated) {
        // 游客只能看未过期的公共节点
        filter.status = 'active';
      }
    } else if (effectiveScope === 'all') {
      requireRole(ctx, ROLES.ADMIN);
      if (identity.user.role !== ROLES.ADMIN) throw fail(CODES.FORBIDDEN_ROLE, undefined, 403);
    } else {
      requireAuth(ctx);
      filter.ownerId = identity.user.id;
    }

    if (categories.length === 1) filter.category = categories[0];
    else if (categories.length > 1) filter.category = { $in: categories };
    if (status) filter.status = status;

    let rows = await db.reminders().find(filter, {
      sort: sort === 'deadline_asc'
        ? { field: 'deadline', order: 'asc' }
        : sort === 'deadline_desc'
          ? { field: 'deadline', order: 'desc' }
          : sort === 'created_asc'
            ? { field: 'createdAt', order: 'asc' }
            : { field: 'createdAt', order: 'desc' },
    });

    let shaped = rows.map((doc) => shapeReminder(doc, { viewer: identity?.user || null }));

    if (q) {
      const needle = q.toLowerCase();
      shaped = shaped.filter(
        (r) =>
          r.title.toLowerCase().includes(needle) ||
          (r.notes || '').toLowerCase().includes(needle) ||
          r.categoryName.includes(needle) ||
          r.categoryFullName.includes(needle)
      );
    }
    if (withinDays != null) {
      shaped = shaped.filter((r) => !r.countdown.expired && r.countdown.days <= withinDays);
    }

    const stats = {
      total: shaped.length,
      active: shaped.filter((r) => r.status === 'active' && !r.countdown.expired).length,
      urgent: shaped.filter((r) => r.countdown.level === 'urgent').length,
      within7: shaped.filter((r) => !r.countdown.expired && r.countdown.days <= 7).length,
      expired: shaped.filter((r) => r.countdown.expired).length,
    };

    const page = shaped.slice(offset, offset + limit);
    return ok({
      scope: effectiveScope,
      count: shaped.length,
      stats,
      categories: CATEGORY_KEYS.filter((k) => categories.includes(k)),
      reminders: page,
      page: { limit, offset, hasMore: offset + limit < shaped.length },
    });
  });

  /* ── 详情 ─────────────────────────────────────────── */
  router.get('/api/reminders/:id', async (ctx) => {
    const identity = ctx.identity;
    const doc = await db.reminders().findById(ctx.params.id);
    if (!doc) throw fail(CODES.REMINDER_NOT_FOUND, undefined, 404);

    const isOwner = identity?.authenticated && doc.ownerId === identity.user.id;
    const isOfficial = doc.source === 'official';
    const isAdmin = identity?.authenticated && roleAtLeast(identity.role, ROLES.ADMIN);
    if (!isOwner && !isOfficial && !isAdmin) {
      await writeAudit({
        action: AUDIT_ACTIONS.REMINDER_ACCESS_DENIED,
        ctx,
        actor: identity?.authenticated ? identity.user : null,
        target: `reminder:${doc.id}`,
        result: 'failure',
        message: '尝试访问他人提醒详情',
      });
      throw fail(CODES.FORBIDDEN_RESOURCE, undefined, 403);
    }
    return ok({ reminder: shapeReminder(doc, { viewer: identity?.user || null }) });
  });

  /* ── 新增 ─────────────────────────────────────────── */
  router.post('/api/reminders', async (ctx) => {
    const identity = requireRole(ctx, ROLES.USER);
    const body = ctx.body || {};
    const title = V.str(body.title, 'title', { min: 2, max: 80 });
    const category = assertCategory(body.category);
    const deadline = V.dateOnly(body.deadline);

    const doc = await db.reminders().insertOne({
      id: newId('rem'),
      ownerId: identity.user.id,
      title,
      category,
      deadline,
      deadlineTime: V.timeOnly(body.deadlineTime),
      announcementUrl: V.httpUrl(body.announcementUrl, 'announcementUrl', { required: false }),
      announcementSource: 'user',
      notes: body.notes ? String(body.notes).slice(0, 2000) : '',
      attachments: [],
      remindOffsets: [7, 3, 1],
      status: 'active',
      source: 'user',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    await writeAudit({
      action: AUDIT_ACTIONS.REMINDER_CREATED,
      ctx,
      actor: identity.user,
      target: `reminder:${doc.id}`,
      message: `新增提醒「${doc.title}」`,
      meta: { category, deadline },
    });
    return ok({ reminder: shapeReminder(doc, { viewer: identity.user }) }, '提醒已创建');
  });

  /* ── 编辑 ─────────────────────────────────────────── */
  router.patch('/api/reminders/:id', async (ctx) => {
    const identity = requireRole(ctx, ROLES.USER);
    const doc = await db.reminders().findById(ctx.params.id);
    if (!doc) throw fail(CODES.REMINDER_NOT_FOUND, undefined, 404);

    const isOwner = doc.ownerId === identity.user.id;
    const isAdmin = roleAtLeast(identity.role, ROLES.ADMIN);
    if (!isOwner && !isAdmin) {
      await writeAudit({
        action: AUDIT_ACTIONS.REMINDER_ACCESS_DENIED,
        ctx,
        actor: identity.user,
        target: `reminder:${doc.id}`,
        result: 'failure',
        message: '尝试修改他人提醒',
      });
      throw fail(CODES.FORBIDDEN_RESOURCE, undefined, 403);
    }
    if (doc.source === 'official' && !isAdmin) {
      throw fail(CODES.FORBIDDEN_RESOURCE, '官方节点只读，可复制为自己的提醒后修改', 403);
    }

    const patch = { ...pickWritable(ctx.body || {}), updatedAt: nowIso() };
    const updated = await db.reminders().updateById(doc.id, patch);
    await writeAudit({
      action: AUDIT_ACTIONS.REMINDER_UPDATED,
      ctx,
      actor: identity.user,
      target: `reminder:${doc.id}`,
      message: `更新提醒「${updated.title}」`,
      meta: { fields: Object.keys(patch).filter((k) => k !== 'updatedAt') },
    });
    return ok({ reminder: shapeReminder(updated, { viewer: identity.user }) }, '已保存');
  });

  /* ── 删除 ─────────────────────────────────────────── */
  router.delete('/api/reminders/:id', async (ctx) => {
    const identity = requireRole(ctx, ROLES.USER);
    const doc = await db.reminders().findById(ctx.params.id);
    if (!doc) throw fail(CODES.REMINDER_NOT_FOUND, undefined, 404);

    const isOwner = doc.ownerId === identity.user.id;
    const isAdmin = roleAtLeast(identity.role, ROLES.ADMIN);
    if (!isOwner && !isAdmin) {
      await writeAudit({
        action: AUDIT_ACTIONS.REMINDER_ACCESS_DENIED,
        ctx,
        actor: identity.user,
        target: `reminder:${doc.id}`,
        result: 'failure',
        message: '尝试删除他人提醒',
      });
      throw fail(CODES.FORBIDDEN_RESOURCE, undefined, 403);
    }

    await db.reminders().deleteById(doc.id);
    await writeAudit({
      action: AUDIT_ACTIONS.REMINDER_DELETED,
      ctx,
      actor: identity.user,
      target: `reminder:${doc.id}`,
      message: `删除提醒「${doc.title}」`,
      meta: { ownerId: doc.ownerId, byAdmin: !isOwner && isAdmin },
    });
    return ok({ deleted: true });
  });

  /* ── 一键复制公共节点为自己的提醒 ─────────────────── */
  router.post('/api/reminders/:id/clone', async (ctx) => {
    const identity = requireRole(ctx, ROLES.USER);
    const doc = await db.reminders().findById(ctx.params.id);
    if (!doc) throw fail(CODES.REMINDER_NOT_FOUND, undefined, 404);

    const created = await db.reminders().insertOne({
      id: newId('rem'),
      ownerId: identity.user.id,
      title: doc.title,
      category: doc.category,
      deadline: doc.deadline,
      deadlineTime: doc.deadlineTime || null,
      announcementUrl: doc.announcementUrl || null,
      announcementSource: doc.source,
      notes: doc.notes ? `来自公共节点：${doc.title}` : '',
      attachments: [],
      remindOffsets: doc.remindOffsets || [7, 3, 1],
      status: 'active',
      source: 'user',
      clonedFromId: doc.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await writeAudit({
      action: AUDIT_ACTIONS.REMINDER_CREATED,
      ctx,
      actor: identity.user,
      target: `reminder:${created.id}`,
      message: `从公共节点复制「${doc.title}」`,
      meta: { clonedFromId: doc.id },
    });
    return ok({ reminder: shapeReminder(created, { viewer: identity.user }) }, '已加入我的提醒');
  });

  /* ── 首页统计（独立接口，供顶栏卡片） ─────────────── */
  router.get('/api/reminders/stats/summary', async (ctx) => {
    requireAuth(ctx);
    const identity = ctx.identity;
    const rows = await db.reminders().find({ ownerId: identity.user.id });
    const shaped = rows.map((doc) => shapeReminder(doc, { viewer: identity.user }));
    return ok({
      total: shaped.length,
      active: shaped.filter((r) => r.status === 'active' && !r.countdown.expired).length,
      within7: shaped.filter((r) => !r.countdown.expired && r.countdown.days <= 7).length,
      within30: shaped.filter((r) => !r.countdown.expired && r.countdown.days <= 30).length,
      expired: shaped.filter((r) => r.countdown.expired).length,
      next: shaped
        .filter((r) => !r.countdown.expired && r.status === 'active')
        .sort((a, b) => a.countdown.days - b.countdown.days)
        .slice(0, 3),
    });
  });
}
