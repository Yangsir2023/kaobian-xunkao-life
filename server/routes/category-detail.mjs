/**
 * 分类详情路由：GET /api/categories/:key/detail
 *
 * 每个招考类别（节点）一页：今年公告 / 明年预测 / 户籍口径 / 历年公告 / 岗位深链。
 * 游客可读（与 /api/catalog/categories 同一权限模型）；数据组装在 server/category-detail.mjs。
 */
import { db } from '../store/index.mjs';
import { CODES, fail, ok } from '../lib/errors.mjs';
import { CATEGORY_KEYS } from '../catalog.mjs';
import { categoryDetail } from '../category-detail.mjs';
import { COMMUNITY_JOBS, communityJobsByProvince, communityJobsSummary } from '../community-jobs.mjs';
import { RURAL_COORDINATOR_JOBS, ruralCoordinatorByProvince, ruralCoordinatorSummary } from '../rural-coordinator-jobs.mjs';
import { GRID_WORKER_JOBS, gridWorkerByProvince, gridWorkerSummary } from '../grid-worker-jobs.mjs';
import { WUHAN_DOUBLE_BLIND, wuhanDoubleBlindByProvince, wuhanDoubleBlindSummary } from '../wuhan-double-blind.mjs';

export function registerCategoryRoutes(router) {
  // 全国社区工作者公告清单（单独接口：清单较长，前端也支持只看某省）
  router.get('/api/community-jobs', async () => ok({
    intro: COMMUNITY_JOBS.intro,
    caveat: COMMUNITY_JOBS.caveat,
    updatedAt: COMMUNITY_JOBS.updatedAt,
    year: COMMUNITY_JOBS.year,
    levels: COMMUNITY_JOBS.levels,
    summary: communityJobsSummary(),
    provinces: communityJobsByProvince(),
  }));

  // 全国乡村振兴协理员公告清单（单独接口）
  router.get('/api/rural-coordinator-jobs', async () => ok({
    intro: RURAL_COORDINATOR_JOBS.intro,
    caveat: RURAL_COORDINATOR_JOBS.caveat,
    updatedAt: RURAL_COORDINATOR_JOBS.updatedAt,
    year: RURAL_COORDINATOR_JOBS.year,
    levels: RURAL_COORDINATOR_JOBS.levels,
    summary: ruralCoordinatorSummary(),
    provinces: ruralCoordinatorByProvince(),
  }));

  // 全国网格员公告清单（单独接口）
  router.get('/api/grid-worker-jobs', async () => ok({
    intro: GRID_WORKER_JOBS.intro,
    caveat: GRID_WORKER_JOBS.caveat,
    updatedAt: GRID_WORKER_JOBS.updatedAt,
    year: GRID_WORKER_JOBS.year,
    levels: GRID_WORKER_JOBS.levels,
    summary: gridWorkerSummary(),
    provinces: gridWorkerByProvince(),
  }));

  // 武汉双盲考试专项清单（单独接口）
  router.get('/api/wuhan-double-blind', async () => ok({
    intro: WUHAN_DOUBLE_BLIND.intro,
    caveat: WUHAN_DOUBLE_BLIND.caveat,
    doubleBlind: WUHAN_DOUBLE_BLIND.doubleBlind,
    updatedAt: WUHAN_DOUBLE_BLIND.updatedAt,
    year: WUHAN_DOUBLE_BLIND.year,
    levels: WUHAN_DOUBLE_BLIND.levels,
    summary: wuhanDoubleBlindSummary(),
    provinces: wuhanDoubleBlindByProvince(),
  }));

  router.get('/api/categories/:key/detail', async (ctx) => {
    const key = ctx.params.key;
    if (!CATEGORY_KEYS.includes(key)) {
      throw fail(CODES.SYSTEM_NOT_FOUND, `分类不存在：${key}`, 404);
    }
    const data = categoryDetail(key);
    if (!data) {
      throw fail(CODES.SYSTEM_NOT_FOUND, `分类暂无详情数据：${key}`, 404);
    }

    // 岗位库公共岗位数（按考试类型逐类求和，避免依赖 $in 操作符）
    let count = 0;
    for (const examType of data.positions.examTypes) {
      count += await db.positions().count({ source: 'system', examType });
    }
    data.positions.count = count;

    return ok(data);
  });
}
