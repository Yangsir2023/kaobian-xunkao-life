/**
 * 武汉地区「双盲」考试专项清单。
 *
 * ── 背景 ─────────────────────────────────────────────────────
 * 用户提到「武汉地区还有我不知道的这种双盲考试」——指武汉市事业单位 / 教育系统
 * 事业单位招聘里实行的「双盲」面试机制：考生抽签定面试顺序、考官抽签定执考考场、
 * 考生再随机抽考官组，考前考生与考官无法预知对应关系。对留学生和「没有关系」的
 * 外地考生，这是最友好的考场之一——拼实力、不拼人脉。
 *
 * 本清单收武汉 2026 年两场大规模事业编招聘（均实行双盲面试）：
 *   ① 武汉市 2026 年度事业单位公开招聘 3208 人（报名 2-03 — 2-10，笔试 3-28）
 *   ② 武汉市 2026 年度教育系统事业单位公开招聘 2945 人（报名 7-06 — 7-13，笔试 7-19，全部编制）
 * 两场 2026 均已结束，但「双盲」是武汉事业单位 / 教师招聘的常态机制，2027 继续盯。
 *
 * ── 数据诚实边界 ───────────────────────────────────────────
 *   official    武汉市人事考试院 / 武汉市人民政府门户公告原文
 *   thirdparty  双盲机制描述引自面试技术服务商（诺码信）公开战报，机制属实但非官方条文
 * 户籍口径：两场公告报考条件均只列「中华人民共和国国籍」，未单列户籍限制——
 *   即武汉事业单位 / 教师招聘一般不限户籍，以岗位表为准。
 */
import { RECOMMEND_LEVELS } from './best-recommend.mjs';

export const WUHAN_DB_LEVELS = RECOMMEND_LEVELS.filter((l) => l.key !== 'forecast');
export const WUHAN_DB_LEVEL_KEYS = WUHAN_DB_LEVELS.map((l) => l.key);

export const WUHAN_DOUBLE_BLIND = {
  updatedAt: '2026-10-15',
  year: 2026,
  intro:
    '「双盲」考试指面试环节考生与考官互不知晓对应关系：考生抽签定面试顺序、考官抽签定执考考场、考生再随机抽考官组。武汉事业单位 / 教育系统事业单位招聘全部实行这一机制，对没有本地关系的留学生和外地考生最友好——拼实力、不拼人脉。下面两场是武汉 2026 年规模最大的事业编招聘，均实行双盲面试；2026 虽已结束，但「双盲」是常态机制，2027 继续盯。',
  caveat:
    '覆盖度声明：本清单只收武汉 2026 年两场已结束的事业编招聘（3208 + 2945），用于说明「双盲」机制与武汉事业编的户籍 / 编制口径，不代表武汉只有这两场。武汉事业单位全年滚动、分区发布（如蔡甸 89 人等），教育系统每年暑期一场。户籍口径：两场公告报考条件均只列「中华人民共和国国籍」、未单列户籍限制，即一般不限户籍、以岗位表为准。双盲机制描述引自面试技术服务商（诺码信）公开战报，机制属实；具体以武汉市人事考试院当年公告为准。',
  levels: WUHAN_DB_LEVELS,
  // 双盲机制说明（引自技术服务商公开战报，机制属实）
  doubleBlind: {
    text:
      '「双盲」面试机制：考生抽签确定面试顺序、考官抽签确定执考考场，在此基础上考生再随机抽取考官组；多重随机算法实时运算、即时封存，从机制上保障考官与考生考前无法预知对应关系。备考室由系统自动分配，全程电子叫号，杜绝人工传话与人为干预。武汉 2026 年度事业单位公开招聘面试（5-23—5-31，服务考生 10000 余名）即采用该机制。',
    sourceUrl: 'https://nomax.top/ncms/article_54016e1f6e7cd0b0c0373203831a0539.shtml',
    sourceName: '诺码信科技 · 圆满完成武汉市 2026 年度事业单位公开招聘面试技术服务（双盲机制说明）',
  },
  provinces: [
    {
      key: 'wuhan',
      name: '武汉',
      headcount: 6153,
      items: [
        {
          area: '武汉市 2026 年度事业单位公开招聘（综合 / 卫生 / 等其他类岗位）',
          count: 3208,
          level: 'official',
          register: '2-03 08:00 — 2-10 17:00（2026 报名已结束）',
          exam: '笔试 3-28（2026 已结束）· 面试 5-23—5-31（双盲）',
          hukou: '未明确限制户籍（报考条件仅要求中华人民共和国国籍 + 学历 / 年龄）',
          abroad: '国（境）外学历须完成留服认证；武汉事业单位一般不限院校排名',
          doubleBlind: true,
          note: '全部岗位面试实行「双盲」抽签；结构化面试考察政治素质 / 专业水平 / 表达能力。报名入口武汉市人事考试院官网 www.whptc.org，岗位库可按「事业单位」筛选查看',
          sourceUrl: 'http://www.whptc.org/ncms/article_59f1d5d0d64243ca31bd9e711628875d.shtml',
          sourceName: '武汉市人事考试院 · 武汉市 2026 年度事业单位公开招聘公告',
        },
        {
          area: '武汉市 2026 年度教育系统事业单位公开招聘（中小学 / 幼儿园 / 特教等）',
          count: 2945,
          level: 'official',
          register: '7-06 08:00 — 7-13 12:00（2026 报名已结束）',
          exam: '笔试 7-19（2026 已结束）· 教师类面试 8-15—8-17（双盲）',
          hukou: '未明确限制户籍（报考条件仅要求中华人民共和国国籍 + 学历 / 年龄）',
          abroad: '国（境）外学历须完成留服认证；今年明确「不卡海外留学生院校排名」',
          doubleBlind: true,
          note: '全部为财政全额拨款事业编制；教师类岗位面试同样实行「双盲」抽签。今年报考门槛大松绑：年龄放宽至 38 岁（中级 / 博士 43、副高 48）、专业 / 学历 / 教资大幅放宽、非全日制可报、先考试后取证。整合东湖高新区 513、东西湖 350 等全部行政区',
          sourceUrl: 'https://www.wuhan.gov.cn/zwgk/tzgg/202607/t20260704_2816793.shtml',
          sourceName: '武汉市人民政府门户 · 武汉市 2026 年度教育系统事业单位公开招聘公告',
        },
      ],
    },
  ],
};

export function wuhanDoubleBlindSummary() {
  const provinces = WUHAN_DOUBLE_BLIND.provinces;
  const items = provinces.flatMap((p) => p.items);
  const withCount = items.filter((it) => typeof it.count === 'number');
  const headcount = withCount.reduce((sum, it) => sum + it.count, 0);
  const officialCount = items.filter((it) => it.level === 'official').length;
  const abroadItems = items.filter((it) => it.abroad);
  return {
    updatedAt: WUHAN_DOUBLE_BLIND.updatedAt,
    year: WUHAN_DOUBLE_BLIND.year,
    provinceCount: provinces.length,
    provincesWithData: provinces.filter((p) => p.items.some((it) => typeof it.count === 'number')).length,
    itemCount: items.length,
    countedItemCount: withCount.length,
    headcount,
    officialCount,
    thirdpartyCount: items.length - officialCount,
    abroadCount: abroadItems.length,
    levelKeys: WUHAN_DB_LEVEL_KEYS,
    caveat: WUHAN_DOUBLE_BLIND.caveat,
  };
}

/** 导出给接口用的省份清单（每条都带来源）。 */
export function wuhanDoubleBlindByProvince() {
  return WUHAN_DOUBLE_BLIND.provinces.map((p) => ({
    key: p.key,
    name: p.name,
    headcount: p.items.reduce((s, it) => s + (typeof it.count === 'number' ? it.count : 0), 0),
    items: p.items,
  }));
}
