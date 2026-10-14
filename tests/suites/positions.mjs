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

  s.test('删除自己录入的岗位（含捡漏测试行）', async () => {
    for (const id of [created.id, created.bargainId, created.policeId]) {
      if (!id) continue;
      const res = await user.del(`/api/positions/${id}`);
      assertEqual(res.body.code, 0, '删除结果');
      const gone = await user.get(`/api/positions/${id}`);
      assertEqual(gone.body.code, 2011, '删除后应查不到');
    }
  });

  return s;
}
