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
