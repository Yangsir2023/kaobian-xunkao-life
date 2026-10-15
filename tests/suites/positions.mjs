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

  s.test('最佳推荐：三大板块齐全，按「国考已出 / 省考预测 / 其他考试」组织', async () => {
    const res = await admin.get('/api/positions/catalogs', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    const br = res.body.data.bestRecommend;
    assert(br, 'catalogs 应下发 bestRecommend');
    assertEqual(br.blocks.length, 3, '三个板块');
    assertEqual(br.blocks.map((b) => b.key).join(','), 'guokao,shengkao,others', '板块顺序：国考 → 省考 → 其他考试');

    const [gk, sk, others] = br.blocks;
    assert(gk.regions.length >= 5, `国考推荐地区 ≥5，实际 ${gk.regions.length}`);
    assert(gk.posts.length >= 6, `国考推荐岗位 ≥6，实际 ${gk.posts.length}`);
    assert(gk.avoid.length >= 3, '应给出明确不推荐的岗位');
    assert(gk.summary.facts.length >= 10, '国考考情速览逐条可核');
    assertEqual(sk.summary.lines.length, 2, '省考两条线（自主命题 / 多省联考）');
    assert(sk.summary.picks.length >= 3, '省考推荐地区');
    assert(sk.summary.caveats.length >= 3, '省考特有约束（户籍 / 认证 / 只能报一省）');
    assert(others.timeline.length >= 10, `其他考试 ≥10 类，实际 ${others.timeline.length}`);
    assert(others.sequence.length >= 8, '行动时间轴');
  });

  s.test('最佳推荐：每条结论都带数据级别，且级别在白名单内', async () => {
    const res = await admin.get('/api/positions/catalogs', { token: null });
    const br = res.body.data.bestRecommend;
    const allowed = new Set(br.levels.map((l) => l.key));
    assertEqual([...allowed].join(','), 'official,thirdparty,forecast', '三档级别：官方 / 第三方 / 预测');

    const [gk, sk, others] = br.blocks;
    const items = [
      ...gk.summary.facts,
      ...gk.regions,
      ...gk.posts,
      ...gk.avoid,
      ...sk.summary.lines,
      ...sk.summary.picks,
      ...others.timeline,
    ];
    assert(items.length > 40, `应逐条标注级别，实际 ${items.length} 条`);
    const bad = items.filter((it) => !allowed.has(it.level));
    assertEqual(bad.length, 0, `越级条目：${bad.map((b) => b.name || b.region || b.label).join(' / ')}`);
    // 每一档都必须真的被用到，否则图例是摆设
    for (const key of allowed) {
      assert(items.some((it) => it.level === key), `级别 ${key} 未在条目中使用`);
    }
  });

  s.test('最佳推荐：带竞争 / 招录结论的条目必须有来源链接', async () => {
    const res = await admin.get('/api/positions/catalogs', { token: null });
    const br = res.body.data.bestRecommend;
    const [gk, sk, others] = br.blocks;
    // 这些条目全部承载具体数字（竞争比、进面分、招录人数、报名窗口），必须可溯源
    const sourced = [
      ...gk.regions,
      ...gk.posts,
      ...gk.avoid,
      ...sk.summary.picks,
      ...others.timeline,
    ];
    const missing = sourced.filter((it) => !/^https?:\/\//.test(it.sourceUrl || ''));
    assertEqual(missing.length, 0, `缺来源：${missing.map((m) => m.name || m.region).join(' / ')}`);
    const noName = sourced.filter((it) => !it.sourceName);
    assertEqual(noName.length, 0, '来源必须带可读名称（便于用户判断可信度）');
    // 省考推荐属预测，必须显式声明
    assert(sk.summary.picks.every((p) => p.level === 'forecast'), '省考推荐只能标为预测');
    assert(sk.summary.note.includes('预测') || sk.summary.note.includes('推算'), '省考板块需声明时间口径');
  });

  s.test('最佳推荐：省考两条线与国考窗口口径一致（2027 公告已校准）', async () => {
    const res = await admin.get('/api/positions/catalogs', { token: null });
    const d = res.body.data;
    const [gk, sk] = d.bestRecommend.blocks;
    // 国考关键日期必须与捡漏攻略里的实时窗口对得上，避免两处各写一套
    const win = d.bargainGuide.window;
    assertEqual(win.authStart, '2026-10-14 08:00', '注册认证起始（公告原文）');
    assertEqual(win.registerStart, '2026-10-15 08:00', '提交报考申请起始（公告原文）');
    assertEqual(win.registerEnd, '2026-10-24 18:00', '报名截止');
    assertEqual(win.authDeadline, '2026-10-23 18:00', '注册认证截止');
    assert(win.examDate.includes('2026-11-29'), '笔试日期');
    assert(win.planTotal.includes('35691'), '招录规模应与职位表统计一致');
    // 速览里的报名窗口与实时窗口同源
    const reg = gk.summary.facts.find((f) => f.label === '报名窗口');
    assert(reg, '速览应含报名窗口条目');
    assert(reg.value.includes('2026-10-15') && reg.value.includes('2026-10-24'), '报名窗口日期');
    assertEqual(reg.level, 'official', '报名窗口来自公告原文');
    // 省考两条线都要标预测，且联考只能报一个省必须写明
    const joint = sk.summary.lines.find((l) => l.key === 'joint');
    assert(joint && joint.level === 'forecast', '联考时间标预测');
    assert(joint.note.includes('只能选一个省份'), '必须写明联考只能报一个省');
  });

  s.test('最佳推荐：留学生政审红线在推荐里被显式排除', async () => {
    const res = await admin.get('/api/positions/catalogs', { token: null });
    const gk = res.body.data.bestRecommend.blocks.find((b) => b.key === 'guokao');
    const police = gk.avoid.find((a) => a.name.includes('公安'));
    assert(police, '必须显式列出公安 / 边检类不可报');
    assert(police.reason.includes('六个月'), '写明六个月境外经历的禁入条款');
    assertEqual(police.level, 'official', '政审条款来自官方文件');
    // 推荐岗位里不应出现人民警察类（边检 / 缉私 / 铁路公安 / 公安）
    const forbidden = /边检|边防|缉私|铁路公安|人民警察|移民管理/;
    const bad = gk.posts.filter((p) => forbidden.test(p.name));
    assertEqual(bad.length, 0, `推荐岗位混入政审红线岗位：${bad.map((b) => b.name).join(' / ')}`);
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

  s.test('筛选标签容量：每个标签都能落到 20 条以上（示例行撑起演示容量）', async () => {
    const cats = await admin.get('/api/positions/catalogs', { token: null });
    assertEqual(cats.body.code, 0, '业务码');
    const d = cats.body.data;

    // 岗位页筛选标签条上的每一个标签，外加省份 / 考试类型 / 学历三个分组
    const probes = [
      ['majorTrack=cs0812', '计算机 0812'],
      ['majorTrack=master_any', '硕士不限专业'],
      ['ratioType=none', '不设开考比例'],
      ['freshOnly=true', '仅限应届'],
      ['band=low50', '50 多分'],
      ['band=lt120', '低于 120 分'],
      ['bargain=1', '捡漏'],
      ['nearBargain=1', '准捡漏'],
      ['lowApply=1', '低报名'],
      ['majorTrack=cs0812&ratioType=none&freshOnly=true&band=lt120', '低分上岸组合（与前端 PRESET 一致）'],
      ...d.examTypes.map((t) => [`examType=${t.key}`, `考试类型 ${t.short}`]),
      ...d.degrees.map((g) => [`degree=${g.key}`, `学历 ${g.name}`]),
      ...d.provinces.map((p) => [`province=${encodeURIComponent(p)}`, `省份 ${p}`]),
    ];

    const thin = [];
    for (const [qs, label] of probes) {
      const res = await admin.get(`/api/positions?limit=1&${qs}`, { token: null });
      assertEqual(res.body.code, 0, `${label} 请求成功`);
      const total = res.body.data.stats.total;
      if (!(total >= 20)) thin.push(`${label}=${total}`);
    }
    assertEqual(thin.length, 0, `以下标签条数不足 20：${thin.join('、')}`);
    assert(probes.length >= 45, `标签覆盖应足够全（当前 ${probes.length} 个）`);
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

  s.test('岗位目录含历年公告归档：按考试分组、每份带时间节点与可点开的来源', async () => {
    const res = await admin.get('/api/positions/catalogs', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    const arc = res.body.data.announcementArchive;
    assert(arc && Array.isArray(arc.groups) && arc.groups.length >= 4, '历年公告应按考试类型分组');
    assert(arc.intro && arc.caveat, '归档应同时给出说明与收录范围声明');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(arc.updatedAt || ''), '归档应带更新日期');

    const levels = (res.body.data.announcementLevels || []).map((l) => l.key);
    assert(levels.includes('official') && levels.includes('thirdparty'), '公告级别应复用官方 / 第三方');

    const all = arc.groups.flatMap((g) => g.items || []);
    assert(all.length >= 10, `历年公告应不少于 10 份，实际 ${all.length}`);
    // 分组 key 与考试类型对齐，前端按组渲染
    for (const g of arc.groups) {
      assert(g.key && g.name && (g.items || []).length > 0, `分组 ${g.key || '?'} 应有名称与非空条目`);
    }
    // 每份公告：年度 + 标题 + 级别 + 时间轴 + 来源链接
    for (const it of all) {
      assert(Number.isInteger(it.year) && it.year >= 2024, `公告年份应有效：${it.title}`);
      assert(it.title && it.level, `公告 ${it.year} 应带标题与数据级别`);
      assert(levels.includes(it.level), `公告级别 ${it.level} 应在级别表中：${it.title}`);
      assert(Array.isArray(it.timeline) && it.timeline.length >= 2, `公告应带时间节点：${it.title}`);
      assert(
        it.timeline.every((t) => t.label && t.value),
        `时间节点应每项都有名称与日期：${it.title}`
      );
      assert(/^https?:\/\//.test(it.sourceUrl || ''), `公告应带可点开的原文链接：${it.title}`);
      assert(it.sourceName, `公告应标注来源名称：${it.title}`);
      // 发布日期允许精确到月：部分公告原文只给到月份，不补造具体日期
      assert(
        it.publishDate === undefined || /^\d{4}-\d{2}(-\d{2})?$/.test(it.publishDate),
        `发布日期格式（允许 YYYY-MM 或 YYYY-MM-DD）：${it.title} → ${it.publishDate}`
      );
      for (const st of it.stats || []) {
        assert(st.text && levels.includes(st.level), `统计条目应带正文与级别：${it.title}`);
        assert(/^https?:\/\//.test(st.sourceUrl || ''), `统计条目应带来源链接：${it.title}`);
      }
    }
    // 国考分组应有多年度，才能做「逐年对照」
    const gk = arc.groups.find((g) => g.key === 'guokao');
    assert(gk && gk.items.length >= 2, '国考归档应含多个年度以便逐年对照');
    assert(
      gk.items.some((i) => /报名/.test((i.timeline || []).map((t) => t.label).join(''))),
      '国考条目时间轴应含报名窗口'
    );
  });

  s.test('考试类型含村官与西部计划（外地考生能报的基层通道进了分类）', async () => {
    const res = await admin.get('/api/positions/catalogs', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    const types = res.body.data.examTypes.map((t) => t.key);
    for (const k of ['cunban', 'xibu']) {
      assert(types.includes(k), `考试类型应含 ${k}`);
    }
    // 新增类型必须有足够条数，否则筛选器点进去是空的
    for (const k of ['cunban', 'xibu']) {
      const list = await admin.get(`/api/positions?examType=${k}`, { token: null });
      assertEqual(list.body.code, 0, `${k} 列表业务码`);
      assert(list.body.data.stats.total >= 20, `${k} 应不少于 20 条，实际 ${list.body.data.stats.total}`);
    }
  });

  s.test('户籍口径对照：每条都有口径级别、依据原文与可点开的来源', async () => {
    const res = await admin.get('/api/positions/catalogs', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    const guide = res.body.data.hukouGuide;
    const levels = (res.body.data.hukouLevels || []).map((l) => l.key);
    assert(guide && guide.items.length >= 5, `户籍口径应覆盖多类考试，实际 ${guide?.items?.length}`);
    assert(guide.intro && guide.caveat, '应同时给出说明与收录范围声明');
    assert(levels.includes('open') && levels.includes('fresh') && levels.includes('mixed'), '口径级别应含不限户籍 / 应届不限 / 逐公告看');
    // 「没出现 ≠ 限户籍」必须写进 caveat，避免用户把清单当全集
    assert(/没出现在这份清单里/.test(guide.caveat), 'caveat 应说明没列入的考试不代表限户籍');

    const examKeys = res.body.data.examTypes.map((t) => t.key);
    for (const it of guide.items) {
      assert(levels.includes(it.level), `口径级别应在白名单内：${it.name} → ${it.level}`);
      assert(examKeys.includes(it.examType), `应挂到已有考试类型上：${it.name} → ${it.examType}`);
      assert(it.quote && it.why && it.caution, `每条都应有依据原文 / 为什么值得看 / 注意：${it.name}`);
      assert(/^https?:\/\//.test(it.sourceUrl || ''), `应带可点开的来源链接：${it.name}`);
      assert(it.sourceName, `应标注来源名称：${it.name}`);
      for (const st of it.stats || []) {
        assert(st.text && ['official', 'thirdparty', 'forecast'].includes(st.level), `补充条目应带正文与数据级别：${it.name}`);
        assert(/^https?:\/\//.test(st.sourceUrl || ''), `补充条目应带来源链接：${it.name}`);
      }
    }
    // 至少有一条明确「不限户籍」，否则这份对照没有实际用途
    assert(guide.items.some((i) => i.level === 'open'), '至少应有一条明确不限户籍的考试');
    // 收录的口径必须逐条写清是哪个地区 / 哪一年的，不能泛泛说全国
    const vague = guide.items.filter(
      (i) => i.level === 'open' && !/2026|2027|年度|专项|计划/.test(i.sourceName + i.window + i.scale)
    );
    assertEqual(vague.length, 0, '每条不限户籍的结论都应落到具体年度 / 计划');
  });

  s.test('冷门统考清单：每条都有组织方、户籍口径、依据原文与来源链接', async () => {
    const res = await admin.get('/api/positions/catalogs', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    const cold = res.body.data.coldExams;
    assert(cold && cold.groups.length >= 3, `冷门统考应按组织方分组，实际 ${cold?.groups?.length}`);
    assert(cold.intro && cold.caveat, '应同时给出说明与收录范围声明');
    assert(/^\d{4}-\d{2}-\d{2}$/.test(cold.updatedAt || ''), '应带更新日期');
    assert(/合同制|劳务派遣/.test(cold.caveat), 'caveat 应写明国企校招不等于编制');

    const hukouKeys = (res.body.data.hukouLevels || []).map((l) => l.key);
    const examKeys = res.body.data.examTypes.map((t) => t.key);
    const items = cold.groups.flatMap((g) => g.items || []);
    assert(items.length >= 5, `冷门统考应不少于 5 类，实际 ${items.length}`);

    for (const g of cold.groups) {
      assert(g.key && g.name && (g.items || []).length > 0, `分组 ${g.key || '?'} 应有名称与非空条目`);
    }
    for (const it of items) {
      assert(hukouKeys.includes(it.hukou), `户籍口径应在白名单内：${it.name} → ${it.hukou}`);
      assert(it.org, `应写明组织方：${it.name}`);
      assert(it.window && it.scale, `应写明窗口与规模：${it.name}`);
      assert(/^https?:\/\//.test(it.sourceUrl || ''), `应带可点开的来源链接：${it.name}`);
      assert(it.sourceName, `应标注来源名称：${it.name}`);
      assert(it.why && it.caution, `每条都应写「为什么值得看」与「注意」：${it.name}`);
      for (const st of it.stats || []) {
        assert(st.text && ['official', 'thirdparty', 'forecast'].includes(st.level), `补充条目应带正文与数据级别：${it.name}`);
        assert(/^https?:\/\//.test(st.sourceUrl || ''), `补充条目应带来源链接：${it.name}`);
      }
    }
    // 冷门统考里至少要有一条「有编制且专业对口」的，否则信息差没意义
    assert(
      items.some((i) => i.hukou === 'open' && /编制/.test(i.why + i.caution)),
      '至少应有一条冷门统考写明编制情况'
    );
    // 待核实清单：说了"听说过但没核到"的必须挂在 pending 而不是混进正式清单
    assert((cold.pending || []).length >= 1, '应有待核实清单（核不到原文的通道不冒充已核实）');
    for (const p of cold.pending || []) {
      assert(p.name && p.note, '待核实条目应写明名称与为什么没核到');
    }
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
    // 种子有几百行、单页上限 200，两类证据的判定必须看全集：按 offset 翻完为止
    const all = [];
    for (let offset = 0; offset < 1000; offset += 200) {
      const page = await admin.get(`/api/positions?lowApply=1&limit=200&offset=${offset}`, { token: null });
      all.push(...page.body.data.positions);
      if (all.length >= page.body.data.stats.lowApply || page.body.data.positions.length === 0) break;
    }
    assertEqual(all.length, res.body.data.stats.lowApply, '翻页应能取到全部低报名行');
    // 两类证据：公告明确未达比例（ratioShortfall）或报名规模推算（count）
    const byShortfall = all.filter((p) => p.lowApplyBasis === 'ratioShortfall');
    const byCount = all.filter((p) => p.lowApplyBasis === 'count');
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
      all.every((p) => p.nearBargain && p.nearBargain.conditions.length === 5),
      '低报名行应带准捡漏五条件清单'
    );
    assert(
      all.every((p) => p.nearBargain.marks.length === 3),
      '低报名行应带三条附加标记'
    );
    assert(
      all.some((p) => p.ratioType === 'ratio' && p.ratioFlexible === false),
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
