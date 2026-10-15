/**
 * 分类详情页数据层：每个招考类别（节点）一页，回答五个问题——
 *   ① 今年什么状态？（公告已发 / 报名中 / 已结束）
 *   ② 往年什么时候发、什么时候考？（历年公告归档）
 *   ③ 明年大概什么时候？（按历年规律推算，标 forecast）
 *   ④ 外地考生能不能报？（户籍口径，没核到原文就不写）
 *   ⑤ 有哪些岗位、去哪看？（深链到岗位库对应考试类型）
 *
 * ── 数据诚实边界（务必先读）────────────────────────────────────
 * 本文件不生产新事实，只做「聚合 + 投影」：所有内容都来自以下已核验模块，
 * 每条沿用原模块的 level（official / thirdparty / forecast）与来源链接：
 *   server/announcement-archive.mjs   历年公告（official / thirdparty）
 *   server/hukou-guide.mjs            户籍口径（official 原文引用）
 *   server/cold-exams.mjs             冷门统考（official / thirdparty）
 *   server/best-recommend.mjs         今年国考事实 / 省考与其他考试预测
 *   server/position-catalog.mjs       人才引进 QS 前 200 真实公告
 * 没核到原文的类别（如省考户籍、选调生户籍、人才引进户籍）显式写「未核实」，
 * 不猜、不用「往年同期」补齐——与 hukou-guide.mjs 同一条纪律。
 */
import { getCategory, getExamInfo } from './catalog.mjs';
import { ANNOUNCEMENT_ARCHIVE } from './announcement-archive.mjs';
import { HUKOU_GUIDE, HUKOU_LEVEL_MAP } from './hukou-guide.mjs';
import { COLD_EXAMS } from './cold-exams.mjs';
import { OTHER_EXAM_TIMELINE, SHENGKAO_OUTLOOK, GUOKAO_2027_FACTS, GUOKAO_AVOID } from './best-recommend.mjs';
import { RENCAI_QS200_GUIDE } from './position-catalog.mjs';

export const CATEGORY_DETAIL_UPDATED_AT = '2026-10-15';

/* ───────────────── 取数助手 ───────────────── */

function findHukouItem(examType) {
  if (!examType) return null;
  return HUKOU_GUIDE.items.find((i) => i.examType === examType) || null;
}

function shapeHukou(item) {
  if (!item) return null;
  const level = HUKOU_LEVEL_MAP.get(item.level) || null;
  return {
    level: item.level,
    levelName: level?.name || item.level,
    levelShort: level?.short || item.level,
    name: item.name,
    scale: item.scale,
    window: item.window,
    why: item.why,
    quote: item.quote,
    caution: item.caution,
    stats: item.stats || [],
    sourceUrl: item.sourceUrl,
    sourceName: item.sourceName,
  };
}

function findArchiveItems(groupKey) {
  const group = ANNOUNCEMENT_ARCHIVE.groups.find((g) => g.key === groupKey);
  if (!group) return [];
  return (group.items || []).map((it) => ({
    year: it.year,
    title: it.title,
    level: it.level,
    publishDate: it.publishDate,
    scale: it.scale,
    sourceUrl: it.sourceUrl,
    sourceName: it.sourceName,
  }));
}

function findTimeline(keywords) {
  return OTHER_EXAM_TIMELINE.filter((t) => keywords.some((k) => t.name.includes(k)));
}

function timelineToBlock(entries, headline) {
  if (!entries.length) return null;
  const src = entries[0];
  return {
    level: entries.every((e) => e.level === 'official') ? 'official' : 'forecast',
    headline,
    text: entries
      .map((e) => `${e.name}\n公告：${e.announce}\n报名：${e.register}\n考试：${e.exam}\n${e.note}`)
      .join('\n\n'),
    sourceUrl: src.sourceUrl || null,
    sourceName: src.sourceName || null,
  };
}

function findColdItem(examType) {
  for (const g of COLD_EXAMS.groups) {
    const item = (g.items || []).find((i) => i.examType === examType);
    if (item) return { group: g, item };
  }
  return null;
}

/** 冷门统考条目 → 今年动态（报名窗口 / 户籍口径 / 公告原文三块） */
function coldItemToThisYear(cold, headline) {
  if (!cold) return null;
  const { item } = cold;
  return {
    level: item.level,
    headline,
    points: [
      { label: '招录规模', value: item.scale, level: item.level },
      { label: '报名窗口', value: item.window, level: item.level },
      { label: '公告原文', value: item.quote, level: item.level },
    ],
    sourceUrl: item.sourceUrl,
    sourceName: item.sourceName,
  };
}

function factsToPoints(facts, limit = 10) {
  return (facts || []).slice(0, limit).map((f) => ({ label: f.label, value: f.value, level: f.level }));
}

/* ───────────────── 各分类配置 ───────────────── */

const GUIDES = {
  /* ═══════════ 国考 ═══════════ */
  guokao: {
    examTypes: ['guokao'],
    archiveGroup: 'guokao',
    hukouExamType: 'guokao',
    summary: { level: 'official', headline: '2027 年度公告已发布（2026-10-13），报名 10-15 08:00 至 10-24 18:00' },
    thisYear: {
      level: 'official',
      headline: GUOKAO_2027_FACTS.headline,
      points: factsToPoints(GUOKAO_2027_FACTS.facts, 12),
      sourceUrl: GUOKAO_2027_FACTS.sourceUrl,
      sourceName: GUOKAO_2027_FACTS.sourceName,
    },
    forecast: {
      level: 'forecast',
      headline: '2028 年度节奏推演：公告 10 月中旬、报名 10-15 至 10-24、笔试 11 月底',
      text:
        '过去三年报名窗口一字不差（都是 10-15 08:00 至 10-24 18:00），笔试逐年提前约 1 天（2025 年度 12-01 → 2026 年度 11-30 → 2027 年度 11-29）。按此规律，2028 年度笔试预计落在 11 月底；2027 年度新增的「注册认证」环节预计保留。这是按历年规律的推算，不是官方承诺，最终以当年公告为准。',
      sourceUrl: 'https://edu.people.com.cn/n1/2026/1013/c1006-40813765.html',
      sourceName: '人民网 · 2027 年度国考公告要点（2026-10-13）',
    },
    notes: GUOKAO_AVOID.map((a) => ({ text: `避开：${a.name}——${a.reason}`, sourceUrl: a.sourceUrl, sourceName: a.sourceName })),
  },

  /* ═══════════ 省考 ═══════════ */
  shengkao: {
    examTypes: ['shengkao'],
    archiveGroup: 'shengkao',
    hukouExamType: null,
    summary: {
      level: 'official',
      headline: '2026 年度笔试已结束；下一场是 2026 年 12 月自主命题省份省考与 2027 年 3 月多省联考',
    },
    thisYear: {
      level: 'official',
      headline: '湖北省 2026 年度省市县乡考试录用公务员公告（2026-01-12 发布）：招录 8027 人，县乡机关 7312 人约占 91%',
      points: [
        { label: '网上报名', value: '2026-01-13 09:00 — 01-19 17:00', level: 'official' },
        { label: '缴费确认', value: '2026-01-23 09:00 — 01-27 17:00', level: 'official' },
        { label: '公共科目笔试', value: '2026-03-14（行测 09:00—11:00 / 申论 14:00—16:30）', level: 'official' },
        { label: '取消规则', value: '缴费确认人数不足 3 人的职位取消招录计划（取消职位表 01-30 单独公布）', level: 'official' },
        { label: '年龄口径', value: '放宽到 38 周岁（应届硕博 43 周岁），比往年放宽 3 岁', level: 'official' },
      ],
      sourceUrl:
        'https://rst.hubei.gov.cn/hbrsksw/zlplks/jglyks/hbsgwyks/zytz/202601/t20260112_5853392.shtml',
      sourceName: '湖北省人社厅 · 湖北省 2026 年度省市县乡考试录用公务员报名即将开始',
    },
    forecast: {
      level: 'forecast',
      headline: SHENGKAO_OUTLOOK.title,
      text: `${SHENGKAO_OUTLOOK.lines[0].name}\n省份：${SHENGKAO_OUTLOOK.lines[0].provinces}\n公告：${SHENGKAO_OUTLOOK.lines[0].announce}\n笔试：${SHENGKAO_OUTLOOK.lines[0].exam}\n\n${SHENGKAO_OUTLOOK.lines[1].name}\n省份：${SHENGKAO_OUTLOOK.lines[1].provinces}\n公告：${SHENGKAO_OUTLOOK.lines[1].announce}\n报名：${SHENGKAO_OUTLOOK.lines[1].register}\n笔试：${SHENGKAO_OUTLOOK.lines[1].exam}\n\n联考省份同一天笔试、报名系统各自独立——每人只能选一个省份报考，这是最需要提前定夺的一件事。`,
      sourceUrl: 'https://www.gwy.com/dfgwy/413604.html',
      sourceName: '上岸鸭公考 · 2027 年省考时间安排（按历年规律推算）',
    },
    hukouNote:
      '省考不少岗位限本省户籍 / 生源 / 常住人口，国考基本没有这条——「哪些省我能报」要先用户籍筛一遍，再谈推荐。本次未逐省核到户籍条款原文：没出现在「外地可考」清单里，既不等于限户籍，也不等于不限户籍，报名前以当年本省公告为准。',
    notes: [
      { text: SHENGKAO_OUTLOOK.caveats[0], sourceUrl: null, sourceName: null },
      { text: SHENGKAO_OUTLOOK.caveats[2], sourceUrl: null, sourceName: null },
    ],
  },

  /* ═══════════ 事业编 ═══════════ */
  shiye: {
    examTypes: ['shiye'],
    archiveGroup: 'shiye',
    hukouExamType: null,
    summary: {
      level: 'official',
      headline: '2026 年度湖北事业单位统考笔试已结束（3-28 / 3-29）；下一场全国联考预计 2027 年 5 月',
    },
    thisYear: {
      level: 'official',
      headline: '湖北省省直事业单位 2026 年统一公开招聘（2026-02-02 发布）：全省联考 10976 人，分 A / B / C / D / E 五类设考',
      points: [
        { label: '网上报名', value: '2026-02-03 08:00 — 02-10 17:00', level: 'official' },
        { label: '缴费确认', value: '2026-02-03 08:00 — 02-12 17:00', level: 'official' },
        { label: '笔试', value: '2026-03-28（A 类）/ 03-29（B、C、D、E 类）', level: 'official' },
        {
          label: '开考比例',
          value: '写在岗位表里而非公告里：「原则上按岗位计划数和报名人数不低于《岗位表》规定的面试入围比例开考」——必须逐岗查岗位表',
          level: 'official',
        },
      ],
      sourceUrl: 'https://rst.hubei.gov.cn/bmdt/ztzl/ywzl/hbsszsydwgkzp/zpgg/202602/t20260202_5867947.shtml',
      sourceName: '湖北省人社厅 · 湖北省省直事业单位 2026 年统一公开招聘公告',
    },
    forecast: timelineToBlock(
      findTimeline(['事业单位']),
      '2027 年三条线：全国联考上半年 / 下半年 + 省内单招全年分散（按历年规律推算）'
    ),
    hukouNote:
      '事业单位户籍口径本次未逐省核到原文——没出现在「外地可考」清单里，既不等于限户籍，也不等于不限户籍；部分单招岗位限本区户籍或居住证，报名前以当年公告为准。',
    notes: [
      {
        text: '部分省份（如河南）是省内自主联考，不参加全国 ABCD E 类联考，别按全国联考时间等。',
        sourceUrl: null,
        sourceName: null,
      },
    ],
  },

  /* ═══════════ 社区工作者 ═══════════ */
  shequ: {
    examTypes: ['shequ'],
    archiveGroup: null,
    hukouExamType: 'shequ',
    summary: {
      level: 'official',
      headline: '2026 年上海多区先后招录（1 月 / 6 月 / 8 月）；多地集中在 9 月发布',
    },
    thisYear: {
      level: 'official',
      headline: '上海 2026 年多区社区工作者公开招聘：黄浦 / 虹口 / 杨浦都给应届毕业生开了「户籍不限」的口子',
      points: [
        { label: '黄浦区', value: '本市户籍；外省市户籍应届毕业生；外省市非应届须持本市居住证一年及以上（截止 2026-12-31）', level: 'official' },
        { label: '虹口区', value: '非应届毕业生需本市户籍或居住证一年以上；应届毕业生户籍不限', level: 'official' },
        { label: '杨浦区', value: '本市户籍或居住证三年以上；本市应届高校毕业生不受居住证限制', level: 'official' },
        { label: '普陀区', value: '本市常住户籍或居住证一年以上且积分达 120 分（往届外地考生基本报不了）', level: 'official' },
      ],
      sourceUrl: 'https://www.shanghai.gov.cn/nw17239/20260106/b95fcdf502fb4d109596299ae0b1be15.html',
      sourceName: '上海市人民政府 · 2026 年普陀区社区工作者公开招聘公告',
    },
    forecast: timelineToBlock(findTimeline(['社区工作者']), '多地集中在 9 月发布公告，9—10 月报名与笔试（按历年规律推算）'),
    notes: [
      { text: '各区口径差异极大：同一「社区工作者」，黄浦应届不限、普陀要 120 积分、徐汇要居住证三年——必须逐区读公告。', sourceUrl: null, sourceName: null },
    ],
  },

  /* ═══════════ 湖北选调 ═══════════ */
  'hubei-xuandiao': {
    examTypes: ['xuandiao'],
    archiveGroup: null,
    hukouExamType: null,
    summary: {
      level: 'official',
      headline: '2027 年度选调生已陆续发布（甘肃 600 人、安徽定向）；湖北选调预计 12 月—次年 1 月发公告',
    },
    thisYear: timelineToBlock(
      findTimeline(['选调生']),
      '2027 年度选调生：甘肃（报名中）与安徽定向（报名中）已发布——但均限国内高校应届，留学生通常不符合'
    ),
    forecast: {
      level: 'forecast',
      headline: '湖北选调预计 2026 年 12 月—2027 年 1 月发布公告、3 月前后笔试（按历年规律推算）',
      text:
        '湖北选调面向应届毕业生，通常 12 月至次年 1 月发布公告、3 月前后笔试（本应用分类目录的典型月份口径）。选调生普遍要求国内高校应届 + 党员 / 学生干部 / 院校层次，留学生通常不符合——先核对高校范围再投入备考。这是按历年规律的推算，以当年公告为准。',
      sourceUrl: 'https://www.hbzzb.gov.cn',
      sourceName: '中共湖北省委组织部 · 选调生招录公告（官网入口）',
    },
    hukouNote:
      '选调生户籍口径本次未核到明确原文——没出现在「外地可考」清单里，既不等于限户籍，也不等于不限户籍，报名前以当年公告为准。',
    notes: [
      { text: '选调生户籍口径本次未核到明确原文——没出现在「外地可考」清单里，既不等于限户籍，也不等于不限户籍。', sourceUrl: null, sourceName: null },
      { text: '安徽定向笔试不设最低开考比例、不核减选调计划；须先经院系党组织与学校就业部门推荐盖章。', sourceUrl: 'http://www.apta.gov.cn/Officer/ExamDetail?examid=434', sourceName: '安徽省人事考试网 · 安徽省 2027 年度定向招录选调生公告' },
    ],
  },

  /* ═══════════ 军队文职 ═══════════ */
  jundui: {
    examTypes: ['jundui'],
    archiveGroup: 'jundui',
    hukouExamType: null,
    summary: {
      level: 'official',
      headline: '2027 年度先面试后笔试岗位报名已收尾（最晚 10-25）；全军统考预计 10 月底—11 月上旬发公告',
    },
    thisYear: timelineToBlock(
      findTimeline(['军队文职']).filter((e) => e.level === 'official'),
      '2027 年度军队文职：先面试后笔试岗位（7 家单位）已发布，报名最晚 10-25 18:00'
    ),
    forecast: timelineToBlock(
      findTimeline(['军队文职']).filter((e) => e.level !== 'official'),
      '全军统考（管理岗 / 专业技术岗）预计 10 月底—11 月上旬发公告、12 月中旬笔试（按历年规律推算）'
    ),
    hukouNote:
      '军队文职户籍口径本次未核到明确原文——没出现在「外地可考」清单里，既不等于限户籍，也不等于不限户籍，报名前以当年公告为准。',
    notes: [
      { text: '唯一官方入口是军队人才网 81rc.81.cn——所有第三方「内部报名链接」「代报锁岗」均为仿冒。', sourceUrl: 'http://81rc.81.cn', sourceName: '军队人才网' },
      { text: '留学归国人员须在 2026-07-31 前取得学历学位认证（2026 年度口径，2027 年度以当年公告为准）。', sourceUrl: 'https://81rc.81.cn/wzry/gzdt/16419320.html', sourceName: '军队人才网 · 2026 年军队文职人员公开招考工作全面展开' },
      { text: '军队文职户籍口径本次未核到明确原文——没出现在「外地可考」清单里，既不等于限户籍，也不等于不限户籍。', sourceUrl: null, sourceName: null },
    ],
  },

  /* ═══════════ 三支一扶 ═══════════ */
  sanzhiyifu: {
    examTypes: ['sanzhiyifu'],
    archiveGroup: 'sanzhiyifu',
    hukouExamType: 'sanzhiyifu',
    summary: {
      level: 'official',
      headline: '2026 年度湖北已招录 2000 名（笔试 5-23 已结束）；下一场看 2027 年各省 5—7 月公告',
    },
    thisYear: {
      level: 'official',
      headline: '湖北省 2026 年度「三支一扶」：招募 2000 名，笔试 5-23《综合能力测试》满分 100',
      points: [
        { label: '公告发布', value: '2026-04-16 · 湖北省人社厅', level: 'official' },
        { label: '提交报考与加分申请', value: '4-18 10:00 — 4-24 17:00', level: 'official' },
        { label: '资格初审', value: '4-18 — 4-25', level: 'official' },
        { label: '打印准考证', value: '5-19 10:00 — 5-23 09:30', level: 'official' },
        { label: '笔试', value: '5-23 09:00 — 11:00《综合能力测试》满分 100', level: 'official' },
        { label: '成绩公布', value: '2026 年 6 月初', level: 'official' },
        { label: '公示与到岗', value: '7 月中下旬公示，7 月底前到岗', level: 'official' },
      ],
      sourceUrl: 'http://rst.hubei.gov.cn/bmdt/ztzl/ywzl/hbsrlzyscgl/szyf/',
      sourceName: '湖北省人社厅 · 三支一扶专栏（官方发布平台）',
    },
    forecast: timelineToBlock(findTimeline(['三支一扶']), '各省公告大多 5—7 月发布、笔试多在 6—8 月（按历年规律推算）'),
    notes: [
      { text: '湖北口径：公告基本条件只列国籍、政治素质、学历与年龄，没有把户籍列为报考条件；国（境）外高校毕业生出具留服认证即可报。其他省份各自出题、各自定条件，部分限本省户籍或生源——不要把湖北的结论外推到全国。', sourceUrl: null, sourceName: null },
      { text: '服务期 2 年，期满可转事业编、享公务员定向招录岗与考研加分；大专可报、多数省份不收报名费。', sourceUrl: null, sourceName: null },
    ],
  },

  /* ═══════════ 人才引进 ═══════════ */
  rencai: {
    examTypes: ['rencai'],
    archiveGroup: null,
    hukouExamType: null,
    summary: {
      level: 'official',
      headline: '全年滚动：定西第二批报名正在进行（10-13 08:30 至 10-27 18:00），306 个岗位 360 人',
    },
    thisYear: {
      level: 'official',
      headline: RENCAI_QS200_GUIDE.title,
      points: RENCAI_QS200_GUIDE.regions.map((r) => ({
        label: r.region,
        value: `${r.scope}｜${r.window}｜${r.feature}`,
        level: 'official',
      })),
      sourceUrl: RENCAI_QS200_GUIDE.regions[0]?.sourceUrl || null,
      sourceName: RENCAI_QS200_GUIDE.regions[0]?.sourceName || null,
    },
    guides: [
      {
        title: RENCAI_QS200_GUIDE.title,
        note: RENCAI_QS200_GUIDE.note,
        regions: RENCAI_QS200_GUIDE.regions,
        tips: RENCAI_QS200_GUIDE.tips,
      },
    ],
    forecast: timelineToBlock(
      findTimeline(['人才引进']),
      '春秋两季为主：公告集中在 1—5 月与 11 月，多数免笔试直接面试（按历年规律推算）'
    ),
    hukouNote:
      '人才引进的户籍口径本次未核到明确原文——没出现在「外地可考」清单里，既不等于限户籍，也不等于不限户籍。已核对的公告条件集中在「国（境）外 QS 前 200/500 硕士 + 年龄 + 留服认证时限」，报名前以当年公告为准。',
    notes: [
      { text: '人才引进的户籍口径本次未核到明确原文——没出现在「外地可考」清单里，既不等于限户籍，也不等于不限户籍。', sourceUrl: null, sourceName: null },
      ...RENCAI_QS200_GUIDE.tips.map((t) => ({ text: t, sourceUrl: null, sourceName: null })),
    ],
  },

  /* ═══════════ 西部计划 ═══════════ */
  xibu: {
    examTypes: ['xibu'],
    archiveGroup: null,
    hukouExamType: 'xibu',
    summary: { level: 'official', headline: '2026 年度报名已结束（3-01 至 5-10）；2027 年度预计 3—5 月' },
    thisYear: {
      level: 'official',
      headline: '2026 年度西部计划：全国预计新招募约 6 万人、赴 27 个省（区、市）与新疆兵团，报名已结束',
      points: [
        { label: '招募规模', value: '2026 年全国预计新招募约 6 万人，赴 27 个省（区、市）和新疆生产建设兵团', level: 'official' },
        { label: '报名窗口', value: '2026-03-01 至 05-10（已结束），通过本人所在高校项目办报名', level: 'official' },
        { label: '报名资格', value: '应届毕业生（2026 年毕业的专科生 / 本科生 / 研究生）或在读研究生，不看户籍', level: 'official' },
        { label: '选拔与到岗', value: '高校项目办审核通过即报名成功；各招募省组织笔试 / 面试 / 心理测试与体检，7 月底前到岗', level: 'official' },
      ],
      sourceUrl: 'https://xibu.youth.cn/gzdt/gddt/202603/t20260302_16534621.htm',
      sourceName: '西部计划官网 · 2026 年大学生志愿服务西部计划报名开启',
    },
    forecast: timelineToBlock(findTimeline(['西部计划']), '预计 2027 年 3—5 月报名、5—6 月选拔（按历年规律推算）'),
    notes: [
      { text: '不是编制，是志愿服务项目；须经所在院系团委与学校项目办审核，服务岗位原则上不得跨省调整。服务地多为乡镇及以下（90% 以上岗位）。', sourceUrl: null, sourceName: null },
      { text: '服务期 1—3 年，计入基层工作经历（国考报考指南第 8 条明确列举「大学生志愿服务西部计划」），期满在升学、就业上有政策支持。', sourceUrl: null, sourceName: null },
    ],
  },

  /* ═══════════ 留服认证 ═══════════ */
  liufu: {
    examTypes: [],
    archiveGroup: null,
    hukouExamType: null,
    summary: {
      level: 'official',
      headline: '认证申请常年开放，需预留 10—20 个工作日；报考前按各公告时限倒排',
    },
    thisYear: {
      level: 'official',
      headline: '各公告对留服认证的时限要求（摘自已核验公告原文）',
      points: [
        { label: '中国烟草（内蒙古 2026）', value: '2026-10-31 前取得教育部留学服务中心学历学位认证', level: 'official' },
        { label: '国家电网（2026 一批）', value: '2026-08-31 前取得留服认证（无认证直接取消录用资格）', level: 'thirdparty' },
        { label: '军队文职（2026 年度）', value: '留学归国人员须在 2026-07-31 前取得学历学位认证', level: 'official' },
        { label: '温州人才引进（2026）', value: '境外学历须 2027-01-31 前取得留服认证书', level: 'official' },
        { label: '监利人才引进（2026）', value: '境外毕业生须 2026-08-01 前取得留服认证书', level: 'official' },
      ],
      sourceUrl: 'https://zwfw.cscse.edu.cn',
      sourceName: '教育部留学服务中心 · 国（境）外学历学位认证系统',
    },
    notes: [
      { text: '留服认证不是考试，是报考资格的前置条件——认证时长（10—20 个工作日）必须倒排进每一个报考节点的倒计时里。', sourceUrl: null, sourceName: null },
      { text: '海外学历报考公务员 / 事业单位：各省认定口径不同，多数要求报名前或面试前完成认证；专业名对不上国内目录时，需按省公告走专业复核流程。', sourceUrl: null, sourceName: null },
    ],
  },

  /* ═══════════ 村官 / 协理员 ═══════════ */
  cunban: {
    examTypes: ['cunban'],
    archiveGroup: null,
    hukouExamType: 'cunban',
    summary: {
      level: 'official',
      headline: '2026 年度河南协理员已招录 10000 名（报名 6-03 至 06-09 已结束）；县乡自招全年分散',
    },
    thisYear: {
      level: 'official',
      headline: '河南省 2026 年乡村振兴村级协理员专项计划：10000 名全部纳入乡镇事业编制，报考指南逐字写明不限户籍',
      points: [
        { label: '招录规模', value: '2026 年计划招聘 10000 名，全部纳入乡镇事业编制', level: 'official' },
        { label: '报名窗口', value: '2026-06-03 09:00 — 06-09 17:00（河南省人事考试中心网站）', level: 'official' },
        { label: '报考条件', value: '本科及以上学历并具备相应学位、年龄不超过 38 周岁（1987-06-01 及以后出生）、2024/2025/2026 届毕业生', level: 'official' },
        { label: '公告原文', value: '本次招聘不限制户籍、生源地和毕业院校所在地。', level: 'official' },
      ],
      sourceUrl: 'http://www.hnrsks.com/sitesources/hnsrskszx/page_pc/zngg/articled17469ed7dad409c806ec013e84b3f79.html',
      sourceName: '河南省人事考试中心 · 2026 年乡村振兴村级协理员专项计划公告',
    },
    forecast: {
      level: 'forecast',
      headline: '县乡自招的村级后备干部全年分散，多集中在 4—8 月（按已收录公告口径）',
      text:
        '「村官」这个名头 2026 年主要活在两类地方：一是河南这样的省级专项（万名带编，2026-06 已结束），二是县乡自己招的村级后备干部（各地分散，多集中在 4—8 月，没有全国统一规模，由县（市、区）组织部 / 人社局自行组织）。后者竞争小、离家近，但必须逐公告核对户籍与待遇。',
      sourceUrl: 'https://hu.offcn.com/html/2026/05/301941.html',
      sourceName: '荆州人事考试网 · 2026 年荆州市江陵县定向招聘大学生村级后备干部公告（中公教育转载）',
    },
    notes: [
      { text: '乡镇最低服务期限 5 年（在村工作不少于 2 年），服务期内不得报考事业单位及参加公务员招录——把它当成「上岸」而不是「跳板」。', sourceUrl: null, sourceName: null },
      { text: '县乡自招写法反直觉：江陵县是「应届生须本县户籍、非应届户籍不限」；铅山县与婺源县许村镇要求本人或父母本地户籍 / 房产或居住满一年。待遇与编制天差地别（许村镇月薪 3000 元且无编）。必须逐公告核对。', sourceUrl: null, sourceName: null },
    ],
  },

  /* ═══════════ 冷门统考五类 ═══════════ */
  zhuanli: {
    examTypes: ['zhuanli'],
    archiveGroup: null,
    hukouExamType: null,
    coldExamType: 'zhuanli',
    summary: {
      level: 'official',
      headline: '2026 年度秋季招聘已发布（七家中心合计约 500 名），部分中心报名窗口延至 2027-06-30',
    },
    thisYear: coldItemToThisYear(findColdItem('zhuanli'), '专利审查员全国统考：事业编制，电学 / 通信 / 光电领域点名计算机与人工智能专业'),
    forecast: {
      level: 'forecast',
      headline: '以秋季招聘为主：公告多在 7 月发布，部分中心报名窗口延至次年 6-30（按历年规律推算）',
      text:
        '专利审查协作中心各中心分批招聘，2026 年度公告 7 月发布、秋季招聘口径下部分中心报名窗口延至 2027-06-30。海外专业名称与国内目录不一致时通常需要课程清单佐证专业对口；英语需六级或同等水平。下一年度节奏以各中心公告为准。',
      sourceUrl: 'http://chd.ncss.cn/student/jobs/2JE815CPR9ycj4QoWhaBpF/detail.html',
      sourceName: '国家大学生就业服务平台（教育部）· 专利审查协作中心 2026 年专利审查员秋季招聘',
    },
  },
  yancao: {
    examTypes: ['yancao'],
    archiveGroup: null,
    hukouExamType: null,
    coldExamType: 'yancao',
    summary: {
      level: 'official',
      headline: '各省公司独立发布，多集中在 11 月—次年 4 月；留学回国人员明确纳入招录对象',
    },
    thisYear: coldItemToThisYear(findColdItem('yancao'), '中国烟草系统招聘：公告把留学回国人员逐字写进招录对象，含留服认证时限'),
    forecast: {
      level: 'forecast',
      headline: '各省公司独立发布，多集中在 11 月—次年 4 月；国家局机关岗位多要求硕士及以上',
      text:
        '烟草系统没有全国统一报名入口：各省公司独立组织、公告分散在各省局网站，多集中在 11 月—次年 4 月，多为全省统一笔试（ATA 机考）。2026 年度内蒙古公司招 150 人（报名 3-01 至 03-20）、辽宁公司招 124 人。不盯就会错过，需要按省份单独盯。',
      sourceUrl: 'http://www.tobacco.gov.cn/gjyc/zpxx/list.shtml',
      sourceName: '国家烟草专卖局 · 人才招聘平台（各省公司招聘信息统一发布入口）',
    },
  },
  dianwang: {
    examTypes: ['dianwang'],
    archiveGroup: null,
    hukouExamType: null,
    coldExamType: 'dianwang',
    summary: { level: 'thirdparty', headline: '一批约 11 月报名、12 月笔试；二批约次年 3—4 月（按历年规律）' },
    thisYear: coldItemToThisYear(findColdItem('dianwang'), '电网系统统一考试：央企直签劳动合同，学历效力等同国内全日制统招'),
    forecast: {
      level: 'forecast',
      headline: '一批约 11 月报名、12 月笔试；二批约次年 3—4 月（按历年规律推算）',
      text:
        '国家电网 / 南方电网按「一批 / 二批」两批组织统一考试：一批约 11 月报名、12 月笔试；二批约次年 3—4 月。单省公司常见数百人量级（如重庆一批约 508 人，其中统考约 116 人）。计算机岗数量远小于电气岗，多集中在信通、数字化单位与科研院所。',
      sourceUrl: 'https://zhaopin.sgcc.com.cn',
      sourceName: '国家电网有限公司人力资源招聘平台（一批 / 二批统一考试唯一报名入口）',
    },
  },
  nongxin: {
    examTypes: ['nongxin'],
    archiveGroup: null,
    hukouExamType: null,
    coldExamType: 'nongxin',
    summary: { level: 'official', headline: '各省联社独立批次（湖北 2026 年 3 月、7 月各一批）；应届硕士多不符合经验要求' },
    thisYear: coldItemToThisYear(findColdItem('nongxin'), '农商行 / 农信社统考：不足 1:3 会核减甚至取消岗位，是典型捡漏场景'),
    forecast: {
      level: 'forecast',
      headline: '各省联社独立发布、时间分散（湖北 2026 年 3 月、7 月各有批次）',
      text:
        '农信系统没有全国统考：各省联社独立发布、独立笔试（线下机考），单批常见 36—150 名。湖北 2026 年 3 月、7 月各有批次。多数批次是劳务派遣而非编制，且普遍要求 3—5 年相关岗位工作经验（双一流硕士可放宽 1 年、博士视同满足）——应届硕士基本不符合，需提前积累项目经历。',
      sourceUrl: 'https://www.hbxh.com.cn:8443/hbxh/2026-07/20/article_2026072015020722385.shtml',
      sourceName: '湖北省农村信用社联合社 · 网络信息中心 2026 年度劳务派遣科技专业人才招聘公告（第二批）',
    },
  },
  xiaofang: {
    examTypes: ['xiaofang'],
    archiveGroup: null,
    hukouExamType: null,
    coldExamType: 'xiaofang',
    summary: { level: 'official', headline: '2026 年度全国招录 17000 名（报名 6-12 至 06-30 已结束）；仅招男性' },
    thisYear: coldItemToThisYear(findColdItem('xiaofang'), '消防救援队伍招录：全国统考、可在户籍地或经常居住地省份报名，行政编制 + 授衔'),
    forecast: {
      level: 'forecast',
      headline: '预计下一年度 6 月发布公告、6 月下旬至 7 月初报名（按历年规律推算）',
      text:
        '国家综合性消防救援队伍消防员招录由应急管理部统一组织，2026 年度全国招录 17000 名（均为男性），网上注册报名 2026-06-12 23:00 至 06-30 18:00。招录对象可按个人意向选择在户籍地省份或经常居住地省份报名（持居住证即可）。年龄上限硬：一般 18—22 周岁，大学专科以上学历放宽至 24 周岁，特殊专业人才经批准不超过 28 周岁。',
      sourceUrl: 'https://kfq.jinhua.gov.cn/col/col1229093970/art/2026/art_b60800c25c2949a3a761cb8aecfba7b2.html',
      sourceName: '应急管理部 2026 年第 7 号公告（金华经济技术开发区管理委员会转载）',
    },
  },

  /* ═══════════ 运营商统招 ═══════════ */
  yunyingshang: {
    examTypes: ['yunyingshang'],
    archiveGroup: null,
    hukouExamType: null,
    summary: {
      level: 'forecast',
      headline: '岗位库已收录运营商行（示例行）：秋招约 9—11 月、春招 3—4 月，计算机岗集中在人工智能 / 大数据方向',
    },
    hukouNote:
      '运营商统招的户籍口径本次未核到公告原文——岗位库该考试类型目前只有示例行，还没核到任何一份真实公告。没出现 ≠ 限户籍，也不等于不限户籍。',
    notes: [
      { text: '该类别当前只有示例岗位行（「中国移动人工智能 / 大数据岗」为演示构造值），公告原文与报名入口均未核实——按「待核实」处理，不冒充已核实。', sourceUrl: null, sourceName: null },
      { text: '运营商校园招聘是企业合同制，不是行政 / 事业编制；多数批次对国（境）外学历只要求留服认证，具体以各公司当年公告为准。', sourceUrl: null, sourceName: null },
      { text: '各公司独立发布、独立网申、独立笔试：中国移动 / 中国电信 / 中国联通 / 中国铁塔要分别注册，别只盯一家。', sourceUrl: null, sourceName: null },
    ],
  },
};

/* ───────────────── 组装 ───────────────── */

/**
 * 生成分类详情数据（纯数据，不含数据库计数）。
 * @param {string} key 分类 key
 * @param {number} [positionCount] 岗位库中该分类对应考试类型的公共岗位数（由路由层查询后注入）
 */
export function categoryDetail(key, positionCount = 0) {
  const category = getCategory(key);
  if (!category) return null;
  const cfg = GUIDES[key];
  if (!cfg) return null;

  const hukouItem = findHukouItem(cfg.hukouExamType);
  const cold = cfg.coldExamType ? findColdItem(cfg.coldExamType) : null;
  const examTypes = cfg.examTypes || [];

  // 冷门统考自带 hukou 口径（open/fresh/local/mixed），与数据级别 level 是两个字段，不能混用
  const coldHukou = cold
    ? {
        level: cold.item.hukou,
        levelName: HUKOU_LEVEL_MAP.get(cold.item.hukou)?.name || cold.item.hukou,
        levelShort: HUKOU_LEVEL_MAP.get(cold.item.hukou)?.short || cold.item.hukou,
        name: cold.item.name,
        scale: cold.item.scale,
        window: cold.item.window,
        why: cold.item.why,
        quote: cold.item.quote,
        caution: cold.item.caution,
        stats: cold.item.stats || [],
        sourceUrl: cold.item.sourceUrl,
        sourceName: cold.item.sourceName,
      }
    : null;

  const notes = [...(cfg.notes || [])];
  // 冷门统考的「为什么值得看 / 注意事项」并进 notes（带来源）
  if (cold) {
    notes.push({ text: cold.item.why, sourceUrl: cold.item.sourceUrl, sourceName: cold.item.sourceName });
    notes.push({ text: cold.item.caution, sourceUrl: cold.item.sourceUrl, sourceName: cold.item.sourceName });
  }
  // 户籍条目自带的补充统计（如上海各区口径）并进 notes
  for (const s of hukouItem?.stats || []) {
    notes.push({ text: s.text, sourceUrl: s.sourceUrl, sourceName: s.sourceName });
  }

  return {
    category: {
      key: category.key,
      name: category.name,
      short: category.short,
      group: category.group,
      color: category.color,
      accent: category.accent,
      icon: category.icon,
      officialSite: category.officialSite,
      officialName: category.officialName,
      description: category.description,
      typicalMonths: category.typicalMonths,
    },
    updatedAt: CATEGORY_DETAIL_UPDATED_AT,
    summary: cfg.summary || null,
    // 考什么 · 备什么：通用备考口径（常识级整理，前端标注「以当年公告原文为准」）
    examInfo: getExamInfo(key),
    thisYear: cfg.thisYear || null,
    forecast: cfg.forecast || null,
    hukou: shapeHukou(hukouItem) || coldHukou,
    // 没核到户籍原文的类别：显式给「未核实」说明，不静默省略（与 hukou-guide 同一条纪律）
    hukouPending: cfg.hukouNote || null,
    announcements: findArchiveItems(cfg.archiveGroup),
    guides: cfg.guides || [],
    positions: {
      examTypes,
      count: positionCount,
      deepLink: examTypes.length ? `/positions?examType=${examTypes[0]}` : null,
    },
    links: [
      { label: category.officialName, url: category.officialSite },
      ...(cold ? [{ label: cold.item.sourceName, url: cold.item.sourceUrl }] : []),
    ],
    notes,
  };
}

/** 有详情数据的分类 key 列表（测试与验收脚本引用） */
export function categoryDetailKeys() {
  return Object.keys(GUIDES);
}
