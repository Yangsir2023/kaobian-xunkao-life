/**
 * 岗位库路由：留学生友好岗位（省份 × 专业方向 × 开考比例 × 应届生 × 上岸分）。
 *
 * 权限模型：
 *   guest  只读「公共岗位」（source=system，即种子与导入的公共行）
 *   user   可读公共岗位 + 自己录入的岗位，可新增 / 改 / 删自己的
 *   admin  可读全量、可改删任意行（用于运营排查）
 *
 * 筛选器与用户诉求一一对应：
 *   province     每一个省份
 *   majorTrack   计算机科学与技术（0812）／硕士不限专业
 *   ratioType=none  没有设置开考比例
 *   freshOnly    应届生岗位
 *   band         上岸分 50 多分 / 低于 120 分（两者是「或」的关系）
 */
import { db } from '../store/index.mjs';
import { CODES, fail, ok } from '../lib/errors.mjs';
import * as V from '../lib/validate.mjs';
import { newId, nowIso } from '../lib/ids.mjs';
import {
  PROVINCES,
  MAJOR_TRACK_KEYS,
  EXAM_TYPE_KEYS,
  RATIO_TYPE_KEYS,
  DEGREE_KEYS,
  SCORE_BASE_KEYS,
  DATA_LEVEL_KEYS,
  SCORE_BAND_KEYS,
  SORT_KEYS,
  getMajorTrack,
  getExamType,
  getRatioType,
  getDataLevel,
  getDegree,
  getScoreBase,
  matchScoreBand,
  isLowScore,
  evaluateBargain,
  evaluateNearBargain,
  isLowApply,
  effectiveApplicants,
  applyCountSource,
  applyDataIssues,
  lowApplyBasis,
  APPLY_COUNT_SOURCES,
  isDegreeFit,
  toTotalBasis,
  publicCatalogs,
  PROVINCE_POLICIES,
  PROVINCE_POLICY_DISCLAIMER,
  GUOKAO_SCORE_LINES,
  GUOKAO_SUBJECT_LINE,
  YUNNAN_2026_SCORE_LINES,
  SCORE_CALIBRATION,
  RENCAI_QS200_GUIDE,
  NO_RATIO_EXAMS,
  RETURNEE_POLICY,
  HARDSHIP_POLICY,
} from '../position-catalog.mjs';
import { SEED_POSITIONS, POSITION_DISCLAIMER } from '../position-nodes.mjs';
import { ROLES, requireRole, requireAuth, roleAtLeast } from '../security/auth.mjs';
import { writeAudit, AUDIT_ACTIONS } from '../security/audit.mjs';

const SOURCES = ['system', 'user'];
const MAX_SCORE = 300;
const IMPORT_LIMIT = 200;
function assertProvince(value) {
  if (typeof value !== 'string' || !PROVINCES.includes(value)) {
    throw fail(CODES.POSITION_BAD_PROVINCE, `省份不在支持范围内：${value ?? '(空)'}`, 400);
  }
  return value;
}

function assertMajorTrack(value) {
  if (typeof value !== 'string' || !MAJOR_TRACK_KEYS.includes(value)) {
    throw fail(CODES.POSITION_BAD_MAJOR_TRACK, `专业方向不在支持范围内：${value ?? '(空)'}`, 400);
  }
  return value;
}

function assertExamType(value) {
  if (typeof value !== 'string' || !EXAM_TYPE_KEYS.includes(value)) {
    throw fail(CODES.POSITION_BAD_EXAM_TYPE, `考试类型不在支持范围内：${value ?? '(空)'}`, 400);
  }
  return value;
}

function assertRatioType(value) {
  if (typeof value !== 'string' || !RATIO_TYPE_KEYS.includes(value)) {
    throw fail(CODES.POSITION_BAD_RATIO_TYPE, '开考比例类型只能是 none 或 ratio', 400);
  }
  return value;
}

function assertDegree(value) {
  if (typeof value !== 'string' || !DEGREE_KEYS.includes(value)) {
    throw fail(CODES.POSITION_BAD_DEGREE, `学历层次不在支持范围内：${value ?? '(空)'}`, 400);
  }
  return value;
}

/** 分数校验：允许小数（真实进面分常到两位小数，如 53.35），统一保留两位 */
function assertScore(value, field = 'score') {
  if (value === undefined || value === null || value === '') return null;
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num) || num < 0 || num > MAX_SCORE) {
    throw fail(CODES.POSITION_BAD_SCORE, `${field} 必须是 0~${MAX_SCORE} 之间的数字`, 400);
  }
  return Math.round(num * 100) / 100;
}

/** 报名人数类字段：非负整数 */
function assertCount(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num) || num < 0 || num > 1_000_000) {
    throw fail(CODES.POSITION_BAD_SCORE, `${field} 必须是非负整数`, 400);
  }
  return num;
}

/** 竞争比：非负，允许一位小数（如 39:1 存 39，2.5:1 存 2.5） */
function assertCompetition(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num) || num < 0 || num > 100_000) {
    throw fail(CODES.POSITION_BAD_SCORE, '竞争比必须是非负数字', 400);
  }
  return Math.round(num * 10) / 10;
}

/** 日期时间串（数据更新时间）：宽松校验，只为拦掉明显脏数据 */
function assertTimestamp(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const raw = String(value).trim().slice(0, 40);
  if (!/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(raw)) {
    throw fail(CODES.POSITION_INVALID_PARAMS, `${field} 格式应为 YYYY-MM-DD 或 YYYY-MM-DD HH:mm`, 400);
  }
  return raw;
}

/** 分数口径校验：total（总分）或 avg100（两科平均/合成百分制） */
function assertScoreBasis(value) {
  if (value === undefined || value === null || value === '') return 'total';
  if (typeof value !== 'string' || !SCORE_BASE_KEYS.includes(value)) {
    throw fail(CODES.POSITION_INVALID_PARAMS, `scoreBasis 只能是：${SCORE_BASE_KEYS.join(' / ')}`, 400);
  }
  return value;
}

/** 老数据没有 scoreBasis 时的兜底描述 */
const SCORE_BASE_FALLBACK = { short: '总分', name: '总分口径' };

/** 把文档转成前端契约结构（补上分类配色、分数段标记、可见性） */
export function shapePosition(doc, { viewer = null } = {}) {
  const track = getMajorTrack(doc.majorTrack);
  const exam = getExamType(doc.examType);
  const ratio = getRatioType(doc.ratioType);
  const level = getDataLevel(doc.dataLevel);
  const degree = getDegree(doc.degree);
  const basis = getScoreBase(doc.scoreBasis) || SCORE_BASE_FALLBACK;
  // 门槛分：优先取显式的 score，其次回落「最低进面分数」——
  // 老数据只有 score，新数据可能只填了三件套，两条路都要能算
  const score = Number.isFinite(doc.score)
    ? doc.score
    : Number.isFinite(doc.scoreMin)
      ? doc.scoreMin
      : null;
  const scoreMin = Number.isFinite(doc.scoreMin) ? doc.scoreMin : score;
  const scoreMax = Number.isFinite(doc.scoreMax) ? doc.scoreMax : null;
  const scoreAvg = Number.isFinite(doc.scoreAvg) ? doc.scoreAvg : null;
  const total = Number.isFinite(doc.scoreTotal) ? doc.scoreTotal : null;
  const isOwner = Boolean(viewer && doc.ownerId && doc.ownerId === viewer.id);
  // 官方合格线比对：先把进面分与合格线换到同一口径（avg100 × 2 = total）
  const officialLine = Number.isFinite(doc.officialScoreLine) ? doc.officialScoreLine : null;
  const scoreInTotal = toTotalBasis(scoreMin, doc.scoreBasis);
  const scoreLineGap = scoreInTotal != null && officialLine != null ? Math.round((scoreInTotal - officialLine) * 100) / 100 : null;
  return {
    id: doc.id,
    province: doc.province,
    examType: doc.examType,
    examTypeName: exam?.short || doc.examType,
    examTypeColor: exam?.color || '#4B5563',
    examTypeAccent: exam?.accent || '#EEF0F3',
    year: doc.year || null,
    unit: doc.unit,
    title: doc.title,
    positionCode: doc.positionCode || null,
    majorTrack: doc.majorTrack,
    majorTrackName: track?.short || doc.majorTrack,
    majorTrackColor: track?.color || '#4B5563',
    majorText: doc.majorText || '',
    degree: doc.degree,
    degreeName: degree?.short || doc.degree,
    degreeFit: isDegreeFit(doc),
    freshOnly: Boolean(doc.freshOnly),
    ratioType: doc.ratioType,
    ratioTypeName: ratio?.short || doc.ratioType,
    ratioText: doc.ratioText || '',
    // 准捡漏三条附加标记的原始事实：公告是否明确未达比例也可开考 / 是否有应届生进面 / 分数是否与上年持平
    ratioFlexible: Boolean(doc.ratioFlexible),
    freshInterview: Boolean(doc.freshInterview),
    scoreStable: Boolean(doc.scoreStable),
    prevScoreMin: Number.isFinite(doc.prevScoreMin) ? doc.prevScoreMin : null,
    // 分数口径与官方合格线： caliber 声明进面分怎么读，officialScoreLine 是按总分口径的官方门槛
    scoreBasis: doc.scoreBasis === 'avg100' ? 'avg100' : 'total',
    scoreBasisName: basis?.short || '总分',
    officialScoreLine: officialLine,
    officialScoreLineNote: doc.officialScoreLineNote || '',
    scoreInTotal,
    scoreLineGap,
    belowOfficialLine: scoreLineGap != null && scoreLineGap < 0,
    score,
    scoreMin,
    scoreMax,
    scoreAvg,
    scoreTotal: total,
    scoreNote: doc.scoreNote || '',
    lowScore: isLowScore(score),
    scoreBands: SCORE_BAND_KEYS.filter((band) => matchScoreBand(band, score)),
    competition: Number.isFinite(doc.competition) ? doc.competition : null,
    applicants: Number.isFinite(doc.applicants) ? doc.applicants : null,
    approvedCount: Number.isFinite(doc.approvedCount) ? doc.approvedCount : null,
    paidCount: Number.isFinite(doc.paidCount) ? doc.paidCount : null,
    planCount: Number.isFinite(doc.planCount) ? doc.planCount : null,
    effectiveApplicants: effectiveApplicants(doc),
    applyCountSource: applyCountSource(doc),
    applyCountSourceName: APPLY_COUNT_SOURCES[applyCountSource(doc)] || null,
    lowApply: isLowApply(doc),
    // 低报名的判定依据：公告明确未达比例（ratioShortfall）还是报名规模推算（count）
    lowApplyBasis: lowApplyBasis(doc),
    // 公告明确「报名/缴费未达开考比例」被核减或取消——低报名的公告级证据
    ratioShortfall: Boolean(doc.ratioShortfall),
    // 报名数据自检：竞争比 / 报名 / 过审 / 缴费互相矛盾时如实标出，UI 打「待核验」
    dataIssues: applyDataIssues(doc),
    dataSource: doc.dataSource || null,
    dataUpdatedAt: doc.dataUpdatedAt || null,
    dataLevel: doc.dataLevel,
    dataLevelName: level?.short || doc.dataLevel,
    dataLevelColor: level?.color || '#4B5563',
    dataLevelAccent: level?.accent || '#EEF0F3',
    // 公安政法类（人民警察）职位：留学生政审禁入，录入/导入时显式标记
    policePosition: Boolean(doc.policePosition),
    // 捡漏五条件判定：hit=true 才值得「圈出来」，conditions 供前端逐条展示
    bargain: evaluateBargain(doc),
    // 准捡漏判定：报名≈招录 + 有进面分 + 适合我；marks 标注无进面比/应届进面/分数持平
    nearBargain: evaluateNearBargain(doc),
    source: doc.source,
    owned: isOwner,
    editable: isOwner || (Boolean(viewer) && roleAtLeast(viewer.role, ROLES.ADMIN)),
    sourceUrl: doc.sourceUrl || null,
    notes: doc.notes || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** 只允许更新业务字段，防止伪造 ownerId / source / dataLevel */
function pickWritable(body) {
  const patch = {};
  if (body.province !== undefined) patch.province = assertProvince(body.province);
  if (body.examType !== undefined) patch.examType = assertExamType(body.examType);
  if (body.year !== undefined) {
    const year = Number.parseInt(body.year, 10);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw fail(CODES.POSITION_INVALID_PARAMS, 'year 需在 2000~2100 之间', 400);
    }
    patch.year = year;
  }
  if (body.unit !== undefined) patch.unit = V.str(body.unit, 'unit', { min: 2, max: 120 });
  if (body.title !== undefined) patch.title = V.str(body.title, 'title', { min: 2, max: 120 });
  if (body.positionCode !== undefined) {
    patch.positionCode = body.positionCode ? String(body.positionCode).slice(0, 40) : null;
  }
  if (body.majorTrack !== undefined) patch.majorTrack = assertMajorTrack(body.majorTrack);
  if (body.majorText !== undefined) patch.majorText = String(body.majorText || '').slice(0, 120);
  if (body.degree !== undefined) patch.degree = assertDegree(body.degree);
  if (body.freshOnly !== undefined) patch.freshOnly = Boolean(body.freshOnly);
  if (body.ratioType !== undefined) patch.ratioType = assertRatioType(body.ratioType);
  if (body.ratioText !== undefined) patch.ratioText = String(body.ratioText || '').slice(0, 300);
  // 未达开考比例也可开考 / 不递减指标（如重庆三支一扶医疗卫生岗）：准捡漏「无进面比」标记的依据
  if (body.ratioFlexible !== undefined) patch.ratioFlexible = Boolean(body.ratioFlexible);
  // 公告明确未达开考比例被核减/取消：低报名的公告级证据
  if (body.ratioShortfall !== undefined) patch.ratioShortfall = Boolean(body.ratioShortfall);
  // 公安政法类（人民警察）职位标记：捡漏五条件里「留学生政审安全」的判定依据
  if (body.policePosition !== undefined) patch.policePosition = Boolean(body.policePosition);
  // 有应届生进面：准捡漏「应届进面」标记的依据
  if (body.freshInterview !== undefined) patch.freshInterview = Boolean(body.freshInterview);
  // 招录人数：准捡漏「报名≈招录」的判定基数
  if (body.planCount !== undefined) patch.planCount = assertCount(body.planCount, 'planCount');
  if (body.score !== undefined) patch.score = assertScore(body.score);
  if (body.scoreMin !== undefined) patch.scoreMin = assertScore(body.scoreMin, 'scoreMin');
  if (body.scoreMax !== undefined) patch.scoreMax = assertScore(body.scoreMax, 'scoreMax');
  if (body.scoreAvg !== undefined) patch.scoreAvg = assertScore(body.scoreAvg, 'scoreAvg');
  if (body.scoreTotal !== undefined) patch.scoreTotal = assertScore(body.scoreTotal, 'scoreTotal');
  // 分数口径 + 官方合格线：避免「200 分考 53.35」类口径误读，低于合格线自动标记待核验
  if (body.scoreBasis !== undefined) patch.scoreBasis = assertScoreBasis(body.scoreBasis);
  if (body.officialScoreLine !== undefined) patch.officialScoreLine = assertScore(body.officialScoreLine, 'officialScoreLine');
  if (body.officialScoreLineNote !== undefined) patch.officialScoreLineNote = String(body.officialScoreLineNote || '').slice(0, 120);
  // 分数与上年持平：录入时对照上年数据勾选
  if (body.scoreStable !== undefined) patch.scoreStable = Boolean(body.scoreStable);
  if (body.prevScoreMin !== undefined) patch.prevScoreMin = assertScore(body.prevScoreMin, 'prevScoreMin');
  if (body.competition !== undefined) patch.competition = assertCompetition(body.competition);
  if (body.applicants !== undefined) patch.applicants = assertCount(body.applicants, 'applicants');
  if (body.approvedCount !== undefined) patch.approvedCount = assertCount(body.approvedCount, 'approvedCount');
  if (body.paidCount !== undefined) patch.paidCount = assertCount(body.paidCount, 'paidCount');
  if (body.dataSource !== undefined) patch.dataSource = String(body.dataSource || '').slice(0, 120);
  if (body.dataUpdatedAt !== undefined) {
    patch.dataUpdatedAt = assertTimestamp(body.dataUpdatedAt, 'dataUpdatedAt');
  }
  if (body.scoreNote !== undefined) patch.scoreNote = String(body.scoreNote || '').slice(0, 120);
  if (body.sourceUrl !== undefined) {
    patch.sourceUrl = V.httpUrl(body.sourceUrl, 'sourceUrl', { required: false });
  }
  if (body.notes !== undefined) patch.notes = String(body.notes || '').slice(0, 2000);
  return patch;
}

/** 公共岗位对游客可见；用户录入的只对本人与管理员可见 */
function visibilityFilter(identity) {
  if (identity?.authenticated) {
    if (roleAtLeast(identity.role, ROLES.ADMIN)) return null; // 管理员看全量
    return { $or: [{ source: 'system' }, { ownerId: identity.user.id }] };
  }
  return { source: 'system' };
}

export function registerPositionRoutes(router) {
  /* ── 目录与政策基线（游客可读，前端筛选器与说明页共用） ── */
  router.get('/api/positions/catalogs', async () =>
    ok({
      ...publicCatalogs(),
      disclaimer: POSITION_DISCLAIMER,
    })
  );

  router.get('/api/positions/policies', async () =>
    ok({
      guokaoScoreLines: GUOKAO_SCORE_LINES,
      guokaoSubjectLine: GUOKAO_SUBJECT_LINE,
      yunnanScoreLines: YUNNAN_2026_SCORE_LINES,
      scoreCalibration: SCORE_CALIBRATION,
      rencaiQs200: RENCAI_QS200_GUIDE,
      noRatioExams: NO_RATIO_EXAMS,
      returneePolicy: RETURNEE_POLICY,
      hardshipPolicy: HARDSHIP_POLICY,
      provincePolicies: PROVINCE_POLICIES,
      disclaimer: PROVINCE_POLICY_DISCLAIMER,
    })
  );

  /* ── 列表 ───────────────────────────────────────────── */
  router.get('/api/positions', async (ctx) => {
    const identity = ctx.identity;
    const provinceParam = ctx.query.get('province');
    // 省份支持多选（逗号分隔），逐个走 assertProvince，保证错误码是 2012 而不是笼统的 1001
    let provinces = [];
    if (provinceParam) {
      provinces = [...new Set(provinceParam.split(',').map((s) => s.trim()).filter(Boolean))];
      for (const p of provinces) assertProvince(p);
    }
    const examType = V.oneOf(ctx.query.get('examType'), EXAM_TYPE_KEYS, 'examType', { fallback: null });
    const majorTrack = V.oneOf(ctx.query.get('majorTrack'), MAJOR_TRACK_KEYS, 'majorTrack', { fallback: null });
    const ratioType = V.oneOf(ctx.query.get('ratioType'), RATIO_TYPE_KEYS, 'ratioType', { fallback: null });
    const degree = V.oneOf(ctx.query.get('degree'), DEGREE_KEYS, 'degree', { fallback: null });
    const dataLevel = V.oneOf(ctx.query.get('dataLevel'), DATA_LEVEL_KEYS, 'dataLevel', { fallback: null });
    const sort = V.oneOf(ctx.query.get('sort'), SORT_KEYS, 'sort', { fallback: 'score_asc' });
    const q = (ctx.query.get('q') || '').trim().slice(0, 60);
    const maxScore = V.intInRange(ctx.query.get('maxScore'), 'maxScore', { min: 0, max: MAX_SCORE, fallback: null });
    const limit = V.intInRange(ctx.query.get('limit'), 'limit', { min: 1, max: 200, fallback: 100 });
    const offset = V.intInRange(ctx.query.get('offset'), 'offset', { min: 0, max: 10000, fallback: 0 });

    const freshOnlyRaw = ctx.query.get('freshOnly');
    let freshOnly = null;
    if (freshOnlyRaw === 'true' || freshOnlyRaw === '1') freshOnly = true;
    else if (freshOnlyRaw === 'false' || freshOnlyRaw === '0') freshOnly = false;
    else if (freshOnlyRaw) throw fail(CODES.POSITION_INVALID_PARAMS, 'freshOnly 只能是 true / false', 400);

    // 捡漏专区：只返回五条件全中的岗位（零报名 + 不设开考比例 + 专业对口 + 学历达标 + 留学生政审安全）
    const bargainRaw = ctx.query.get('bargain');
    let bargain = null;
    if (bargainRaw === 'true' || bargainRaw === '1') bargain = true;
    else if (bargainRaw === 'false' || bargainRaw === '0') bargain = false;
    else if (bargainRaw) throw fail(CODES.POSITION_INVALID_PARAMS, 'bargain 只能是 true / false', 400);

    // 准捡漏专区：报名≈招录 + 有进面分 + 适合我（命中行 + 低竞争候选行都返回，前端分区展示）
    const nearRaw = ctx.query.get('nearBargain');
    let nearBargain = null;
    if (nearRaw === 'true' || nearRaw === '1') nearBargain = true;
    else if (nearRaw === 'false' || nearRaw === '0') nearBargain = false;
    else if (nearRaw) throw fail(CODES.POSITION_INVALID_PARAMS, 'nearBargain 只能是 true / false', 400);

    // 低报名专区：有效报名人数不超过招录人数 1.5 倍（或仅多两三个人）
    const lowApplyRaw = ctx.query.get('lowApply');
    let lowApply = null;
    if (lowApplyRaw === 'true' || lowApplyRaw === '1') lowApply = true;
    else if (lowApplyRaw === 'false' || lowApplyRaw === '0') lowApply = false;
    else if (lowApplyRaw) throw fail(CODES.POSITION_INVALID_PARAMS, 'lowApply 只能是 true / false', 400);

    // 分数段支持多选（逗号分隔），命中任一口径即算低分上岸
    const bandParam = ctx.query.get('band');
    let bands = [];
    if (bandParam) {
      bands = [...new Set(bandParam.split(',').map((s) => s.trim()).filter(Boolean))];
      for (const band of bands) {
        if (!SCORE_BAND_KEYS.includes(band)) {
          throw fail(CODES.POSITION_BAD_BAND, `分数段只能是：${SCORE_BAND_KEYS.join(' / ')}`, 400);
        }
      }
    }

    const filter = { ...(visibilityFilter(identity) || {}) };
    if (provinces.length === 1) filter.province = provinces[0];
    else if (provinces.length > 1) filter.province = { $in: provinces };
    if (examType) filter.examType = examType;
    if (majorTrack) filter.majorTrack = majorTrack;
    if (ratioType) filter.ratioType = ratioType;
    if (degree) filter.degree = degree;
    if (dataLevel) filter.dataLevel = dataLevel;
    if (freshOnly !== null) filter.freshOnly = freshOnly;

    const rows = await db.positions().find(filter);
    let shaped = rows.map((doc) => shapePosition(doc, { viewer: identity?.user || null }));

    if (bands.length) {
      shaped = shaped.filter((row) => bands.some((band) => row.scoreBands.includes(band)));
    }
    if (maxScore != null) {
      shaped = shaped.filter((row) => row.score != null && row.score <= maxScore);
    }
    if (q) {
      const needle = q.toLowerCase();
      shaped = shaped.filter(
        (row) =>
          row.title.toLowerCase().includes(needle) ||
          row.unit.toLowerCase().includes(needle) ||
          (row.majorText || '').toLowerCase().includes(needle) ||
          (row.notes || '').toLowerCase().includes(needle) ||
          (row.positionCode || '').includes(needle)
      );
    }
    if (bargain === true) {
      shaped = shaped.filter((row) => row.bargain.hit);
    }
    if (nearBargain === true) {
      shaped = shaped.filter((row) => row.nearBargain.hit || row.nearBargain.partial);
    }
    if (lowApply === true) {
      shaped = shaped.filter((row) => row.lowApply);
    }

    const stats = {
      total: shaped.length,
      lowScore: shaped.filter((row) => row.lowScore).length,
      noRatio: shaped.filter((row) => row.ratioType === 'none').length,
      freshOnly: shaped.filter((row) => row.freshOnly).length,
      provinces: [...new Set(shaped.map((row) => row.province))].length,
      withScore: shaped.filter((row) => row.score != null).length,
      thirdparty: shaped.filter((row) => row.dataLevel === 'thirdparty').length,
      zeroApply: shaped.filter((row) => row.applicants === 0).length,
      lowApply: shaped.filter((row) => row.lowApply).length,
      bargain: shaped.filter((row) => row.bargain.hit).length,
      nearBargain: shaped.filter((row) => row.nearBargain.hit).length,
      nearPartial: shaped.filter((row) => row.nearBargain.partial && !row.nearBargain.hit).length,
    };

    if (sort === 'score_desc') shaped.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    else if (sort === 'created_desc') shaped.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    else shaped.sort((a, b) => (a.score ?? Number.MAX_SAFE_INTEGER) - (b.score ?? Number.MAX_SAFE_INTEGER));

    const page = shaped.slice(offset, offset + limit);
    return ok({
      count: shaped.length,
      stats,
      filters: { provinces, examType, majorTrack, ratioType, degree, freshOnly, bands, maxScore, q, sort, bargain, nearBargain, lowApply },
      positions: page,
      page: { limit, offset, hasMore: offset + limit < shaped.length },
    });
  });

  /* ── 详情 ───────────────────────────────────────────── */
  router.get('/api/positions/:id', async (ctx) => {
    const identity = ctx.identity;
    const doc = await db.positions().findById(ctx.params.id);
    if (!doc) throw fail(CODES.POSITION_NOT_FOUND, undefined, 404);

    const isSystem = doc.source === 'system';
    const isOwner = identity?.authenticated && doc.ownerId === identity.user.id;
    const isAdmin = identity?.authenticated && roleAtLeast(identity.role, ROLES.ADMIN);
    if (!isSystem && !isOwner && !isAdmin) {
      await writeAudit({
        action: AUDIT_ACTIONS.REMINDER_ACCESS_DENIED,
        ctx,
        actor: identity?.authenticated ? identity.user : null,
        target: `position:${doc.id}`,
        result: 'failure',
        message: '尝试访问他人录入的岗位详情',
      });
      throw fail(CODES.FORBIDDEN_RESOURCE, undefined, 403);
    }
    return ok({ position: shapePosition(doc, { viewer: identity?.user || null }) });
  });

  /* ── 新增（登录用户） ───────────────────────────────── */
  router.post('/api/positions', async (ctx) => {
    const identity = requireRole(ctx, ROLES.USER);
    const body = ctx.body || {};

    const doc = await db.positions().insertOne({
      id: newId('pos'),
      ownerId: identity.user.id,
      source: 'user',
      dataLevel: 'user',
      province: assertProvince(body.province),
      examType: assertExamType(body.examType),
      year: body.year ? Number.parseInt(body.year, 10) : null,
      unit: V.str(body.unit, 'unit', { min: 2, max: 120 }),
      title: V.str(body.title, 'title', { min: 2, max: 120 }),
      positionCode: body.positionCode ? String(body.positionCode).slice(0, 40) : null,
      majorTrack: assertMajorTrack(body.majorTrack),
      majorText: String(body.majorText || '').slice(0, 120),
      degree: body.degree ? assertDegree(body.degree) : 'master',
      freshOnly: Boolean(body.freshOnly),
      ratioType: assertRatioType(body.ratioType),
      ratioText: String(body.ratioText || '').slice(0, 300),
      ratioFlexible: Boolean(body.ratioFlexible),
      ratioShortfall: Boolean(body.ratioShortfall),
      policePosition: Boolean(body.policePosition),
      freshInterview: Boolean(body.freshInterview),
      planCount: assertCount(body.planCount, 'planCount'),
      score: assertScore(body.score),
      scoreMin: assertScore(body.scoreMin, 'scoreMin'),
      scoreMax: assertScore(body.scoreMax, 'scoreMax'),
      scoreAvg: assertScore(body.scoreAvg, 'scoreAvg'),
      scoreTotal: assertScore(body.scoreTotal, 'scoreTotal') ?? 200,
      scoreBasis: assertScoreBasis(body.scoreBasis),
      officialScoreLine: assertScore(body.officialScoreLine, 'officialScoreLine'),
      officialScoreLineNote: String(body.officialScoreLineNote || '').slice(0, 120),
      scoreStable: Boolean(body.scoreStable),
      prevScoreMin: assertScore(body.prevScoreMin, 'prevScoreMin'),
      scoreNote: String(body.scoreNote || '').slice(0, 120),
      competition: assertCompetition(body.competition),
      applicants: assertCount(body.applicants, 'applicants'),
      approvedCount: assertCount(body.approvedCount, 'approvedCount'),
      paidCount: assertCount(body.paidCount, 'paidCount'),
      dataSource: String(body.dataSource || '').slice(0, 120),
      dataUpdatedAt: assertTimestamp(body.dataUpdatedAt, 'dataUpdatedAt'),
      sourceUrl: V.httpUrl(body.sourceUrl, 'sourceUrl', { required: false }),
      notes: body.notes ? String(body.notes).slice(0, 2000) : '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    await writeAudit({
      action: AUDIT_ACTIONS.REMINDER_CREATED,
      ctx,
      actor: identity.user,
      target: `position:${doc.id}`,
      message: `录入岗位「${doc.province} · ${doc.title}」`,
      meta: { province: doc.province, examType: doc.examType, score: doc.score },
    });
    return ok({ position: shapePosition(doc, { viewer: identity.user }) }, '岗位已录入');
  });

  /* ── 编辑（本人或管理员） ───────────────────────────── */
  router.patch('/api/positions/:id', async (ctx) => {
    const identity = requireRole(ctx, ROLES.USER);
    const doc = await db.positions().findById(ctx.params.id);
    if (!doc) throw fail(CODES.POSITION_NOT_FOUND, undefined, 404);

    const isOwner = doc.ownerId === identity.user.id;
    const isAdmin = roleAtLeast(identity.role, ROLES.ADMIN);
    if (!isOwner && !isAdmin) {
      await writeAudit({
        action: AUDIT_ACTIONS.REMINDER_ACCESS_DENIED,
        ctx,
        actor: identity.user,
        target: `position:${doc.id}`,
        result: 'failure',
        message: '尝试修改他人录入的岗位',
      });
      throw fail(CODES.FORBIDDEN_RESOURCE, undefined, 403);
    }

    const patch = { ...pickWritable(ctx.body || {}), updatedAt: nowIso() };
    const updated = await db.positions().updateById(doc.id, patch);
    await writeAudit({
      action: AUDIT_ACTIONS.REMINDER_UPDATED,
      ctx,
      actor: identity.user,
      target: `position:${doc.id}`,
      message: `更新岗位「${updated.province} · ${updated.title}」`,
      meta: { fields: Object.keys(patch).filter((k) => k !== 'updatedAt') },
    });
    return ok({ position: shapePosition(updated, { viewer: identity.user }) }, '已保存');
  });

  /* ── 删除（本人或管理员） ───────────────────────────── */
  router.delete('/api/positions/:id', async (ctx) => {
    const identity = requireRole(ctx, ROLES.USER);
    const doc = await db.positions().findById(ctx.params.id);
    if (!doc) throw fail(CODES.POSITION_NOT_FOUND, undefined, 404);

    const isOwner = doc.ownerId === identity.user.id;
    const isAdmin = roleAtLeast(identity.role, ROLES.ADMIN);
    if (!isOwner && !isAdmin) {
      await writeAudit({
        action: AUDIT_ACTIONS.REMINDER_ACCESS_DENIED,
        ctx,
        actor: identity.user,
        target: `position:${doc.id}`,
        result: 'failure',
        message: '尝试删除他人录入的岗位',
      });
      throw fail(CODES.FORBIDDEN_RESOURCE, undefined, 403);
    }

    await db.positions().deleteById(doc.id);
    await writeAudit({
      action: AUDIT_ACTIONS.REMINDER_DELETED,
      ctx,
      actor: identity.user,
      target: `position:${doc.id}`,
      message: `删除岗位「${doc.province} · ${doc.title}」`,
      meta: { ownerId: doc.ownerId, byAdmin: !isOwner && isAdmin },
    });
    return ok({ deleted: true });
  });

  /* ── 批量导入（登录用户，把官方职位表整理成 JSON 后一次性灌入） ── */
  router.post('/api/positions/import', async (ctx) => {
    const identity = requireRole(ctx, ROLES.USER);
    const list = ctx.body?.positions;
    if (!Array.isArray(list) || list.length === 0) {
      throw fail(CODES.POSITION_IMPORT_EMPTY, 'positions 应为非空数组', 400);
    }
    if (list.length > IMPORT_LIMIT) {
      throw fail(CODES.POSITION_IMPORT_TOO_MANY, `单次最多导入 ${IMPORT_LIMIT} 条`, 400);
    }

    const rows = list.map((item, index) => {
      try {
        return {
          id: newId('pos'),
          ownerId: identity.user.id,
          source: 'user',
          dataLevel: 'user',
          province: assertProvince(item.province),
          examType: assertExamType(item.examType),
          year: item.year ? Number.parseInt(item.year, 10) : null,
          unit: V.str(item.unit, `positions[${index}].unit`, { min: 2, max: 120 }),
          title: V.str(item.title, `positions[${index}].title`, { min: 2, max: 120 }),
          positionCode: item.positionCode ? String(item.positionCode).slice(0, 40) : null,
          majorTrack: assertMajorTrack(item.majorTrack),
          majorText: String(item.majorText || '').slice(0, 120),
          degree: item.degree ? assertDegree(item.degree) : 'master',
        freshOnly: Boolean(item.freshOnly),
        ratioType: assertRatioType(item.ratioType),
        ratioText: String(item.ratioText || '').slice(0, 300),
        policePosition: Boolean(item.policePosition),
        ratioFlexible: Boolean(item.ratioFlexible),
        ratioShortfall: Boolean(item.ratioShortfall),
        freshInterview: Boolean(item.freshInterview),
        planCount: assertCount(item.planCount, 'planCount'),
          score: assertScore(item.score),
          scoreMin: assertScore(item.scoreMin, 'scoreMin'),
          scoreMax: assertScore(item.scoreMax, 'scoreMax'),
          scoreAvg: assertScore(item.scoreAvg, 'scoreAvg'),
          scoreTotal: assertScore(item.scoreTotal, 'scoreTotal') ?? 200,
          scoreBasis: assertScoreBasis(item.scoreBasis),
          officialScoreLine: assertScore(item.officialScoreLine, 'officialScoreLine'),
          officialScoreLineNote: String(item.officialScoreLineNote || '').slice(0, 120),
          scoreStable: Boolean(item.scoreStable),
          prevScoreMin: assertScore(item.prevScoreMin, 'prevScoreMin'),
          scoreNote: String(item.scoreNote || '').slice(0, 120),
          competition: assertCompetition(item.competition),
          applicants: assertCount(item.applicants, 'applicants'),
          approvedCount: assertCount(item.approvedCount, 'approvedCount'),
          paidCount: assertCount(item.paidCount, 'paidCount'),
          dataSource: String(item.dataSource || '').slice(0, 120),
          dataUpdatedAt: assertTimestamp(item.dataUpdatedAt, 'dataUpdatedAt'),
          sourceUrl: V.httpUrl(item.sourceUrl, 'sourceUrl', { required: false }),
          notes: item.notes ? String(item.notes).slice(0, 2000) : '',
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
      } catch (err) {
        throw fail(err.code || CODES.POSITION_INVALID_PARAMS, `第 ${index + 1} 条：${err.message}`, 400);
      }
    });

    const inserted = await db.positions().insertMany(rows);
    await writeAudit({
      action: AUDIT_ACTIONS.REMINDER_CREATED,
      ctx,
      actor: identity.user,
      target: 'positions:import',
      message: `批量导入 ${inserted.length} 条岗位`,
      meta: { count: inserted.length },
    });
    return ok({ imported: inserted.length, positions: inserted.map((d) => shapePosition(d, { viewer: identity.user })) }, `已导入 ${inserted.length} 条`);
  });

  /* ── 汇总统计（岗位页顶部卡片） ─────────────────────── */
  router.get('/api/positions/stats/summary', async (ctx) => {
    const identity = ctx.identity;
    const filter = { ...(visibilityFilter(identity) || {}) };
    const rows = await db.positions().find(filter);
    const shaped = rows.map((doc) => shapePosition(doc, { viewer: identity?.user || null }));

    const byProvince = {};
    for (const row of shaped) byProvince[row.province] = (byProvince[row.province] || 0) + 1;

    return ok({
      total: shaped.length,
      lowScore: shaped.filter((row) => row.lowScore).length,
      noRatio: shaped.filter((row) => row.ratioType === 'none').length,
      freshOnly: shaped.filter((row) => row.freshOnly).length,
      csTrack: shaped.filter((row) => row.majorTrack === 'cs0812' || row.majorTrack === 'both').length,
      masterAny: shaped.filter((row) => row.majorTrack === 'master_any' || row.majorTrack === 'both').length,
      zeroApply: shaped.filter((row) => row.applicants === 0).length,
      lowApply: shaped.filter((row) => row.lowApply).length,
      bargain: shaped.filter((row) => row.bargain.hit).length,
      nearBargain: shaped.filter((row) => row.nearBargain.hit).length,
      seedCount: SEED_POSITIONS.length,
      provinces: Object.entries(byProvince)
        .map(([province, count]) => ({ province, count }))
        .sort((a, b) => b.count - a.count),
    });
  });
}
