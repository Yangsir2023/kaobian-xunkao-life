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

import { BEST_RECOMMEND } from './best-recommend.mjs';

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
  { key: 'rencai', name: '人才引进', short: '人才引进', color: '#C2410C', accent: '#FFF0E6' },
  { key: 'shequ', name: '社区工作者', short: '社区工作者', color: '#7A4FD1', accent: '#F1ECFC' },
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

/**
 * 进面分数口径——「200 分考 53.35」类误读的根源，录入与展示必须显式声明。
 * total   总分口径：行测 + 申论直接相加（国考最低面试分数、多数省份省考按此公布）
 * avg100  两科平均口径：行测、申论各按 50% 折算的百分制合成成绩（云南省考按此口径排名与公布）
 * 换算关系：avg100 × 2 = total。官方合格线一律按总分口径划定，比对前先换口径。
 */
export const SCORE_BASES = [
  {
    key: 'total',
    name: '总分口径',
    short: '总分',
    hint: '行测 + 申论直接相加（满分 200）；国考最低面试分数、多数省份按此公布',
  },
  {
    key: 'avg100',
    name: '两科平均口径',
    short: '平均分',
    hint: '行测、申论各占 50% 折算的百分制合成成绩；云南省考进面排名与公考雷达展示多用此口径',
  },
];

export const SCORE_BASE_MAP = new Map(SCORE_BASES.map((b) => [b.key, b]));
export const SCORE_BASE_KEYS = SCORE_BASES.map((b) => b.key);

/** avg100 → total 的口径换算（合格线比对用） */
export function toTotalBasis(score, basis) {
  if (!Number.isFinite(score)) return null;
  if (basis === 'avg100') return Math.round(score * 2 * 100) / 100;
  return score;
}

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

/* ═══════════════════════════════════════════════════════════════
   准捡漏档：报名≈招录 + 有进面分 + 适合我（marks 标注进面比/应届/分数持平）
   ═══════════════════════════════════════════════════════════════ */

/**
 * 准捡漏五条件——「报名人数跟岗位相同或只多一点点」的低竞争岗位：
 *   lowApply      报名人数不超过招录人数 1.5 倍（或仅多两三个人）
 *   hasScore      跟之前一样展示最低/最高/平均进面分，门槛可核验
 *   trackOk       专业可报：0812 / 硕士不限 / 双通道
 *   degreeFit     学历可报：硕士、本科或不限学历（硕士对本科岗是降维兼容）
 *   returneeSafe  留学生政审安全：非公安政法类职位
 *
 * 「没有进面比（没有就标记一下）」「有进面的应届生」「分数与上年持平」
 * 不作为淘汰条件，而是 marks——命中即在卡片上打标签，缺失时在核对清单里可见。
 */
export const NEAR_BARGAIN_CONDITIONS = [
  { key: 'lowApply', label: '报名≈招录 / 未达比例', hint: '报名人数不超过招录人数的 1.5 倍（或仅多两三个人）；公告明确「报名/缴费未达开考比例」被核减或取消的岗位同样算——报名人数缺失时按「竞争比 × 招录人数 → 过审 → 缴费」顺序退用，口径会标出来' },
  { key: 'hasScore', label: '有进面分数', hint: '跟之前一样展示最低/最高/平均进面分，能核验要迈过的门槛' },
  { key: 'trackOk', label: '专业可报', hint: '计算机科学与技术（0812）或硕士不限专业' },
  { key: 'degreeFit', label: '学历可报', hint: '岗位要求硕士、本科或不限学历——硕士学历全覆盖（三支一扶/社区多要求本科即可）' },
  { key: 'returneeSafe', label: '留学生政审安全', hint: '非公安政法类职位——该类职位含六个月以上境外经历禁入条款' },
];

/** 准捡漏附加标记：不淘汰，只标注（「没有就标记一下」） */
export const NEAR_BARGAIN_MARKS = [
  { key: 'noRatio', label: '无进面比', hint: '不设开考/进面比例，或公告明确未达比例也可开考、不递减指标' },
  { key: 'freshOk', label: '应届进面', hint: '仅限应届高校毕业生，或有应届生进面的记录' },
  { key: 'scoreStable', label: '分数持平', hint: '进面分与上年基本持平（录入时对照上年数据勾选，波动大可警惕）' },
];

/** 报名人数口径：告诉 UI 这个数字是从哪个字段来的，避免「缴费人数」被当成「报名人数」 */
export const APPLY_COUNT_SOURCES = {
  applicants: '报名人数',
  competition: '竞争比 × 招录人数',
  approved: '过审人数',
  paid: '缴费人数',
};

/**
 * 有效报名人数：口径优先级 = 报名人数 → 竞争比 × 招录人数 → 过审人数 → 缴费人数。
 *
 * 为什么把「报名人数」放第一：用户判定「报名≈招录」时看的就是报名人数；
 * 竞争比是官方/平台直接给的比值，比缴费人数更接近报名规模（缴费只说明谁真去考了）；
 * 只有在报名人数与竞争比都没有时才退用缴费，且 UI 会标出口径。
 */
export function effectiveApplicants(doc) {
  if (Number.isFinite(doc.applicants)) return doc.applicants;
  if (Number.isFinite(doc.competition) && Number.isFinite(doc.planCount) && doc.planCount > 0) {
    return Math.round(doc.competition * doc.planCount);
  }
  if (Number.isFinite(doc.approvedCount)) return doc.approvedCount;
  if (Number.isFinite(doc.paidCount)) return doc.paidCount;
  return null;
}

/** 报名人数取自哪个字段（UI 显式标注，避免口径误读） */
export function applyCountSource(doc) {
  if (Number.isFinite(doc.applicants)) return 'applicants';
  if (Number.isFinite(doc.competition) && Number.isFinite(doc.planCount) && doc.planCount > 0) return 'competition';
  if (Number.isFinite(doc.approvedCount)) return 'approved';
  if (Number.isFinite(doc.paidCount)) return 'paid';
  return null;
}

/**
 * 报名数据一致性自检：同一行里几个数字互相矛盾时如实标出来，
 * 不让「竞争比 39:1」和「缴费人数 4」并列却都当成事实展示。
 * 返回人类可读的问题清单，UI 打「报名数据待核验」并逐条列出。
 */
export function applyDataIssues(doc) {
  const issues = [];
  const { applicants, approvedCount, paidCount, competition, planCount } = doc;

  if (Number.isFinite(competition) && Number.isFinite(planCount) && planCount > 0) {
    const implied = Math.round(competition * planCount);
    if (Number.isFinite(applicants) && Math.abs(implied - applicants) > Math.max(1, applicants * 0.2)) {
      issues.push(`竞争比 ${competition}:1 × 招录 ${planCount} 人 ≈ 报名 ${implied} 人，与录入的报名人数 ${applicants} 不一致`);
    }
    if (!Number.isFinite(applicants) && Number.isFinite(paidCount)) {
      if (paidCount > implied) {
        issues.push(`缴费人数 ${paidCount} 大于竞争比隐含的报名人数 ${implied}`);
      } else if (implied > 0 && paidCount < implied * 0.5) {
        // 缴费率异常偏低（报名后大半没缴费）——大概率是「竞争比」或「缴费人数」抄错了列
        issues.push(
          `竞争比 ${competition}:1 隐含报名约 ${implied} 人，但缴费仅 ${paidCount} 人（缴费率 ${Math.round((paidCount / implied) * 100)}%，异常偏低），两列数据可能错位`
        );
      }
    }
  }
  if (Number.isFinite(applicants) && Number.isFinite(approvedCount) && approvedCount > applicants) {
    issues.push(`过审人数 ${approvedCount} 大于报名人数 ${applicants}`);
  }
  if (Number.isFinite(approvedCount) && Number.isFinite(paidCount) && paidCount > approvedCount) {
    issues.push(`缴费人数 ${paidCount} 大于过审人数 ${approvedCount}`);
  }
  if (Number.isFinite(competition) && !Number.isFinite(planCount)) {
    issues.push('录入了竞争比但缺招录人数，无法回算报名规模');
  }
  return issues;
}

/**
 * 低报名判定（保守口径）：
 *   1) 公告明确「报名/缴费人数未达开考比例」而被核减或取消（ratioShortfall）——这是最硬的证据，
 *      比任何推算数字都直接，直接算低报名；
 *   2) 否则看报名规模：不超过「招录人数 × 1.5」与「招录人数 + 3」的较大者。
 *      例：招 1 人 → 报名 ≤4；招 2 人 → ≤5；招 10 人 → ≤15。
 *
 * 关键：**只要行内任何一个可得的人数口径超出上限，就不算低报名**。
 * 例如某行同时记着「竞争比 39:1」和「缴费人数 4」——两个数字互相矛盾，
 * 这时宁可判否并在 UI 标「报名数据待核验」，也不拿小的那个去宣称「报名≈招录」。
 */
export function isLowApply(doc) {
  if (doc.ratioShortfall === true) return true;
  const plan = Number.isFinite(doc.planCount) ? doc.planCount : null;
  if (!plan || plan < 1) return false;
  const limit = Math.max(plan * 1.5, plan + 3);
  const counts = applicantCounts(doc);
  if (!counts.length) return false;
  return counts.every((n) => n <= limit);
}

/** 低报名的判定依据：报名规模推算（count）优先，只有规模推不出来时才归为公告口径 */
export function lowApplyBasis(doc) {
  if (!isLowApply(doc)) return null;
  const plan = Number.isFinite(doc.planCount) ? doc.planCount : null;
  if (plan && plan >= 1) {
    const limit = Math.max(plan * 1.5, plan + 3);
    const counts = applicantCounts(doc);
    if (counts.length && counts.every((n) => n <= limit)) return 'count';
  }
  return 'ratioShortfall';
}

/** 行内所有可得的报名规模口径（去重），用于一致性自检与保守判定 */
export function applicantCounts(doc) {
  const plan = Number.isFinite(doc.planCount) ? doc.planCount : null;
  const list = [];
  if (Number.isFinite(doc.applicants)) list.push(doc.applicants);
  if (Number.isFinite(doc.competition) && plan > 0) list.push(Math.round(doc.competition * plan));
  if (Number.isFinite(doc.approvedCount)) list.push(doc.approvedCount);
  if (Number.isFinite(doc.paidCount)) list.push(doc.paidCount);
  return [...new Set(list)];
}

/** 硕士学历是否满足岗位学历要求（本科岗对硕士是降维兼容） */
export function isDegreeFit(doc) {
  return ['master', 'bachelor', 'any'].includes(doc.degree);
}

export function matchNearBargainCondition(key, doc) {
  if (key === 'lowApply') return isLowApply(doc);
  if (key === 'hasScore') return Number.isFinite(doc.scoreMin) || Number.isFinite(doc.score);
  if (key === 'trackOk') return ['cs0812', 'master_any', 'both'].includes(doc.majorTrack);
  if (key === 'degreeFit') return isDegreeFit(doc);
  if (key === 'returneeSafe') return !doc.policePosition;
  return false;
}

export function matchNearBargainMark(key, doc) {
  if (key === 'noRatio') return doc.ratioType === 'none' || doc.ratioFlexible === true;
  if (key === 'freshOk') return doc.freshOnly === true || doc.freshInterview === true;
  if (key === 'scoreStable') return doc.scoreStable === true;
  return false;
}

/**
 * 准捡漏判定：五条件全中才算 hit。
 *
 * partial = 「低竞争 + 学历可报 + 政审安全」三条成立——这三条是**结构性**的
 * （报名少、硕士学历够、不是公安政法类），只剩「专业通道」需要逐条核对官方岗位表。
 * 这类岗位照样值得盯：专业要求往往是「不限专业」而岗位表没写全，录进来核对即可。
 */
export function evaluateNearBargain(doc) {
  const conditions = NEAR_BARGAIN_CONDITIONS.map((c) => ({ ...c, ok: matchNearBargainCondition(c.key, doc) }));
  const marks = NEAR_BARGAIN_MARKS.map((m) => ({ ...m, ok: matchNearBargainMark(m.key, doc) }));
  const hit = conditions.every((c) => c.ok);
  const partial =
    isLowApply(doc) &&
    matchNearBargainCondition('degreeFit', doc) &&
    matchNearBargainCondition('returneeSafe', doc);
  return { hit, partial, conditions, marks };
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
  authStart: '2026-10-14 08:00',
  authDeadline: '2026-10-23 18:00',
  registerStart: '2026-10-15 08:00',
  registerEnd: '2026-10-24 18:00',
  reviewWindow: '2026-10-15 08:00 至 2026-10-26 18:00（资格审查）',
  feeWindow: '2026-11-01 00:00 至 2026-11-06 24:00（报名确认并缴费，逾期视为放弃）',
  ticketWindow: '2026-11-23 00:00 至 2026-11-29 15:00（打印准考证）',
  resultDate: '2027 年 1 月（笔试成绩与合格分数线）',
  examDate: '2026-11-29（专业科目 / 外语水平测试 2026-11-28 14:00—16:00）',
  planTotal: '35691 人 / 19426 个职位（较 2026 年度 3.81 万减 0.24 万，降幅 6.3%）',
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

/**
 * 云南省 2026 年度笔试合格分数线（云南省公务员局 / 云南省人社厅 2026-04-10 公布，已核对原文）。
 * 口径：非公安职位按行测 + 申论「两科成绩总分」划定（满分 200）；进面排名按合成成绩百分制折算。
 */
export const YUNNAN_2026_SCORE_LINES = [
  { scope: '省级机关职位', total: 110 },
  { scope: '州（市）级机关职位', total: 105 },
  { scope: '县（市、区）级机关职位', total: 95 },
  { scope: '乡镇（街道）职位 · 非艰苦边远地区', total: 90 },
  { scope: '乡镇（街道）职位 · 艰苦边远地区', total: 85 },
  { scope: '行政执法类职位、省属监狱系统基层单位职位', total: 100 },
  { scope: '公安机关人民警察职位（行测 + 申论 + 公安专业科目三科总分）', total: 145 },
];

/**
 * 进面分数线口径校准——「200 分考 53.35，27% 正确率」是口径误读，不是数据造假。
 * 已核对：云南省 2026 年度合格线公告（云岭先锋网）、2024 与 2026 年度国考合格线（国家公务员局）。
 */
export const SCORE_CALIBRATION = {
  title: '进面分数线口径校准：53.35 不是「200 分拿 53.35」',
  points: [
    '云南省考笔试满分 200 = 行测 100 + 申论 100。官方按两科总分划定合格线：省级 110 / 州市级 105 / 县级 95 / 乡镇 90（艰苦边远 85）/ 行政执法与省属监狱 100 / 公安 145（2026 年度）。',
    '云南省考进面排名按「笔试合成成绩」——行测、申论各占 50%，折算百分制。公考雷达等平台展示的「最低进面分 53.35」正是这个合成成绩口径，被标成「满分 200」属于口径错位。',
    '换算：合成成绩 × 2 = 总分。53.35 分折合总分 106.7，高于县级合格线 95；换到合成口径，县级合格线是 47.5，53.35 高出 5.85 分——数据自洽，这个分数是真的。',
    '「笔试约需 27% 的正确率」因此是误读：53.35/100 的含意是两科平均 53.35 分（单科约五成三得分率），不是 200 分里只拿 53.35。行测客观题约对一半多一点，申论按点给分，远程县乡低竞争岗位完全可能出现。',
    '国考同口径：最低面试分数按总分（行测 + 申论）公布；西部地区和艰苦边远地区职位合格线为总分 90、行测 45（2024、2026 年度均为该口径，国家公务员局公布）。',
    '本应用的做法：每个岗位显式记录「分数口径 + 官方合格线」，展示时自动换算比对，进面分低于合格线时标记「数据待核验」——不再出现口径错位造成的误判。',
  ],
  yunnanLines: YUNNAN_2026_SCORE_LINES,
  sourceUrl: 'https://ylxf.1237125.cn/TopicWeb/ynskslygwy/index.html',
  sourceName: '云岭先锋网 · 云南省 2026 年度考试录用公务员笔试合格分数线公告（2026-04-10）',
};

/**
 * 人才引进绿色通道：QS 前 200 硕士 + 普通本科的正确打开方式。
 * 已逐条核对官方公告原文——这些通道只卡「硕士院校排名」，不要求本科 985/211。
 */
export const RENCAI_QS200_GUIDE = {
  title: '人才引进：QS 前 200 硕士的绿色通道（不看本科层次）',
  note:
    '下列公告的共同点：引进对象只要求「国（境）外 QS/THE/ARWU/U.S.News 前 200（或 500）高校全日制硕士及以上」，排除的仅是专升本、成人教育、网络教育、委培定向——普通本科 + QS 前 200 硕士正好全部符合。留学生按公告时限完成留服认证即可。',
  regions: [
    {
      region: '甘肃 · 定西市（第二批，报名正在进行）',
      scope: '市直岗位：2026 QS 前 200 院校硕士及以上；县区岗位：QS 前 500 院校硕士及以上',
      window: '报名 2026-10-13 08:30 至 10-27 18:00；初审 10-14 至 10-28；未通过可改报至 10-29 12:00',
      feature: '306 个岗位 360 人（事业编 272 岗 307 人含带编入企 20 人）；报名:计划 ≤15:1 免笔试直接面试；面试 80 分合格；博士单列考核一事一议',
      sourceUrl: 'https://zk.xnrczpw.com/nindex/?ecode=dxrcyj',
      sourceName: '定西市 2026 年度第二批人才引进公告（2026-10-10 发布）',
    },
    {
      region: '湖北 · 十堰丹江口市',
      scope: '综合类：双一流建设高校或 QS2026 前 200 高校全日制硕士及以上；卫生类：全日制硕士及以上',
      window: '2026 年度引进 20 名，以当年公告时间为准',
      feature: '入职即解决非参公事业编制；年龄 30 周岁及以下（博士 35）',
      sourceUrl: 'https://www.syrsks.cn/index/index/newsview/category_id/1/id/345.html',
      sourceName: '丹江口市 2026 年公开引进高层次人才公告',
    },
    {
      region: '浙江 · 温州市（市级）',
      scope: 'ARWU / THE / QS / U.S.News 最新一期前 200 位高校硕士研究生',
      window: '2026 年度招引，以当年公告时间为准',
      feature: '31 家事业单位 213 人 + 34 家知名企业 232 人；境外学历须 2027-01-31 前取得留服认证书',
      sourceUrl: 'https://hrss.wenzhou.gov.cn/col/col1229204115/art/2026/art_81914374e8644e59ba8e700f0dac974f.html',
      sourceName: '2026 年温州市市级事业单位和知名企业公开招引优秀硕博人才公告',
    },
    {
      region: '湖北 · 咸宁崇阳县（第二批）',
      scope: '国内普通高校或 QS 前 200 世界大学全日制硕士及以上；或双一流高校全日制本科',
      window: '2026 年第二批，以当年公告时间为准',
      feature: '5 家事业单位 28 名；年龄 35 周岁以下',
      sourceUrl: 'http://www.chongyang.gov.cn/xxgk/dfbmptlj/bmxxgkpt/jtj_19091/fdzdgknr_20017/zkly_32130/202607/t20260711_5026528.shtml',
      sourceName: '湖北省崇阳县 2026 年人才引进（第二批）公告',
    },
    {
      region: '湖北 · 荆州监利市',
      scope: '国内全日制普通高等教育硕士及以上，或国（境）外 QS 前 200 世界大学同等学历',
      window: '2026 年度 64 个计划，以当年公告时间为准',
      feature: '纳入事业编制；境外毕业生须 2026-08-01 前取得留服认证书',
      sourceUrl: 'http://zwgk.jianli.gov.cn/jlsswj/12037/101220263/t123220263014/666013.shtml',
      sourceName: '监利市 2026 年事业单位人才引进公告',
    },
  ],
  tips: [
    '人才引进多数不设开考比例、免笔试直接面试——对「分数卷不赢」的人是结构性利好；定西这类 ≤15:1 免笔试的岗位，报名即拿到面试资格。',
    '专业是最大变量：综合类岗位按岗位表逐条核对专业，计算机类多在「信息技术/综合管理」岗出现；投递前把留服认证 + 专业复核材料备齐。',
    '服务期与违约条款写进协议，报名前看清最低服务年限（人才引进常见 3-5 年）。',
  ],
};

/**
 * 不设开考比例 / 低门槛考试清单——三支一扶、社区工作者、西部计划、人才引进。
 * 全部来自 2026 年度官方公告原文，逐条附来源。
 */
export const NO_RATIO_EXAMS = {
  title: '不设开考比例 / 低门槛考试：三支一扶 · 社区工作者 · 西部计划 · 人才引进',
  items: [
    {
      name: '三支一扶',
      ratio: '多数省份设 2:1~3:1 笔试开考比例，未达即核减取消；重庆 2026 明确「医疗卫生岗位未达开考比例可开考且不递减指标」',
      feature: '服务期 2 年，期满考核合格享定向招录、考研加分等政策；河南 2026 报名不收报名费',
      lowApply: '湖南邵阳城步县卫生院支医岗报名 0 人取消、邵阳县乡镇岗招 2 报 3 核减 1 人；郴州永兴县街道岗招 1 报 1 取消',
      sourceUrl: 'https://rlsbj.cq.gov.cn/zwxx_182/tzgg/202604/t20260428_15642774.html',
      sourceName: '重庆市人社局 · 2026 年三支一扶未达开考比例岗位调整公告',
    },
    {
      name: '社区工作者',
      ratio: '常见 1:3 开考比例；广西梧州万秀区 2026 明确「确因工作急需补缺，报领导小组同意后可开考，面试合格线 70 分」',
      feature: '按区县单独组织、公告密度高周期短；考试内容为公共基础知识 + 社会工作知识，满分常见 100',
      lowApply: '浙江海盐西塘桥街道岗位招 1 报 2 取消；山东龙口两岗缴费不足合并核减；海南儋州光村镇岗位无考生达合格线取消',
      sourceUrl: 'http://www.wzwxq.gov.cn/xxgk/gkbz/fdzdgknr/rsxx/zkzl/t27723290.shtml',
      sourceName: '梧州市万秀区 2026 年公开招聘专职化城市社区工作者公告',
    },
    {
      name: '西部计划',
      ratio: '没有开考比例概念——志愿服务招募，选拔（笔试/面试/心理测试）由各省项目办自行组织',
      feature: '应届毕业生或在读研究生可报；服务期 1-3 年、协议一年一签；2026 年全国拟招募约 6 万人，90% 以上岗位在乡镇及以下',
      lowApply: '竞争远低于公考：体检 + 选拔通过即可，无分数内卷；有志愿服务经历者优先录用',
      sourceUrl: 'https://xibu.youth.cn',
      sourceName: '大学生志愿服务西部计划官方网站',
    },
    {
      name: '人才引进',
      ratio: '通常不设开考比例；定西 2026 明确报名:计划 ≤15:1 免笔试直接面试',
      feature: '事业编制 + 安家/生活补贴；QS 前 200 硕士通道不看本科层次（详见上方人才引进一节）',
      lowApply: '定西第二批 306 岗 360 人正在报名（10-13 至 10-27），是当前窗口期最大的低竞争通道',
      sourceUrl: 'https://zk.xnrczpw.com/nindex/?ecode=dxrcyj',
      sourceName: '定西市 2026 年度第二批人才引进报名系统',
    },
  ],
};

/** 捡漏攻略：前端「捡漏攻略」弹层一次性取用（随 catalogs 下发） */
export const BARGAIN_GUIDE = {
  intro:
    '捡漏 = 没人报 + 我能报 + 考得起。本应用把这三件事拆成可核验的条件：五条件全中是「捡漏」，报名≈招录是「准捡漏」；下面是实时窗口、政审红线、材料清单、2026 年真实实录、人才引进绿色通道、低门槛考试清单与分数口径校准。',
  conditions: BARGAIN_CONDITIONS,
  nearConditions: NEAR_BARGAIN_CONDITIONS,
  nearMarks: NEAR_BARGAIN_MARKS,
  window: GUOKAO_2027_WINDOW,
  policeBar: RETURNEE_POLICE_BAR,
  noResume: NO_RESUME_NOTE,
  zeroTip: GUOKAO_2026_ZERO_TIP,
  rencaiQs200: RENCAI_QS200_GUIDE,
  noRatioExams: NO_RATIO_EXAMS,
  scoreCalibration: SCORE_CALIBRATION,
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
 * 已核对：2024 年度同为 90/95/105 三档（国家公务员局 2024-01-14 公布，新华社/中国青年网转载），
 * 西部地区和艰苦边远地区职位（15 省区市）总分 90、行测 45，多年稳定。
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
export function getScoreBase(key) {
  return SCORE_BASE_MAP.get(key) || null;
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
    scoreBases: SCORE_BASES,
    dataLevels: DATA_LEVELS,
    scoreBands: SCORE_BANDS,
    scoreFields: SCORE_FIELDS,
    applyFields: APPLY_FIELDS,
    bargainConditions: BARGAIN_CONDITIONS,
    nearBargainConditions: NEAR_BARGAIN_CONDITIONS,
    nearBargainMarks: NEAR_BARGAIN_MARKS,
    bargainGuide: BARGAIN_GUIDE,
    bestRecommend: BEST_RECOMMEND,
    sorts: SORTS,
  };
}
