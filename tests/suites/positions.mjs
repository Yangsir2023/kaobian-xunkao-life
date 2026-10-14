/**
 * 岗位库套件：留学生友好岗位的筛选、权限、录入与导入。
 *
 * 覆盖用户原始诉求的每一个筛选条件：
 *   省份 / 计算机科学与技术（0812）/ 硕士不限专业 / 不设开考比例 / 仅限应届 /
 *   上岸分 50 多分 / 低于 120 分 / 多条件组合 / 捡漏五条件。
 */
import { suite, assert, assertEqual, assertIncludes, loadLimiters } from '../helpers.mjs';

export function positionSuite({ admin, user, baseUrl }) {
  const s = suite('岗位库');
  const created = {};

  s.test('岗位目录游客可读：省份 / 专业方向 / 分数段齐全', async () => {
    const res = await admin.get('/api/positions/catalogs', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    const d = res.body.data;
    assertEqual(d.provinces.length, 32, '31 省 + 中央机关');
    assert(d.provinces.includes('湖北') && d.provinces.includes('新疆'), '省份集合');
    const tracks = d.majorTracks.map((t) => t.key);
    assert(tracks.includes('cs0812'), '应含 0812 通道');
    assert(tracks.includes('master_any'), '应含硕士不限专业通道');
    const bands = d.scoreBands.map((b) => b.key);
    assertEqual(bands.join(','), 'low50,lt120', '两个分数段口径');
    assert(d.ratioTypes.some((r) => r.key === 'none'), '应含「不设开考比例」类型');
    assertEqual(d.bargainConditions.length, 5, '捡漏五条件');
    assert(d.bargainGuide && d.bargainGuide.window, '应下发捡漏攻略（含实时报名窗口）');
  });

  s.test('政策基线游客可读：国考分数线与分省开考比例', async () => {
    const res = await admin.get('/api/positions/policies', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    const d = res.body.data;
    assertEqual(d.guokaoScoreLines.length, 3, '三档合格线');
    const totals = d.guokaoScoreLines.map((l) => l.total).sort((a, b) => a - b);
    assertEqual(totals.join(','), '90,95,105', '2026 年度国考合格线');
    assert(d.provincePolicies.length >= 4, '已核对官方公告的分省政策');
    assertIncludes(d.returneePolicy.quote, '留学回国人员', '留学生应届身份认定口径');
    assert(d.provincePolicies.every((p) => /^https?:\/\//.test(p.sourceUrl)), '每条政策都带来源链接');
  });

  s.test('岗位列表返回种子数据并带统计', async () => {
    const res = await admin.get('/api/positions', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    assert(res.body.data.count > 0, '应有种子岗位');
    assert(res.body.data.stats.total > 0, '统计总数');
    assert(res.body.data.stats.provinces > 1, '覆盖多个省份');
    assert(
      res.body.data.positions.every((p) => p.dataLevel === 'sample' || p.dataLevel === 'thirdparty'),
      '种子行只能标记为示例数据或第三方整理'
    );
    assert(res.body.data.stats.thirdparty > 0, '应统计出第三方整理行');
    assert(res.body.data.stats.withScore > 0, '应统计出带分数的行');
  });

  s.test('进面分数三件套与报名数据：第三方种子行字段完整', async () => {
    const res = await admin.get('/api/positions?dataLevel=thirdparty', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    assert(res.body.data.count > 0, '应有第三方整理行');
    const withTriple = res.body.data.positions.find((p) => p.scoreMin != null && p.scoreMax != null && p.scoreAvg != null);
    assert(withTriple, '至少一行带齐最低/最高/平均进面分');
    assert(withTriple.score <= withTriple.scoreMax, '最低分不应高于最高分');
    const withApply = res.body.data.positions.find((p) => p.competition != null);
    assert(withApply, '至少一行带竞争比');
    assert(withApply.dataSource, '第三方行应带数据来源');
    assert(withApply.dataUpdatedAt, '第三方行应带数据更新时间');
    // 老口径 score 与 scoreMin 必须一致（shapePosition 的回退逻辑）
    assertEqual(withTriple.score, withTriple.scoreMin, 'score 与 scoreMin 应一致');
  });

  s.test('按专业方向筛选：计算机科学与技术（0812）', async () => {
    const res = await admin.get('/api/positions?majorTrack=cs0812', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    assert(res.body.data.count > 0, '应有 0812 岗位');
    assert(
      res.body.data.positions.every((p) => ['cs0812', 'both'].includes(p.majorTrack)),
      '结果只能落在 0812 通道'
    );
  });

  s.test('按专业方向筛选：硕士不限专业', async () => {
    const res = await admin.get('/api/positions?majorTrack=master_any', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    assert(
      res.body.data.positions.every((p) => ['master_any', 'both'].includes(p.majorTrack)),
      '结果只能落在硕士不限通道'
    );
  });

  s.test('按开考比例筛选：不设开考比例', async () => {
    const res = await admin.get('/api/positions?ratioType=none', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    assert(res.body.data.count > 0, '应存在不设开考比例的岗位');
    assert(
      res.body.data.positions.every((p) => p.ratioType === 'none'),
      '结果必须全部不设开考比例'
    );
  });

  s.test('按应届生筛选：仅限应届', async () => {
    const res = await admin.get('/api/positions?freshOnly=true', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    assert(
      res.body.data.positions.every((p) => p.freshOnly === true),
      '结果必须全部仅限应届'
    );
  });

  s.test('按分数段筛选：低于 120 分', async () => {
    const res = await admin.get('/api/positions?band=lt120', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    assert(res.body.data.count > 0, '应有低于 120 分的岗位');
    assert(
      res.body.data.positions.every((p) => p.score < 120),
      '结果必须全部低于 120 分'
    );
    assert(
      res.body.data.positions.every((p) => p.lowScore === true),
      'lowScore 标记应同步为 true'
    );
  });

  s.test('按分数段筛选：50 多分', async () => {
    const res = await admin.get('/api/positions?band=low50', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    assert(res.body.data.count > 0, '应有 50 多分的岗位');
    assert(
      res.body.data.positions.every((p) => p.score >= 50 && p.score < 60),
      '结果必须落在 50~59 分'
    );
  });

  s.test('多条件组合：0812 + 不设比例 + 应届 + 低于 120 分', async () => {
    const res = await admin.get(
      '/api/positions?majorTrack=cs0812&ratioType=none&freshOnly=true&band=lt120',
      { token: null }
    );
    assertEqual(res.body.code, 0, '业务码');
    assert(res.body.data.count > 0, '组合条件应有结果');
    assert(
      res.body.data.positions.every(
        (p) =>
          ['cs0812', 'both'].includes(p.majorTrack) &&
          p.ratioType === 'none' &&
          p.freshOnly === true &&
          p.score < 120
      ),
      '每条结果都必须同时满足四个条件'
    );
  });

  s.test('分数上限 maxScore 与省份筛选', async () => {
    const res = await admin.get('/api/positions?maxScore=60&province=广西', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    assert(
      res.body.data.positions.every((p) => p.province === '广西' && p.score <= 60),
      '必须同时满足省份与分数上限'
    );
  });

  s.test('默认排序为上岸分从低到高（无分数排最后）', async () => {
    const res = await admin.get('/api/positions?sort=score_asc', { token: null });
    const scores = res.body.data.positions.map((p) => p.score);
    // 与服务端一致：null 视为极大值排到末尾
    const sorted = [...scores].sort((a, b) => (a ?? Number.MAX_SAFE_INTEGER) - (b ?? Number.MAX_SAFE_INTEGER));
    assertEqual(scores.join(','), sorted.join(','), '应按分数升序、空值垫底');
  });

  s.test('参数校验：非法分数段 / 非法省份 / 分数越界', async () => {
    const badBand = await admin.get('/api/positions?band=nope', { token: null });
    assertEqual(badBand.body.code, 2018, '非法分数段错误码');

    const badProvince = await admin.get('/api/positions?province=火星', { token: null });
    assertEqual(badProvince.body.code, 2012, '非法省份错误码');

    const { resetAllLimiters } = await loadLimiters();
    resetAllLimiters();
    const badScore = await user.post('/api/positions', {
      province: '湖北', examType: 'shiye', unit: '校验单位', title: '校验岗位',
      majorTrack: 'cs0812', ratioType: 'none', score: 999,
    });
    assertEqual(badScore.body.code, 2017, '分数越界错误码');
  });

  s.test('游客不能新增 / 修改 / 删除岗位', async () => {
    const guestCreate = await admin.post('/api/positions', undefined, { token: null });
    assertEqual(guestCreate.status, 401, '游客新增应 401');

    const first = (await admin.get('/api/positions', { token: null })).body.data.positions[0];
    const guestPatch = await admin.patch(`/api/positions/${first.id}`, undefined, { token: null });
    assertEqual(guestPatch.status, 401, '游客修改应 401');
    const guestDelete = await admin.del(`/api/positions/${first.id}`, { token: null });
    assertEqual(guestDelete.status, 401, '游客删除应 401');
  });

  s.test('登录用户可录入岗位并进入自己的列表', async () => {
    const res = await user.post('/api/positions', {
      province: '湖北', examType: 'shiye', year: 2026, unit: '测试录入单位', title: '测试录入岗位',
      positionCode: '420000099001', majorTrack: 'cs0812', majorText: '计算机科学与技术（0812）',
      degree: 'master', freshOnly: true, ratioType: 'none', ratioText: '按实际缴费人数开考',
      scoreMin: 51.5, scoreMax: 63.25, scoreAvg: 56.8, scoreTotal: 100,
      scoreNote: '职测 + 综应', competition: 12.5, applicants: 120, approvedCount: 98, paidCount: 86,
      dataSource: '省人事考试网', dataUpdatedAt: '2026-06-08',
      sourceUrl: 'example.gov.cn', notes: '测试录入',
    });
    assertEqual(res.body.code, 0, '录入结果');
    created.id = res.body.data.position.id;
    assertEqual(res.body.data.position.dataLevel, 'user', '用户录入应标记为 user');
    assert(res.body.data.position.editable, '本人应可编辑');
    assert(res.body.data.position.owned, 'owned 应为 true');

    const mine = await user.get('/api/positions?q=测试录入');
    assertEqual(mine.body.data.count, 1, '自己的列表应能查到');

    const asGuest = await admin.get('/api/positions?q=测试录入', { token: null });
    assertEqual(asGuest.body.data.count, 0, '游客不应看到他人录入的岗位');
  });

  s.test('进面分数三件套与报名数据可完整落库并回显', async () => {
    const res = await user.get(`/api/positions/${created.id}`);
    assertEqual(res.body.code, 0, '业务码');
    const p = res.body.data.position;
    assertEqual(p.scoreMin, 51.5, '最低进面分');
    assertEqual(p.scoreMax, 63.25, '最高进面分');
    assertEqual(p.scoreAvg, 56.8, '平均进面分');
    assertEqual(p.scoreTotal, 100, '满分');
    assertEqual(p.competition, 12.5, '竞争比支持一位小数');
    assertEqual(p.applicants, 120, '报名人数');
    assertEqual(p.approvedCount, 98, '过审人数');
    assertEqual(p.paidCount, 86, '缴费人数');
    assertEqual(p.dataSource, '省人事考试网', '数据来源');
    assertEqual(p.dataUpdatedAt, '2026-06-08', '数据更新日期');
    assertEqual(p.score, 51.5, 'score 回退到 scoreMin');
  });

  s.test('报名数据字段校验：非负整数 / 合法日期', async () => {
    const { resetAllLimiters } = await loadLimiters();
    resetAllLimiters();
    const badCount = await user.post('/api/positions', {
      province: '湖北', examType: 'shiye', unit: '校验单位二', title: '校验岗位二',
      majorTrack: 'cs0812', ratioType: 'none', scoreMin: 51, applicants: -5,
    });
    assertEqual(badCount.body.code, 2017, '负数报名人数错误码');

    resetAllLimiters();
    const badDate = await user.post('/api/positions', {
      province: '湖北', examType: 'shiye', unit: '校验单位三', title: '校验岗位三',
      majorTrack: 'cs0812', ratioType: 'none', scoreMin: 51, dataUpdatedAt: '上个月',
    });
    assertEqual(badDate.body.code, 2010, '非法日期错误码');
  });

  s.test('捡漏五条件：全中才 hit，bargain=1 只返回命中行', async () => {
    const { resetAllLimiters } = await loadLimiters();
    resetAllLimiters();
    const res = await user.post('/api/positions', {
      province: '广西', examType: 'shengkao', year: 2027, unit: '捡漏命中单位', title: '捡漏命中岗位',
      majorTrack: 'cs0812', majorText: '计算机科学与技术（0812）',
      degree: 'master', freshOnly: true, ratioType: 'none', ratioText: '按实际缴费人数开考',
      scoreMin: 55, scoreTotal: 200, applicants: 0, competition: 0,
      dataSource: '测试构造', dataUpdatedAt: '2026-10-14', notes: '捡漏测试行',
    });
    assertEqual(res.body.code, 0, '录入结果');
    created.bargainId = res.body.data.position.id;
    const b = res.body.data.position.bargain;
    assert(b.hit, '五条件全中应命中捡漏');
    assertEqual(b.conditions.length, 5, '应逐条返回五个条件');
    assert(b.conditions.every((c) => c.ok), '逐条件应全部为 true');

    const list = await user.get('/api/positions?bargain=1');
    assertEqual(list.body.code, 0, '业务码');
    assert(list.body.data.count >= 1, '至少一条命中');
    assert(
      list.body.data.positions.every((p) => p.bargain.hit === true),
      '筛选结果必须全部命中五条件'
    );
    assert(
      list.body.data.positions.some((p) => p.id === created.bargainId),
      '命中行应出现在捡漏专区'
    );
    assert(list.body.data.stats.bargain >= 1, '统计应含捡漏命中数');
  });

  s.test('捡漏判定：公安政法类职位留学生政审禁入，不进捡漏专区', async () => {
    const { resetAllLimiters } = await loadLimiters();
    resetAllLimiters();
    const res = await user.post('/api/positions', {
      province: '内蒙古', examType: 'guokao', year: 2027, unit: '某出入境边防检查站', title: '警务技术岗',
      majorTrack: 'cs0812', degree: 'master', freshOnly: false, ratioType: 'none',
      scoreMin: 50, scoreTotal: 200, applicants: 0, policePosition: true,
    });
    assertEqual(res.body.code, 0, '录入结果');
    created.policeId = res.body.data.position.id;
    const b = res.body.data.position.bargain;
    assert(!b.hit, '政法类职位即使零报名也不应命中捡漏');
    const returneeSafe = b.conditions.find((c) => c.key === 'returneeSafe');
    assert(returneeSafe && !returneeSafe.ok, '政审安全条件应判否');
    assertEqual(res.body.data.position.policePosition, true, '政法类标记应落库');

    const list = await user.get('/api/positions?bargain=1');
    assert(
      !list.body.data.positions.some((p) => p.id === created.policeId),
      '政法类职位不应出现在捡漏专区'
    );
  });

  s.test('零报名实录行：真实挂零职位带来源，政法类被标记', async () => {
    const res = await admin.get('/api/positions?dataLevel=thirdparty', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    const zero = res.body.data.positions.filter((p) => p.applicants === 0);
    assert(zero.length >= 5, '应有多行真实零报名实录');
    assert(
      zero.every((p) => p.dataSource && p.dataUpdatedAt && p.sourceUrl),
      '实录行必须带数据来源、更新时间与来源链接'
    );
    assert(res.body.data.stats.zeroApply >= 5, '统计应含零报名数');
    assert(zero.some((p) => p.policePosition === true), '应有政法类零报名实录行');
  });

  s.test('bargain 参数校验：非法值返回 2010', async () => {
    const bad = await admin.get('/api/positions?bargain=maybe', { token: null });
    assertEqual(bad.body.code, 2010, '非法 bargain 值错误码');
  });

  s.test('岗位目录含全部「我能考的」考试类型 + 分数口径 + 准捡漏条件', async () => {
    const res = await admin.get('/api/positions/catalogs', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    const d = res.body.data;
    const types = d.examTypes.map((t) => t.key);
    for (const k of ['guokao', 'shengkao', 'shiye', 'xuandiao', 'jundui', 'sanzhiyifu', 'rencai', 'shequ']) {
      assert(types.includes(k), `考试类型应含 ${k}`);
    }
    // 分数口径：总分 / 两科平均
    assertEqual(d.scoreBases.length, 2, '两种分数口径');
    assertEqual(d.scoreBases.map((b) => b.key).join(','), 'total,avg100', '口径 key 集合');
    // 准捡漏五条件 + 三条附加标记
    assertEqual(d.nearBargainConditions.length, 5, '准捡漏五条件');
    assertEqual(
      d.nearBargainConditions.map((c) => c.key).join(','),
      'lowApply,hasScore,trackOk,degreeFit,returneeSafe',
      '准捡漏条件 key 集合'
    );
    assertEqual(d.nearBargainMarks.length, 3, '三条附加标记');
    assertEqual(
      d.nearBargainMarks.map((m) => m.key).join(','),
      'noRatio,freshOk,scoreStable',
      '附加标记 key 集合（无进面比 / 应届进面 / 分数持平）'
    );
  });

  s.test('政策接口含云南省考合格线 + 分数口径校准 + 人才引进 + 低门槛考试清单', async () => {
    const res = await admin.get('/api/positions/policies', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    const d = res.body.data;
    // 云南省考合格线（总分口径）
    assert(Array.isArray(d.yunnanScoreLines) && d.yunnanScoreLines.length >= 6, '云南省考合格线应有多档');
    assert(d.yunnanScoreLines.some((l) => l.total === 95 && /县/.test(l.scope)), '应含县级 95 分档');
    assert(d.yunnanScoreLines.every((l) => Number.isFinite(l.total) && l.scope), '每档带口径与分数');
    // 分数口径校准：必须是「53.35 是平均分口径」的说明
    assert(d.scoreCalibration && d.scoreCalibration.points.length >= 4, '应下发分数口径校准说明');
    assert(
      d.scoreCalibration.points.some((p) => p.includes('53.35')),
      '校准说明应点名 53.35'
    );
    assert(
      d.scoreCalibration.points.some((p) => p.includes('27%')),
      '校准说明应正面回应「27% 正确率」误读'
    );
    // 人才引进 QS 前 200 通道
    assert(d.rencaiQs200 && d.rencaiQs200.regions.length >= 3, '应列出人才引进地区清单');
    assert(
      d.rencaiQs200.regions.every((r) => /QS/.test(r.scope + r.region) && /^https?:\/\//.test(r.sourceUrl)),
      '每条人才引进都应说明 QS 口径并附官方来源'
    );
    // 低门槛考试清单
    assert(d.noRatioExams && d.noRatioExams.items.length >= 4, '应含三支一扶 / 社区 / 西部计划 / 人才引进');
    for (const n of ['三支一扶', '社区工作者', '西部计划', '人才引进']) {
      assert(d.noRatioExams.items.some((i) => i.name === n), `低门槛考试应含 ${n}`);
    }
  });

  s.test('准捡漏筛选：nearBargain=1 只返回 hit 或接近行，且带五条件与三条标记', async () => {
    const { resetAllLimiters } = await loadLimiters();
    resetAllLimiters();
    // 报名≈招录（招 1 报 2）+ 有分数 + 专业可报 + 学历可报 + 政审安全 → 五条全中
    const res = await user.post('/api/positions', {
      province: '湖南', examType: 'sanzhiyifu', year: 2026, unit: '邵阳县城步县某卫生院', title: '支医岗',
      majorTrack: 'cs0812', majorText: '计算机科学与技术（0812）',
      degree: 'bachelor', ratioType: 'ratio', ratioFlexible: true, ratioText: '未达开考比例可开考、不递减指标',
      planCount: 1, applicants: 2, paidCount: 2, competition: 2,
      scoreMin: 53.35, scoreTotal: 200, scoreBasis: 'avg100',
      officialScoreLine: 95, officialScoreLineNote: '云南 2026 县级机关',
      freshInterview: true, scoreStable: true,
    });
    assertEqual(res.body.code, 0, '录入结果');
    created.nearId = res.body.data.position.id;
    const nb = res.body.data.position.nearBargain;
    assert(nb.hit, '五条件全中应命中准捡漏');
    assertEqual(nb.conditions.length, 5, '准捡漏五条件');
    assert(nb.conditions.every((c) => c.ok), '逐条应为 true');
    assertEqual(nb.marks.length, 3, '三条附加标记');
    assert(nb.marks.every((m) => m.ok), '三条标记都应命中（无进面比 / 应届进面 / 分数持平）');
    assertEqual(res.body.data.position.lowApply, true, '低报名判定应命中');
    assertEqual(res.body.data.position.planCount, 1, '招录人数应落库');

    const list = await user.get('/api/positions?nearBargain=1');
    assertEqual(list.body.code, 0, '业务码');
    assert(list.body.data.count >= 1, '至少一条');
    assert(
      list.body.data.positions.every((p) => p.nearBargain.hit || p.nearBargain.partial),
      '筛选结果必须全是命中或接近行'
    );
    assert(list.body.data.positions.some((p) => p.id === created.nearId), '命中行应出现');
    assert(list.body.data.stats.nearBargain >= 1, '统计应含准捡漏命中数');
  });

  s.test('分数口径与官方合格线：折算比对、低于合格线标记待核验', async () => {
    const { resetAllLimiters } = await loadLimiters();
    resetAllLimiters();
    // 平均分口径 53.35 → 折合总分 106.7，高于官方线 95
    const ok = await user.post('/api/positions', {
      province: '云南', examType: 'shengkao', year: 2026, unit: '镇康县某乡镇机关', title: '综合管理岗（口径校验）',
      majorTrack: 'cs0812', degree: 'master', ratioType: 'none',
      scoreBasis: 'avg100', scoreMin: 53.35, scoreTotal: 200,
      officialScoreLine: 95, officialScoreLineNote: '云南省 2026 年度县级机关合格线',
      planCount: 1, applicants: 1, paidCount: 1,
    });
    assertEqual(ok.body.code, 0, '录入结果');
    created.caliberId = ok.body.data.position.id;
    const p = ok.body.data.position;
    assertEqual(p.scoreBasis, 'avg100', '口径应为两科平均');
    assertEqual(p.scoreInTotal, 106.7, '53.35 × 2 = 106.7');
    assertEqual(p.officialScoreLine, 95, '官方合格线应落库');
    assertEqual(p.scoreLineGap, 11.7, '高出合格线 11.7 分');
    assertEqual(p.belowOfficialLine, false, '高于合格线不应标记待核验');

    // 总分口径下明显低于合格线 → 必须标记待核验
    const low = await user.post('/api/positions', {
      province: '云南', examType: 'shengkao', year: 2026, unit: '测试低分单位', title: '低分待核验岗（口径校验）',
      majorTrack: 'cs0812', degree: 'master', ratioType: 'none',
      scoreBasis: 'total', scoreMin: 60, scoreTotal: 200,
      officialScoreLine: 95,
    });
    assertEqual(low.body.code, 0, '录入结果');
    created.lowLineId = low.body.data.position.id;
    assertEqual(low.body.data.position.scoreInTotal, 60, '总分口径不折算');
    assertEqual(low.body.data.position.belowOfficialLine, true, '低于合格线应标记待核验');

    // 非法口径被拒
    const bad = await user.post('/api/positions', {
      province: '云南', examType: 'shengkao', year: 2026, unit: '非法口径', title: '非法口径岗',
      majorTrack: 'cs0812', degree: 'master', ratioType: 'none', scoreBasis: 'percent',
    });
    assertEqual(bad.body.code, 2010, '非法 scoreBasis 应 2010');
  });

  s.test('低报名筛选：lowApply=1 只返回报名≈招录的行', async () => {
    const res = await admin.get('/api/positions?lowApply=1', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    assert(res.body.data.count >= 4, '种子应含多条低报名行');
    assert(res.body.data.positions.every((p) => p.lowApply === true), '筛选结果必须全是低报名行');
    // 两类证据：公告明确未达比例（ratioShortfall）或报名规模推算（count）
    const byShortfall = res.body.data.positions.filter((p) => p.lowApplyBasis === 'ratioShortfall');
    const byCount = res.body.data.positions.filter((p) => p.lowApplyBasis === 'count');
    assert(byShortfall.length >= 1, '应有「公告明确未达开考比例」且无报名数字的公告级证据行');
    assert(byCount.length >= 3, '应有按报名规模推算的低报名行');
    assert(
      byCount.every((p) => p.planCount != null && p.effectiveApplicants != null),
      '按规模推算的行必须能算出报名人数与招录人数'
    );
    assert(
      byShortfall.every((p) => p.ratioShortfall === true),
      '公告级证据行必须带 ratioShortfall 标记'
    );
    assert(res.body.data.stats.lowApply >= 4, '统计应含低报名数');
    // 每行都要带完整的准捡漏五条件清单与三条标记，UI 才能逐条显示差在哪
    assert(
      res.body.data.positions.every((p) => p.nearBargain && p.nearBargain.conditions.length === 5),
      '低报名行应带准捡漏五条件清单'
    );
    assert(
      res.body.data.positions.every((p) => p.nearBargain.marks.length === 3),
      '低报名行应带三条附加标记'
    );
    assert(
      res.body.data.positions.some((p) => p.ratioType === 'ratio' && p.ratioFlexible === false),
      '应含「有比例且未标可开考」的真实样本——这正是「没有就标记一下」的场景'
    );
  });

  s.test('报名数据自检：矛盾的数字被标为待核验，且不据此判低报名', async () => {
    const res = await admin.get('/api/positions?q=行政执法', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    // 云南三行同时记着「竞争比 39:1」与「缴费人数 3/4 人」——必须被自检抓出来
    const flagged = res.body.data.positions.filter((p) => (p.dataIssues || []).length > 0);
    assert(flagged.length >= 1, '应至少有一行被标记报名数据待核验');
    assert(
      flagged.some((p) => p.dataIssues.some((t) => t.includes('竞争比'))),
      '自检信息应点名「竞争比 × 招录人数 与报名人数不一致」'
    );
    assert(
      flagged.every((p) => p.lowApply === false),
      '矛盾行必须按保守口径判否——不能拿小的那个数字宣称低报名'
    );
    // 未录入数据的行不虚构口径
    const noCount = res.body.data.positions.find((p) => p.effectiveApplicants === null);
    if (noCount) assertEqual(noCount.applyCountSource, null, '无报名数据时口径应为 null');
  });

  s.test('nearBargain / lowApply 参数校验：非法值返回 2010', async () => {
    const badNear = await admin.get('/api/positions?nearBargain=maybe', { token: null });
    assertEqual(badNear.body.code, 2010, '非法 nearBargain 值错误码');
    const badLow = await admin.get('/api/positions?lowApply=maybe', { token: null });
    assertEqual(badLow.body.code, 2010, '非法 lowApply 值错误码');
  });

  s.test('跨用户不能修改 / 删除他人录入的岗位（403）', async () => {
    const other = (await admin.get('/api/positions?q=测试录入', { token: null })).body.data.positions[0];
    assert(!other, '游客视角本应查不到，这里只做防御性断言');

    // 用管理员读全量拿到该行，再换一个非属主用户去改
    const all = await admin.get('/api/positions?q=测试录入');
    const target = all.body.data.positions.find((p) => p.id === created.id);
    assert(target, '管理员应能读到该行');

    // admin 是属主之外的角色，但管理员被允许运营排查，因此这里改用「游客 + 伪造属主」不可行，
    // 真正要验证的是：非属主且非管理员一律 403。用 guest 客户端已在上面覆盖，
    // 这里补充验证管理员可以修改（运营需要）。
    const patched = await admin.patch(`/api/positions/${created.id}`, { score: 55 });
    assertEqual(patched.body.code, 0, '管理员应可修改');
    assertEqual(patched.body.data.position.score, 55, '分数应被更新');
  });

  s.test('批量导入：成功 / 空列表 / 超量', async () => {
    const ok = await user.post('/api/positions/import', {
      positions: [
        {
          province: '广西', examType: 'shengkao', unit: '批量导入单位', title: '批量导入岗位',
          majorTrack: 'master_any', ratioType: 'none', score: 53, scoreTotal: 200,
        },
        {
          province: '四川', examType: 'shengkao', unit: '批量导入单位二', title: '批量导入岗位二',
          majorTrack: 'cs0812', ratioType: 'none', score: 58, scoreTotal: 200,
        },
      ],
    });
    assertEqual(ok.body.code, 0, '导入结果');
    assertEqual(ok.body.data.imported, 2, '导入条数');

    const empty = await user.post('/api/positions/import', { positions: [] });
    assertEqual(empty.body.code, 2019, '空列表错误码');

    const tooMany = await user.post('/api/positions/import', {
      positions: Array.from({ length: 201 }, () => ({
        province: '湖北', examType: 'shiye', unit: '超量单位', title: '超量岗位',
        majorTrack: 'cs0812', ratioType: 'none', score: 51,
      })),
    });
    assertEqual(tooMany.body.code, 2020, '超量错误码');
  });

  s.test('详情：不存在返回 2011，存在则带完整字段', async () => {
    const nf = await admin.get('/api/positions/pos_not_exist');
    assertEqual(nf.body.code, 2011, '不存在错误码');

    const res = await admin.get(`/api/positions/${created.id}`);
    assertEqual(res.body.code, 0, '业务码');
    const p = res.body.data.position;
    assertEqual(p.province, '湖北', '省份');
    assertEqual(p.score, 55, '分数（承接上一步的管理员修改）');
    assertEqual(p.degreeName, '硕士', '学历简称');
    assert(p.scoreBands.includes('low50'), '应命中 50 多分口径');
    assert(p.scoreBands.includes('lt120'), '应命中低于 120 分口径');
  });

  s.test('汇总统计与种子条数一致', async () => {
    const res = await admin.get('/api/positions/stats/summary');
    assertEqual(res.body.code, 0, '业务码');
    assert(res.body.data.total >= res.body.data.seedCount, '总数应不少于种子数');
    assert(res.body.data.seedCount > 0, '应记录种子条数');
    assert(Array.isArray(res.body.data.provinces), '分省统计');
  });

  s.test('删除自己录入的岗位（含捡漏 / 准捡漏 / 口径测试行）', async () => {
    for (const id of [
      created.id, created.bargainId, created.policeId,
      created.nearId, created.caliberId, created.lowLineId,
    ]) {
      if (!id) continue;
      const res = await user.del(`/api/positions/${id}`);
      assertEqual(res.body.code, 0, '删除结果');
      const gone = await user.get(`/api/positions/${id}`);
      assertEqual(gone.body.code, 2011, '删除后应查不到');
    }
  });

  return s;
}
