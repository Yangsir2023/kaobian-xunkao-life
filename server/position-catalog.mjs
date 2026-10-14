/**
 * 岗位库目录：省份、专业方向、考试类型、开考比例、分数段 —— 单一事实来源。
 * 后端校验、前端筛选、徽标配色共用这一份定义，避免三处各写一套。
 *
 * ── 数据诚实边界 ──────────────────────────────────────────────
 * 本文件里的「政策基线」(PROVINCE_POLICIES / GUOKAO_SCORE_LINES / HARDSHIP_PROVINCES)
 * 全部来自可查证的官方公告原文，逐条附 sourceUrl，属**真实数据**。
 * 具体的「岗位 + 上岸分数」不在此文件 —— 那些在 position-nodes.mjs，
 * 且一律标记 dataLevel='sample'（示例），仅用于演示筛选逻辑，不可当作真实岗位。
 */

/** 31 个省级行政区 + 中央机关（国考职位归属） */
export const PROVINCES = [
  '中央机关', '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江',
  '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南',
  '广东', '广西', '海南', '重庆', '四川', '贵州', '云南', '西藏', '陕西', '甘肃',
  '青海', '宁夏', '新疆',
];

/** 西部地区和艰苦边远地区 15 个省区市（国考单独划定合格分数线的范围） */
export const HARDSHIP_PROVINCES = [
  '山西', '内蒙古', '吉林', '黑龙江', '广西', '重庆', '四川', '贵州', '云南',
  '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆',
];

/**
 * 专业方向：留学生报考的两条友好通道。
 * cs0812      —— 国内学硕一级学科「计算机科学与技术」，留服专业复核的目标方向之一
 * master_any  —— 岗位只要求「硕士研究生」不限制专业，留学生最不容易被专业目录卡住
 */
export const MAJOR_TRACKS = [
  {
    key: 'cs0812',
    name: '计算机科学与技术（0812）',
    short: '计算机 0812',
    color: '#1F5AE0',
    accent: '#EAF0FF',
    icon: 'database',
    desc: '国内学硕一级学科 0812。海外 CS 项目经留服专业复核后可落到该方向；岗位表写「计算机科学与技术」或「计算机类」时最稳。',
  },
  {
    key: 'master_any',
    name: '硕士不限专业',
    short: '硕士不限专业',
    color: '#0E8074',
    accent: '#E6F5F2',
    icon: 'book',
    desc: '岗位仅要求硕士研究生学历、不限专业。对留学生最友好——完全绕开专业目录比对，只看学历层次。',
  },
  {
    key: 'both',
    name: '0812 或硕士不限（双通道）',
    short: '双通道可报',
    color: '#7A4FD1',
    accent: '#F1ECFC',
    icon: 'spark',
    desc: '同一单位既有 0812 岗位也有硕士不限岗位，两类都能报。',
  },
  {
    key: 'other',
    name: '其他专业方向',
    short: '其他方向',
    color: '#4B5563',
    accent: '#EEF0F3',
    icon: 'briefcase',
    desc: '岗位有具体专业要求且不属于上述两条通道，报考前需先核对专业目录。',
  },
];

export const MAJOR_TRACK_MAP = new Map(MAJOR_TRACKS.map((m) => [m.key, m]));
export const MAJOR_TRACK_KEYS = MAJOR_TRACKS.map((m) => m.key);

/** 考试类型（与 CATEGORIES 的 key 对齐，前端配色沿用分类色） */
export const EXAM_TYPES = [
  { key: 'guokao', name: '国家公务员考试', short: '国考', color: '#C0392B', accent: '#FBEDEB' },
  { key: 'shengkao', name: '省公务员考试', short: '省考', color: '#1F5AE0', accent: '#EAF0FF' },
  { key: 'shiye', name: '事业单位招聘', short: '事业编', color: '#0E8074', accent: '#E6F5F2' },
  { key: 'xuandiao', name: '选调生', short: '选调', color: '#B8791A', accent: '#FBF3E4' },
  { key: 'jundui', name: '军队文职', short: '军队文职', color: '#2C6E49', accent: '#EAF4EE' },
  { key: 'sanzhiyifu', name: '三支一扶', short: '三支一扶', color: '#0F7BB5', accent: '#E8F3FA' },
];

export const EXAM_TYPE_MAP = new Map(EXAM_TYPES.map((t) => [t.key, t]));
export const EXAM_TYPE_KEYS = EXAM_TYPES.map((t) => t.key);

/** 开考比例：这是留学生低分上岸的关键筛选条件 */
export const RATIO_TYPES = [
  {
    key: 'none',
    name: '不设开考比例',
    short: '不设比例',
    color: '#0E7C6B',
    accent: '#E6F5F2',
    icon: 'checkCircle',
    desc: '按实际缴费人数开考，或公告明确不设开考比例——报名人数少也能考，是低分上岸的首要前提。',
  },
  {
    key: 'ratio',
    name: '设有开考比例',
    short: '有比例',
    color: '#C77412',
    accent: '#FDF3E5',
    icon: 'alert',
    desc: '常见 1:3 / 1:5 / 5:1，报名人数不足会核减或取消职位。报考前务必看公告。',
  },
];

export const RATIO_TYPE_MAP = new Map(RATIO_TYPES.map((r) => [r.key, r]));
export const RATIO_TYPE_KEYS = RATIO_TYPES.map((r) => r.key);

/** 学历层次 */
export const DEGREES = [
  { key: 'master', name: '硕士研究生', short: '硕士' },
  { key: 'bachelor', name: '本科', short: '本科' },
  { key: 'doctor', name: '博士研究生', short: '博士' },
  { key: 'any', name: '不限学历', short: '不限' },
];

export const DEGREE_MAP = new Map(DEGREES.map((d) => [d.key, d]));
export const DEGREE_KEYS = DEGREES.map((d) => d.key);

/** 数据可信度分级：UI 必须把 sample 明示出来，绝不让示例数据伪装成真实岗位 */
export const DATA_LEVELS = [
  {
    key: 'verified',
    name: '官方公告',
    short: '官方',
    color: '#0E7C6B',
    accent: '#E6F5F2',
    desc: '来自招录公告 / 职位表原文，可点击来源链接核对。',
  },
  {
    key: 'thirdparty',
    name: '第三方整理',
    short: '第三方',
    color: '#7A4FD1',
    accent: '#F1ECFC',
    desc: '来自公考雷达等第三方平台整理的报名与进面数据，通常溯源到官方公告，仍建议以官方职位表复核。',
  },
  {
    key: 'sample',
    name: '示例数据',
    short: '示例',
    color: '#C77412',
    accent: '#FDF3E5',
    desc: '仅用于演示筛选逻辑的占位行，不代表真实招录岗位，请以官方职位表为准。',
  },
  {
    key: 'user',
    name: '我录入的',
    short: '我的',
    color: '#1F5AE0',
    accent: '#EAF0FF',
    desc: '由你手工录入或批量导入，来源与准确性由录入人负责。',
  },
];

export const DATA_LEVEL_MAP = new Map(DATA_LEVELS.map((d) => [d.key, d]));
export const DATA_LEVEL_KEYS = DATA_LEVELS.map((d) => d.key);

/**
 * 分数段：用户要的「上岸分很低」的两个口径。
 * low50  —— 上岸笔试分落在 50~59 分
 * lt120  —— 上岸笔试分不足 120 分（国考满分 200，事业编常见 100/150）
 * 两者是「或」的关系：任一口径命中即算低分上岸。
 */
export const SCORE_BANDS = [
  { key: 'low50', name: '50 多分', short: '50 多分', hint: '上岸笔试分在 50~59 分之间' },
  { key: 'lt120', name: '低于 120 分', short: '低于 120 分', hint: '上岸笔试分不足 120 分' },
];

export const SCORE_BAND_KEYS = SCORE_BANDS.map((b) => b.key);

/** 判断一条岗位是否命中某个分数段（前后端共用同一算法） */
export function matchScoreBand(band, score) {
  if (!Number.isFinite(score)) return false;
  if (band === 'low50') return score >= 50 && score < 60;
  if (band === 'lt120') return score < 120;
  return false;
}

/** 命中任一低分口径即视为「低分上岸」 */
export function isLowScore(score) {
  return matchScoreBand('low50', score) || matchScoreBand('lt120', score);
}

/**
 * 进面分数三件套（参照主流公考 App 的「进面分数线」区块）。
 * scoreMin 是门槛分——要迈过的那条线，也是「低分上岸」筛选的判定依据；
 * scoreMax / scoreAvg 描述同一岗位的分数区间与平均水平，用来判断竞争烈度。
 */
export const SCORE_FIELDS = [
  { key: 'scoreMin', name: '最低进面分数', short: '最低', hint: '进入面试的最低笔试分，也是你要迈过的门槛线' },
  { key: 'scoreMax', name: '最高进面分数', short: '最高', hint: '该岗位进面人员中的最高笔试分' },
  { key: 'scoreAvg', name: '平均进面分数', short: '平均', hint: '该岗位进面人员的平均笔试分' },
];

/** 报名数据块：竞争比与各环节人数，直接反映上岸难度 */
export const APPLY_FIELDS = [
  { key: 'competition', name: '竞争比', hint: '报名人数与招录人数之比，如 39:1' },
  { key: 'applicants', name: '报名人数', hint: '提交报名的人数' },
  { key: 'approvedCount', name: '过审人数', hint: '通过资格审查的人数' },
  { key: 'paidCount', name: '缴费人数', hint: '完成缴费的人数，通常等于实际参考人数' },
];

/* ═══════════════════════════════════════════════════════════════
   捡漏栏目：五条件判定 + 实时窗口 + 政审红线 + 2026 实录
   判定逻辑前后端共用（后端 shapePosition 与筛选，前端逐条展示 ✓/✗）
   ═══════════════════════════════════════════════════════════════ */

/**
 * 捡漏五条件——全部命中才值得「圈出来」：
 *   zeroApplicants  报名人数为 0：没人报的岗位才谈得上捡漏
 *   noRatio         不设开考比例：按实际缴费人数开考，人少也照考，不会因报名不足被核减取消
 *   trackOk         专业对口：0812 或硕士不限专业
 *   degreeOk        学历达标：岗位要硕士或不限学历
 *   returneeSafe    留学生政审安全：非公安政法类职位（见 RETURNEE_POLICE_BAR）
 */
export const BARGAIN_CONDITIONS = [
  { key: 'zeroApplicants', label: '无人报考', hint: '报名人数为 0——没人报的岗位才谈得上捡漏' },
  { key: 'noRatio', label: '不设开考比例', hint: '按实际缴费人数开考，人少也能考，不会因报名不足被核减或取消' },
  { key: 'trackOk', label: '专业对口', hint: '计算机科学与技术（0812）或硕士不限专业' },
  { key: 'degreeOk', label: '学历达标', hint: '岗位要求硕士或不限学历' },
  { key: 'returneeSafe', label: '留学生政审安全', hint: '非公安政法类职位——该类职位含六个月以上境外经历禁入条款，专业再对口也报不了' },
];

/** 判断一条岗位是否命中某个捡漏条件（容错老数据：缺字段按不命中处理） */
export function matchBargainCondition(key, doc) {
  if (key === 'zeroApplicants') return doc.applicants === 0;
  if (key === 'noRatio') return doc.ratioType === 'none';
  if (key === 'trackOk') return ['cs0812', 'master_any', 'both'].includes(doc.majorTrack);
  if (key === 'degreeOk') return ['master', 'any'].includes(doc.degree);
  if (key === 'returneeSafe') return !doc.policePosition;
  return false;
}

/** 五条全中才算「捡漏」；conditions 逐条带 ok，UI 用来展示差在哪 */
export function evaluateBargain(doc) {
  const conditions = BARGAIN_CONDITIONS.map((c) => ({ ...c, ok: matchBargainCondition(c.key, doc) }));
  return { hit: conditions.every((c) => c.ok), conditions };
}

/**
 * 留学生政审红线：公安政法类职位（人民警察）。
 * 依据一：《公安机关录用人民警察政治考察工作办法》（公通字〔2020〕11号），
 *   第八条明确「已取得或者正在申请国（境）外永久居留权、长期居留许可的」不得确定为拟录用人选；
 *   各地公安机关报考指南进一步明确：曾连续六个月以上在国（境）外留学、工作、生活，
 *   国（境）外期间经历和政治表现难以进行考察的，不得录用（东莞、博罗等地报考指南原文口径）。
 * 依据二：国考/省考人民警察职位表备注原文「非公派原因，曾六个月以上在国（境）外留学、工作、生活的，不得报考」。
 * 适用范围：出入境边防检查、缉私、移民、监狱、司法警察等人民警察职位（海关缉私局属人民警察序列）。
 */
export const RETURNEE_POLICE_BAR = {
  title: '公安政法类职位对留学生的禁入条款',
  quote: '非公派原因，曾六个月以上在国（境）外留学、工作、生活的，不得报考。',
  points: [
    '自费出国留学满一年以上的，基本都会踩中这条——英国一年制硕士正好超过六个月线。',
    '踩中的不是「专业不符」，是「政治考察无法完成」：边检、缉私这类职位零报名最多，但对留学生是硬禁入。',
    '非公安类职位（税务、海关业务、气象、海事、事业编）没有这条硬禁入，留学经历按《公务员录用考察办法（试行）》正常考察即可。',
    '录入岗位时勾选「公安政法类」，捡漏判定会自动把它标为留学生不宜报，避免浪费时间。',
  ],
  scope: '出入境边防检查 / 缉私 / 移民 / 监狱 / 司法警察等人民警察职位',
  sourceUrl: 'https://www.szft.gov.cn/bmxx/qgaj/ztfw/zjbl/zcfg/content/post_8176219.html',
  sourceName: '《公安机关录用人民警察政治考察工作办法》（公通字〔2020〕11号）全文',
};

/** 2027 年度国考实时窗口（公告 2026-10-13 发布，报名进行中） */
export const GUOKAO_2027_WINDOW = {
  title: '2027 年度国考 · 报名窗口（进行中）',
  registerStart: '2026-10-14 08:00',
  registerEnd: '2026-10-24 18:00',
  authDeadline: '2026-10-23 18:00',
  examDate: '2026-11-29',
  planTotal: '3.57 万人',
  planFresh: '2.46 万个应届计划（中央机关直属市（地）级及以下机构主要招录应届高校毕业生）',
  ageRule: '18~38 周岁（1987-10 至 2008-10 出生）；2027 年应届硕士、博士放宽到 43 周岁',
  baseRule: '中央机关及省级直属机构主要招录具有 2 年以上基层工作经历人员（经历计算截止 2026-10）',
  authNote: '须先在专题网站注册，并通过电子社保卡等完成实名实人认证，才能报名和提交报考申请',
  trackTips: [
    '报名数据每日更新：公考雷达 / 华图 / 中公的「报名人数统计」每天刷新，按「报名人数 ≤ 招考人数」筛，就是当日捡漏候选。',
    '报名最后两天是黄金窗口：大量考生观望到截止前才报名，冷门职位在 10/23-10/24 会集中现形。',
    '应届身份口径以当年报考指南为准（往年口径：面试前取得境外学位并完成留服认证、未落实工作单位）。',
    '职位表在专题网站下载后，可用「录入岗位 / 批量导入」把候选行灌进本应用，自动跑捡漏五条件。',
  ],
  sourceUrl: 'http://bm.scs.gov.cn/kl2027',
  sourceName: '国家公务员局 · 2027 年度考试录用公务员专题网站',
};

/** 报名不需要简历：统考材料清单（广东省考资审公告原文） */
export const NO_RESUME_NOTE = {
  title: '公务员 / 事业编统考报名不需要简历',
  points: [
    '国考、省考、事业单位统一公开招聘的报名与资格审核材料只有：报名登记表、身份证、户口簿、学历学位证（应届生为学生证 + 就业推荐表）、职位要求的证明材料——全程没有「简历」这一项。',
    '留学生只多一份材料：教育部留学服务中心出具的学历学位认证函；专业名对不上国内目录时，再用 12 个月内的 1 次专业复核对齐 0812。',
    '需要简历的是国企、银行、高校、医院等自主招聘，不走统考流程——巡考路上真正要准备简历的是这类。',
  ],
  sourceUrl: 'https://gdjyj.gd.gov.cn/attachment/0/607/607945/4862641.pdf',
  sourceName: '广东省公务员考试录用资格审核材料清单',
};

/** 2026 国考「挂零」实录：为什么这些漏捡不到（真实数据，见 position-nodes.mjs 种子行） */
export const GUOKAO_2026_ZERO_TIP = {
  title: '2026 国考「挂零」实录',
  stats:
    '截至 2025-10-24 17:30，2026 国考共 89 个职位无人报考（占总职位数 0.4%，比上年 163 个减少近一半），吉林省居首；集中在出入境边检总站、海关、海事局等一线执法部门。',
  lessons: [
    '边检 / 缉私类零报名最多，但人民警察职位对留学生有六个月以上境外经历禁入条款——专业再对口也报不了（见上方政审红线）。',
    '上海海关「物控查检（电子信息化类）」专业明确含计算机科学与技术，却因「定向大学生村官 + 二年基层经历 + 中共党员」零报名——卡人的是门槛，不是分数。',
    '事业编同款剧本：湖南省直事业单位网络工程师岗（0812）仅 1 人过审、未达 1:3 开考比例被取消，卡在「网信中级职称」；江苏 22 个岗位未达开考比例被取消，计算机岗多要求博士。',
    '结论：对留学生 CS 硕士，「零报名 + 不设比例 + 专业对口 + 政审安全」四件事同时成立的位置极稀缺——所以要做的是在报名窗口内每日盯数据，而不是翻旧黄历。',
  ],
  sourceUrl: 'https://www.eoffcn.com/kszx/detail/2169525.html',
  sourceName: '中公教育 · 2026 国考报名数据统计（89 个职位挂零）',
};

/** 捡漏攻略：前端「捡漏攻略」弹层一次性取用（随 catalogs 下发） */
export const BARGAIN_GUIDE = {
  intro:
    '捡漏 = 没人报 + 我能报 + 考得起。本应用把这三件事拆成可核验的五条件，命中即「圈出来」；下面是实时窗口、政审红线、材料清单与 2026 年真实挂零实录。',
  conditions: BARGAIN_CONDITIONS,
  window: GUOKAO_2027_WINDOW,
  policeBar: RETURNEE_POLICE_BAR,
  noResume: NO_RESUME_NOTE,
  zeroTip: GUOKAO_2026_ZERO_TIP,
};

export const SORTS = [
  { key: 'score_asc', label: '上岸分从低到高' },
  { key: 'score_desc', label: '上岸分从高到低' },
  { key: 'created_desc', label: '最近录入' },
];

export const SORT_KEYS = SORTS.map((s) => s.key);

/* ═══════════════════════════════════════════════════════════════
   以下为可查证的政策基线（真实数据，逐条附官方来源）
   ═══════════════════════════════════════════════════════════════ */

/**
 * 2026 年度国考笔试合格分数线（国家公务员局 2026-01-15 公布）
 * 来源：http://bm.scs.gov.cn 「笔试成绩和合格分数线公布」
 */
export const GUOKAO_SCORE_LINES = [
  {
    scope: '中央机关和省级（副省级）直属机构 · 综合管理类',
    total: 105,
    sub: 60,
    subName: '行政职业能力测验',
  },
  {
    scope: '市（地）级、县（区）级直属机构 · 综合管理类 / 行政执法类',
    total: 95,
    sub: 50,
    subName: '行政职业能力测验',
  },
  {
    scope: '西部地区和艰苦边远地区职位 / 定向招录服务基层项目人员 / 军队服役 5 年以上高校毕业生退役士兵 / 非通用语 / 特殊专业',
    total: 90,
    sub: 45,
    subName: '行政职业能力测验',
  },
];

/** 国考专业科目笔试合格线 */
export const GUOKAO_SUBJECT_LINE = { total: 45, note: '金融监管总局及其派出机构、中国证监会及其派出机构、公安机关人民警察职位' };

/**
 * 留学回国人员报考国考的应届身份认定（2026 年度报考指南原文口径）
 * 来源：http://bm.scs.gov.cn 「中央机关及其直属机构 2026 年度考试录用公务员报考指南」
 */
export const RETURNEE_POLICY = {
  title: '留学回国人员可以报考哪些职位',
  quote:
    '留学回国人员可以根据自身情况报考符合条件的职位。其中，2024 年 1 月 1 日至面试前取得国（境）外学位并完成教育部门学历认证的留学回国人员，未落实工作单位的，可以报考仅允许应届高校毕业生报考的职位。',
  requirements: [
    '面试前须向招录机关提供学位证书和教育部门学历认证材料',
    '学历认证走教育部留学服务中心（zwfw.cscse.edu.cn），常规 10-20 个工作日',
    '专业名称与国内目录不一致时，可在认证通过后 12 个月内申请 1 次专业复核',
  ],
  sourceUrl: 'http://bm.scs.gov.cn/pp/gkweb/core/web/ui/business/article/articledetail.html?ArticleId=8a81f6d09780e3a20199dd916ecf0122&id=0000000062b7b2b',
  sourceName: '国家公务员局 · 2026 年度考试录用公务员报考指南',
};

/** 艰苦边远地区基层职位倾斜政策（中组部/人社部《关于做好艰苦边远地区基层公务员考试录用工作的意见》） */
export const HARDSHIP_POLICY = {
  title: '艰苦边远地区基层职位倾斜',
  points: [
    '西藏和四川、云南、甘肃、青海四省藏区以及新疆南疆地区县乡，必要时可不设开考比例',
    '可单独划定笔试合格分数线，适当降低进入门槛',
    '不限制工作年限和经历',
    '新录用乡镇公务员最低服务年限 5 年（含试用期）',
  ],
  sourceUrl: 'https://rsj.tangshan.gov.cn/',
  sourceName: '唐山市人力资源和社会保障局 · 《关于做好艰苦边远地区基层公务员考试录用工作的意见》要点',
};

/**
 * 分省开考比例政策基线。
 * 只收录**已逐条核对官方公告原文**的省份；未核实的省份不写死，由用户录入岗位时补充。
 * 每条都带 sourceUrl 与核对日期，改政策时按链接复核即可。
 */
export const PROVINCE_POLICIES = [
  {
    province: '中央机关',
    examType: 'guokao',
    ratio: 'ratio',
    ratioText: '国考按职位表规定的面试比例（常见 3:1 / 4:1）确定进面人选；笔试合格人数不足时组织公开调剂与补充录用',
    scoreLine: '总分 90 / 95 / 105 三档（见合格分数线）',
    freshRule: '2024-01-01 至面试前取得境外学位并完成学历认证、未落实工作单位的留学回国人员，可报仅限应届高校毕业生的职位',
    sourceUrl: 'http://bm.scs.gov.cn/',
    sourceName: '国家公务员局',
    verifiedOn: '2026-10-14',
  },
  {
    province: '广西',
    examType: 'shengkao',
    ratio: 'none',
    ratioText: '计划录用人数与缴费人数一般应达 1:3 方可开考；艰苦边远地区职位、紧缺职位、法官助理、检察官助理、服务基层项目人员、优秀村干部、退役军人、残疾人、公安英烈子女等按实际缴费人数开考',
    scoreLine: '行测、申论满分各 100 分',
    freshRule: '以当年公告为准；留学回国人员一般按公告中的应届生口径执行',
    sourceUrl: 'http://www.luzhai.gov.cn/xxgk/fdzdgknr/rsxx/zkzl/202601/t20260120_3715550.shtml',
    sourceName: '广西壮族自治区 2026 年度考试录用公务员公告',
    verifiedOn: '2026-10-14',
  },
  {
    province: '湖南',
    examType: 'shengkao',
    ratio: 'ratio',
    ratioText: '笔试最低开考比例一般为 5:1；艰苦边远地区县乡机关、医学类人民警察、定向招录职位可为 3:1；法官助理、检察官助理、警犬技术职位可为 2:1',
    scoreLine: '各科目满分均为 100 分',
    freshRule: '以当年公告为准；定向招录职位需提前通过资格审查',
    sourceUrl: 'https://www.hubpd.com/hubpd/rss/uc/index.html?contentId=2594073385369918765',
    sourceName: '湖南省 2026 年考试录用公务员公告',
    verifiedOn: '2026-10-14',
  },
  {
    province: '重庆',
    examType: 'shengkao',
    ratio: 'ratio',
    ratioText: '报名人数与招考指标比例原则上应达到规定笔试开考比例；艰苦边远地区乡镇机关职位可降低至 3:1',
    scoreLine: '行测、申论满分各 100 分；公安人民警察笔试成绩按行测 40% + 申论 30% + 专业科目 30% 合成',
    freshRule: '以当年公告为准',
    sourceUrl: 'https://www.cqnc.gov.cn/zwxx_197/gsgg/202601/t20260115_15323598.html',
    sourceName: '重庆市 2026 年度考试录用公务员公告',
    verifiedOn: '2026-10-14',
  },
  {
    province: '全国',
    examType: 'shengkao',
    ratio: 'none',
    ratioText: '西藏和四川、云南、甘肃、青海四省藏区以及新疆南疆地区县乡，必要时可不设开考比例',
    scoreLine: '艰苦边远地区可单独划定笔试合格分数线',
    freshRule: '艰苦边远地区招录不限制工作年限和经历',
    sourceUrl: 'https://rsj.tangshan.gov.cn/',
    sourceName: '《关于做好艰苦边远地区基层公务员考试录用工作的意见》',
    verifiedOn: '2026-10-14',
  },
];

export const PROVINCE_POLICY_DISCLAIMER =
  '政策基线仅收录已核对官方公告原文的条目，且随年度可能调整；未收录省份请以当地人事考试网当年公告为准。';

export function getMajorTrack(key) {
  return MAJOR_TRACK_MAP.get(key) || null;
}
export function getExamType(key) {
  return EXAM_TYPE_MAP.get(key) || null;
}
export function getRatioType(key) {
  return RATIO_TYPE_MAP.get(key) || null;
}
export function getDataLevel(key) {
  return DATA_LEVEL_MAP.get(key) || null;
}
export function getDegree(key) {
  return DEGREE_MAP.get(key) || null;
}

/** 岗位目录对外投影（前端筛选与徽标用） */
export function publicCatalogs() {
  return {
    provinces: PROVINCES,
    hardshipProvinces: HARDSHIP_PROVINCES,
    majorTracks: MAJOR_TRACKS,
    examTypes: EXAM_TYPES,
    ratioTypes: RATIO_TYPES,
    degrees: DEGREES,
    dataLevels: DATA_LEVELS,
    scoreBands: SCORE_BANDS,
    scoreFields: SCORE_FIELDS,
    applyFields: APPLY_FIELDS,
    bargainConditions: BARGAIN_CONDITIONS,
    bargainGuide: BARGAIN_GUIDE,
    sorts: SORTS,
  };
}
