/**
 * 全国乡村振兴协理员 / 村级协理员招聘公告清单。
 *
 * ── 为什么有这个文件 ─────────────────────────────────────────
 * "乡村振兴协理员"是 2026 年出现的新赛道：河南率先推出省级专项计划，
 * 10,000 个名额全部纳入乡镇事业编制，且明确不限户籍——对留学生和外地考生
 * 来说是极低门槛的带编通道。但这类公告散落在各省人社厅 / 人事考试网，
 * 没有统一入口，容易被忽略。这份清单把检索到的公告收下来，让人一眼看到
 * 哪些地方在招、门槛是什么、能不能报。
 *
 * ── 数据诚实边界（务必先读）────────────────────────────────────
 * 与 server/community-jobs.mjs 同一套级别语言：
 *   official    政府门户 / 人事考试中心 / 招聘平台上的公告原文链接
 *   thirdparty  第三方机构（中公 / 华图 / 媒体）汇总或转载
 *
 * 收录纪律：
 *   1. 每条必须有 sourceUrl；人数、报名窗口能从来源材料读到才写；
 *   2. "不限户籍"只在公告原文明确写了不限制时才标，不推断；
 *   3. 不同省份的"协理员"政策差异极大：河南是事业编制、北京是合同制、
 *      广西可能是地方性项目——必须逐条标注编制属性，不统一口径。
 */
import { RECOMMEND_LEVELS } from './best-recommend.mjs';

export const RURAL_LEVELS = RECOMMEND_LEVELS.filter((l) => l.key !== 'forecast');
export const RURAL_LEVEL_KEYS = RURAL_LEVELS.map((l) => l.key);

export const RURAL_COORDINATOR_JOBS = {
  updatedAt: '2026-10-15',
  year: 2026,
  intro:
    '乡村振兴协理员是 2026 年基层招录的新赛道：省级统筹、带事业编制、门槛低于常规事业编。不同省份政策差异极大——河南万名带编不限户籍，北京限生源，广西为地方项目。清单只收能拿到来源链接的公告。',
  caveat:
    '覆盖度声明：乡村振兴协理员没有全国统一考试，各省政策差异极大（编制属性 / 户籍口径 / 待遇标准各不相同）。本次检索覆盖 3 个省份，其中河南为省级事业编专项、北京限北京生源、广西信息待核实。未列省份不代表没招，只代表未检索到可引用原文。',
  levels: RURAL_LEVELS,
  provinces: [
    {
      key: 'henan',
      name: '河南',
      headcount: 10000,
      items: [
        {
          area: '全省各县（市、区）',
          count: 10000,
          level: 'official',
          register: '6-03 09:00 — 6-09 17:00（2026 报名已结束）',
          exam: '笔试 6-27（2026 已结束）',
          hukou: '不限户籍、不限生源地、不限毕业院校所在地',
          abroad: '非普通高等学历教育的其他国民教育形式毕业生，须取得本科及以上学历并具备相应学位；国（境）外学历须完成留服认证',
          note: '全部纳入乡镇事业编制；最低服务期 5 年（在村工作不少于 2 年），服务期内不得报考事业单位及参加公务员招录。属年度专项：2025 年招 5000、2026 年翻倍至 10000，预计 2027 年继续——留学生重点盯次年公告。南阳 1230 人最多，郑州 650、新乡 900、周口 970、信阳 800、商丘 800，全省 18 地市均有名额',
          sourceUrl: 'http://www.hnrsks.com/sitesources/hnsrskszx/page_pc/zngg/articled17469ed7dad409c806ec013e84b3f79.html',
          sourceName: '河南省人事考试中心 · 2026 年乡村振兴村级协理员专项计划公告',
        },
      ],
    },
    {
      key: 'beijing',
      name: '北京',
      headcount: 467,
      items: [
        {
          area: '全市各区农村',
          count: 467,
          level: 'official',
          register: '4-16 10:00 — 4-21 17:00',
          exam: '笔试 5-16 09:00—11:00（科目《综合能力测试》）',
          hukou: '限北京生源毕业生（2025、2026 年应届 + 2024 年离校未就业北京生源）',
          abroad: '未单独写明国（境）外学历口径',
          note: '北京市统一招聘到农村从事支农工作；属于乡村振兴协理员岗位，但限北京生源',
          sourceUrl: 'https://rsj.beijing.gov.cn/xxgk/tzgg/202604/t20260414_3682416.html',
          sourceName: '北京市人力资源和社会保障局 · 2026 年乡村振兴协理员招聘公告',
        },
      ],
    },
    {
      key: 'guangxi',
      name: '广西',
      headcount: null,
      items: [
        {
          area: '（本次检索未取到 2026 年广西省级乡村振兴协理员专项计划的可引用原文）',
          count: null,
          level: 'thirdparty',
          note: '爱企查等平台称 2026 年广西有乡村振兴村级协理员招聘计划，但未检索到政府门户或人事考试中心的原文链接',
          sourceUrl: null,
          sourceName: null,
        },
      ],
    },
  ],
};

export function ruralCoordinatorSummary() {
  const items = RURAL_COORDINATOR_JOBS.provinces.flatMap((p) => p.items);
  const withCount = items.filter((it) => typeof it.count === 'number');
  const headcount = withCount.reduce((sum, it) => sum + it.count, 0);
  const officialCount = items.filter((it) => it.level === 'official').length;
  return {
    updatedAt: RURAL_COORDINATOR_JOBS.updatedAt,
    year: RURAL_COORDINATOR_JOBS.year,
    provinceCount: RURAL_COORDINATOR_JOBS.provinces.length,
    provincesWithData: RURAL_COORDINATOR_JOBS.provinces.filter((p) => p.headcount > 0).length,
    itemCount: items.length,
    countedItemCount: withCount.length,
    headcount,
    officialCount,
    thirdpartyCount: items.length - officialCount,
    caveat: RURAL_COORDINATOR_JOBS.caveat,
  };
}

export function ruralCoordinatorByProvince() {
  return RURAL_COORDINATOR_JOBS.provinces.map((p) => ({
    key: p.key,
    name: p.name,
    headcount: p.headcount,
    items: p.items,
  }));
}
