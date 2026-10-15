/**
 * 2026 年全国网格员招聘公告清单（不限户籍 / 低门槛视角）。
 *
 * ── 为什么有这个文件 ─────────────────────────────────────────
 * 网格员是基层治理里招聘最碎、门槛最低的一类：几乎全是县 / 街道 / 社区
 * 自己发公告，临聘为主、很少带编。对留学生和外地考生来说它的最大卖点是
 * 「基本不卡户籍」——多数公告只要求中华人民共和国国籍 + 大专 / 高中，
 * 不像公务员 / 事业编那样层层设限。但它也是「合同工」，待遇与稳定性天差地别。
 * 这份清单把检索到的、能拿到来源链接的网格员公告收下来，逐条标户籍口径与编制属性，
 * 让人一眼看清「哪个能报、是不是坑」。
 *
 * ── 数据诚实边界（务必先读）────────────────────────────────────
 * 与 server/community-jobs.mjs 同一套级别语言：
 *   official    政府门户 / 人社局 / 街道公告原文链接
 *   thirdparty  第三方机构（中公）转政府公告的汇总页
 *
 * 收录纪律：
 *   1. 每条必须有 sourceUrl（测试强制校验）；
 *   2. 网格员没有全国统一考试，全是县 / 街道级单招，公告全年滚动发布；
 *   3. 户籍口径逐条标：明确写了「不限户籍」才标不限；只写「国籍」的标「未明确限制」，
 *      不推断、不统一口径；
 *   4. 编制属性逐条标：政府公告写「编外 / 临聘」的就是临聘，不把第三方「有编制」标注当真。
 */
import { RECOMMEND_LEVELS } from './best-recommend.mjs';

export const GRID_JOB_LEVELS = RECOMMEND_LEVELS.filter((l) => l.key !== 'forecast');
export const GRID_JOB_LEVEL_KEYS = GRID_JOB_LEVELS.map((l) => l.key);

export const GRID_WORKER_JOBS = {
  updatedAt: '2026-10-15',
  year: 2026,
  intro:
    '网格员是基层治理里招聘最碎、门槛最低的一类：几乎全是县 / 街道 / 社区自己发公告，临聘为主、很少带编。它对外地考生和留学生的最大卖点是「基本不卡户籍」——多数公告只要求中华人民共和国国籍 + 大专 / 高中。但它是合同工，待遇与稳定性远不如公务员 / 事业编。清单只收能拿到来源链接的公告，逐条标户籍口径与编制属性。',
  caveat:
    '覆盖度声明：网格员没有全国统一考试，全是县 / 街道 / 社区级单招，公告全年滚动发布、散落在四级官网。这份清单不是全国穷举，只收「检索到的、能拿到来源链接的」4 个省份 / 地区。绝大多数网格员岗位是临聘（无事业编制），薪资多在当地最低工资线上方；报名前以当年街道 / 社区公告原文为准，别把第三方「有编制」标注当真。',
  levels: GRID_JOB_LEVELS,
  provinces: [
    {
      key: 'xinjiang',
      name: '新疆 · 第一师阿拉尔市',
      headcount: 165,
      items: [
        {
          area: '阿拉尔市编外人员招聘（含专职网格员多个岗位）',
          count: 165,
          level: 'thirdparty',
          register: '7-03 — 7-10（2026 报名已结束）',
          exam: '笔试 / 面试另行通知',
          hukou: '不限户籍（中公职位页标注「不限户籍」；官方原公告为编外人员招聘）',
          abroad: '国（境）外学历须完成留服认证，专科及以上可报',
          note: '编外聘用（非事业编制），直接签订劳动合同；专职网格员岗大专及以上、年龄 35 周岁以下、专业不限。来源为中公转载第一师阿拉尔市人民政府公告，报名邮箱 / 线下地址见原公告',
          sourceUrl: 'https://zw.admin.offcn.com/zwcx/zw/26070562512.html',
          sourceName: '中公教育 · 2026 新疆第一师阿拉尔市编外人员招聘 165 人公告（转第一师阿拉尔市人民政府）',
        },
      ],
    },
    {
      key: 'xizang',
      name: '西藏 · 拉萨柳梧新区',
      headcount: 61,
      items: [
        {
          area: '热玛岗街道社区专职网格员 52 名 + 基层公共服务人员 9 名',
          count: 61,
          level: 'official',
          register: '2026 年公告（具体网报时间见附件，须于 2026-06-29 前取得学历学位）',
          exam: '笔试 + 面试（按岗位表）',
          hukou: '未明确限制户籍（报考条件仅要求中华人民共和国国籍 + 学历 / 年龄）',
          abroad: '国（境）外学历须为教育部留学服务中心认证学历',
          note: '拉萨高新区（柳梧新区）热玛岗街道公开招录；社区专职网格员为重点招录对象（应届 / 往届高校毕业生、退役军人、有基层经历者）。临聘性质，入职不统一提供宿舍',
          sourceUrl: 'https://lwxq.lasa.gov.cn/lwxqgwh/jycy/202606/15a2d6d6b4ad45b19a33466b11e61f56.shtml',
          sourceName: '拉萨国家高新区 · 热玛岗街道 2026 年公开招录社区专职网格员及基层公共服务人员公告',
        },
      ],
    },
    {
      key: 'chongqing',
      name: '重庆 · 城口县',
      headcount: 8,
      items: [
        {
          area: '葛城街道 / 复兴街道专职网格员',
          count: 8,
          level: 'official',
          register: '8-24 — 8-26（线下报名，2026 已结束）',
          exam: '笔试 + 面试',
          hukou: '未明确限制户籍（条件仅要求国籍 + 国家承认大专及以上学历）',
          abroad: '国（境）外学历须为教育部留学服务中心认证学历',
          note: '城口县按《专职网格员管理办法》临聘 8 名，无事业编制；主要从事网格管理和服务，综合成绩从高到低选岗。薪资按当地临聘标准执行',
          sourceUrl: 'https://www.cqck.gov.cn/jz/gcjd/jzdt/202608/t20260821_15962504.html',
          sourceName: '城口县人民政府 · 葛城街道 / 复兴街道 2026 年公开招聘专职网格员公告',
        },
      ],
    },
    {
      key: 'guangdong',
      name: '广东 · 连南瑶族自治县',
      headcount: 4,
      items: [
        {
          area: '三江镇镇级专职网格管理员 1 名 + 村级专职网格员 3 名',
          count: 4,
          level: 'official',
          register: '公告 9-30（2026，具体报名时间见公告）',
          exam: '按本公告程序选聘',
          hukou: '未严格限制户籍；优先从本网格内符合条件的人员中选聘，本网格无合适人选则就近从周边网格选聘',
          abroad: '国（境）外学历须为教育部留学服务中心认证学历',
          note: '连南瑶族自治县三江镇人民政府临聘 4 名，高中 / 中专及以上、年龄 18—45 周岁；不列入单位编制序列，参照网格员初聘薪酬 2540 元 / 月（含绩效），每年签一次合同',
          sourceUrl: 'https://www.liannan.gov.cn/qylnsj/gkmlpt/content/2/2195/post_2195588.html',
          sourceName: '连南瑶族自治县人民政府 · 三江镇公开招聘专职网格管理员、网格员公告',
        },
      ],
    },
  ],
};

export function gridWorkerSummary() {
  const provinces = GRID_WORKER_JOBS.provinces;
  const items = provinces.flatMap((p) => p.items);
  const withCount = items.filter((it) => typeof it.count === 'number');
  const headcount = withCount.reduce((sum, it) => sum + it.count, 0);
  const officialCount = items.filter((it) => it.level === 'official').length;
  const abroadItems = items.filter((it) => it.abroad);
  return {
    updatedAt: GRID_WORKER_JOBS.updatedAt,
    year: GRID_WORKER_JOBS.year,
    provinceCount: provinces.length,
    provincesWithData: provinces.filter((p) => p.items.some((it) => typeof it.count === 'number')).length,
    itemCount: items.length,
    countedItemCount: withCount.length,
    headcount,
    officialCount,
    thirdpartyCount: items.length - officialCount,
    abroadCount: abroadItems.length,
    levelKeys: GRID_JOB_LEVEL_KEYS,
    caveat: GRID_WORKER_JOBS.caveat,
  };
}

/** 导出给接口用的省份清单（每条都带来源）。 */
export function gridWorkerByProvince() {
  return GRID_WORKER_JOBS.provinces.map((p) => ({
    key: p.key,
    name: p.name,
    headcount: p.items.reduce((s, it) => s + (typeof it.count === 'number' ? it.count : 0), 0),
    items: p.items,
  }));
}
