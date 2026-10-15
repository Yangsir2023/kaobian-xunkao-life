/**
 * 分类详情套件：GET /api/categories/:key/detail
 *
 * 覆盖用户诉求「比如人才引进，就能出现一个新页面：展示今年和明年预测的、
 * 不限户籍然后符合我条件的公告链接和岗位」：
 *   ① 每个分类都有详情（category / summary / positions 字段齐全）
 *   ② 人才引进：QS 前 200 真实公告 + 明年预测 + 岗位深链
 *   ③ 国考：今年动态（2027 年度）+ 历年公告 3 份 + 户籍口径 open
 *   ④ 冷门统考五类：今年动态来自 cold-exams、户籍 open、深链考试类型正确
 *   ⑤ 未知 key 走 404
 *   ⑥ 诚实边界：forecast 块一律标 forecast；带结论的块必须带来源链接
 */
import { suite, assert, assertEqual, assertIncludes } from '../helpers.mjs';

const ALL_KEYS = [
  'guokao', 'shengkao', 'shiye', 'shequ', 'hubei-xuandiao', 'jundui', 'sanzhiyifu',
  'rencai', 'xibu', 'liufu', 'cunban', 'zhuanli', 'yancao', 'dianwang', 'nongxin', 'xiaofang',
  'yunyingshang',
];

export function categoryDetailSuite({ admin }) {
  const s = suite('分类详情');

  s.test('每个分类都有详情数据且字段齐全', async () => {
    for (const key of ALL_KEYS) {
      const res = await admin.get(`/api/categories/${key}/detail`, { token: null });
      assertEqual(res.body.code, 0, `${key} 业务码`);
      const d = res.body.data;
      assert(d.category, `${key} 应有 category`);
      assertEqual(d.category.key, key, `${key} key 一致`);
      assert(d.summary && d.summary.headline, `${key} 应有今年状态一句话`);
      // 考什么 · 备什么：每类都有通用备考口径（科目 + 准备清单）
      assert(d.examInfo, `${key} 应有 examInfo`);
      assert(d.examInfo.subjects.length >= 1, `${key} 应有考试科目`);
      assert(d.examInfo.subjects.every((x) => x.name), `${key} 科目都应有名称`);
      assert(d.examInfo.prep.length >= 2, `${key} 应有准备清单（≥2 条）`);
      if (key === 'liufu') {
        assertEqual(d.positions.examTypes.length, 0, '留服认证不是考试，不映射岗位类型');
        assertEqual(d.positions.deepLink, null, '留服认证无岗位深链');
      } else {
        assert(d.positions.examTypes.length > 0, `${key} 应映射岗位库考试类型`);
      }
      assert(Array.isArray(d.announcements), `${key} announcements 应为数组`);
      assert(Array.isArray(d.guides), `${key} guides 应为数组`);
      assert(Array.isArray(d.notes), `${key} notes 应为数组`);
      assert(d.updatedAt, `${key} 应有数据截止日期`);
      // 户籍口径：要么有核到原文的口径，要么有显式的「未核实」说明（留服认证不是考试，不适用）
      if (key !== 'liufu') {
        assert(d.hukou || d.hukouPending, `${key} 应有户籍口径或未核实说明`);
      }
      if (d.positions.deepLink) {
        assertIncludes(d.positions.deepLink, `examType=${d.positions.examTypes[0]}`, `${key} 深链应指向首个考试类型`);
      }
    }
  });

  s.test('人才引进：QS 前 200 真实公告 5 条 + 明年预测 + 岗位深链', async () => {
    const res = await admin.get('/api/categories/rencai/detail', { token: null });
    const d = res.body.data;
    assertEqual(d.guides.length, 1, '应有人才引进指南块');
    const guide = d.guides[0];
    assert(guide.regions.length >= 5, `QS 前 200 公告 ≥5，实际 ${guide.regions.length}`);
    for (const r of guide.regions) {
      assert(r.sourceUrl && r.sourceUrl.startsWith('http'), `${r.region} 应带来源链接`);
      assert(r.scope && r.window && r.feature, `${r.region} 应含范围 / 窗口 / 特色`);
    }
    assert(d.forecast, '应有明年预测');
    assertEqual(d.forecast.level, 'forecast', '预测块必须标 forecast');
    assertIncludes(d.forecast.headline, '1—5 月', '预测应覆盖春秋两季窗口');
    assertEqual(d.positions.examTypes.join(','), 'rencai', '岗位深链考试类型');
    assertEqual(d.positions.deepLink, '/positions?examType=rencai', '深链路径');
  });

  s.test('国考：今年动态 official + 历年公告 3 份 + 户籍 open', async () => {
    const res = await admin.get('/api/categories/guokao/detail', { token: null });
    const d = res.body.data;
    assertEqual(d.thisYear.level, 'official', '今年动态应为官方公告');
    assertIncludes(d.thisYear.headline, '35691', '应含 2027 年度招录规模');
    assert(d.thisYear.points.length >= 10, '国考考情速览逐条可核');
    assertEqual(d.announcements.length, 3, '历年公告 3 份（2025 / 2026 / 2027 年度）');
    for (const it of d.announcements) {
      assert(it.sourceUrl && it.sourceUrl.startsWith('http'), `${it.year} 年度公告应带来源`);
    }
    assert(d.hukou, '应有户籍口径');
    assertEqual(d.hukou.level, 'open', '国考户籍口径应为全国可报');
    assert(d.hukou.quote, '户籍结论应有公告原文引用');
    assert(d.forecast && d.forecast.level === 'forecast', '应有 2028 年度节奏推演（forecast）');
  });

  s.test('冷门统考五类：今年动态来自 cold-exams、户籍 open、深链正确', async () => {
    const expected = {
      zhuanli: '专利审查员全国统考',
      yancao: '中国烟草系统招聘',
      dianwang: '电网系统统一考试',
      nongxin: '农商行',
      xiaofang: '消防救援队伍招录',
    };
    for (const [key, namePart] of Object.entries(expected)) {
      const res = await admin.get(`/api/categories/${key}/detail`, { token: null });
      const d = res.body.data;
      assert(d.thisYear, `${key} 应有今年动态`);
      assertIncludes(d.thisYear.headline, namePart, `${key} 今年动态标题`);
      assert(d.thisYear.points.length === 3, `${key} 应有规模 / 窗口 / 原文三条`);
      assert(d.hukou, `${key} 应有户籍口径`);
      assertEqual(d.hukou.level, 'open', `${key} 户籍口径应为全国可报`);
      assert(d.notes.length >= 2, `${key} 应有为什么值得看 / 注意事项`);
      assertEqual(d.positions.examTypes.join(','), key, `${key} 深链考试类型`);
      assert(d.forecast && d.forecast.level === 'forecast', `${key} 应有明年预测`);
    }
  });

  s.test('村官：河南协理员不限户籍 + 县乡自招 mixed 提示', async () => {
    const res = await admin.get('/api/categories/cunban/detail', { token: null });
    const d = res.body.data;
    assertIncludes(d.thisYear.headline, '10000', '应含河南万名协理员规模');
    assert(d.hukou, '应有户籍口径');
    assertEqual(d.hukou.level, 'open', '河南协理员不限户籍');
    assertIncludes(d.thisYear.points.map((p) => p.value).join(''), '不限制户籍', '应引用公告原文');
    assert(d.notes.some((n) => n.text.includes('逐公告核对')), '应提示县乡自招需逐公告核对');
  });

  s.test('未知分类 key 走 404', async () => {
    const res = await admin.get('/api/categories/not-exist/detail', { token: null });
    assertEqual(res.status, 404, 'HTTP 状态');
  });

  s.test('运营商：岗位库已收录但公告未核 —— 显式走「待核实」，不冒充已核实', async () => {
    const res = await admin.get('/api/categories/yunyingshang/detail', { token: null });
    const d = res.body.data;
    assertEqual(d.positions.examTypes.join(','), 'yunyingshang', '岗位深链考试类型');
    assertEqual(d.positions.deepLink, '/positions?examType=yunyingshang', '深链路径');
    // 没有核到公告：不给 thisYear / forecast 块，只在户籍与注意事项里说明
    assertEqual(d.thisYear, null, '未核到公告不应有今年动态');
    assertEqual(d.forecast, null, '未核到公告不应有明年预测');
    assert(d.hukouPending && d.hukouPending.includes('未核到'), '户籍口径应标未核实');
    assert(d.notes.some((n) => n.text.includes('示例') && n.text.includes('未核实')), '应说明只有示例行');
    assert(d.links.length >= 1 && d.links[0].url.startsWith('http'), '官方入口应可用');
    assert(d.examInfo && d.examInfo.subjects.length >= 1, '考什么仍应有（通用口径）');
  });

  s.test('三支一扶 / 西部计划：今年动态来自官方原文，不是推算', async () => {
    for (const [key, part] of [['sanzhiyifu', '2000 名'], ['xibu', '6 万人']]) {
      const res = await admin.get(`/api/categories/${key}/detail`, { token: null });
      const d = res.body.data;
      assert(d.thisYear, `${key} 应有今年动态`);
      assertEqual(d.thisYear.level, 'official', `${key} 今年动态应为官方公告`);
      assertIncludes(d.thisYear.headline, part, `${key} 规模`);
      assert(d.thisYear.sourceUrl && d.thisYear.sourceUrl.startsWith('http'), `${key} 应带官方来源`);
      assert(d.forecast && d.forecast.level === 'forecast', `${key} 明年预测应为推算`);
    }
  });

  s.test('考什么 · 备什么：目录与岗位行都带备考口径与官方入口', async () => {
    // 分类目录：16 类都带 examInfo（分类卡片与岗位详情弹层共用这份数据）
    const catRes = await admin.get('/api/catalog/categories', { token: null });
    const cats = catRes.body.data.categories;
    assertEqual(cats.length, 17, '分类数');
    for (const c of cats) {
      assert(c.examInfo, `${c.key} 目录应带 examInfo`);
      assert(c.examInfo.subjects.length >= 1, `${c.key} 目录科目 ≥1`);
      assert(c.examInfo.prep.length >= 2, `${c.key} 目录准备清单 ≥2`);
      assert(c.officialSite && c.officialSite.startsWith('http'), `${c.key} 官方入口`);
    }
    // 岗位行：每行带该类考试官方入口（公考雷达式跳转的兜底）
    const posRes = await admin.get('/api/positions?limit=200', { token: null });
    const rows = posRes.body.data.positions;
    assert(rows.length > 0, '应有岗位行');
    for (const p of rows) {
      // 运营商暂无对应分类，不注入官网兜底；其余 examType 都该有
      if (p.examType !== 'yunyingshang') {
        assert(p.officialSite && p.officialSite.startsWith('http'), `${p.examType} 行应有官方入口`);
      }
    }
    // 选调生 examType=xuandiao → 分类 key=hubei-xuandiao 的官网
    const xuandiao = rows.find((p) => p.examType === 'xuandiao');
    if (xuandiao) {
      assertIncludes(xuandiao.officialSite, 'hbzzb.gov.cn', '选调岗位应落到省委组织部官网');
    }
  });

  s.test('社区工作者：全国公告清单有数据、结构正确、来源链接齐全', async () => {
    const res = await admin.get('/api/categories/shequ/detail', { token: null });
    const d = res.body.data;
    assert(d.communityJobs, '社区工作者应有全国公告清单块');
    const cj = d.communityJobs;
    assert(cj.intro && cj.intro.includes('社区工作者'), '应有简介');
    assert(cj.caveat && cj.caveat.includes('不是全国穷举'), '应有覆盖度声明');
    assert(cj.summary.headcount > 0, '总人数 > 0');
    assert(cj.summary.provincesWithData > 0, '有数据的省份 > 0');
    assert(cj.summary.provinceCount >= 24, '覆盖省份数 ≥ 24');
    assert(Array.isArray(cj.provinces), '应有省份数组');
    // 每一条都应有来源链接（level 在白名单）
    for (const p of cj.provinces) {
      for (const it of p.items) {
        assert(it.sourceUrl && it.sourceUrl.startsWith('http'), `${p.name}·${it.area} 应带来源链接`);
        assert(['official', 'thirdparty'].includes(it.level), `${p.name}·${it.area} 级别应在白名单内`);
      }
    }
  });

  s.test('全国社区工作者公告清单独立接口：结构正确、可单独调用', async () => {
    const res = await admin.get('/api/community-jobs', { token: null });
    assertEqual(res.status, 200, 'HTTP 状态');
    const d = res.body.data;
    assert(d.summary.headcount > 0, '人数 > 0');
    assert(Array.isArray(d.provinces), '省份数组');
    assert(d.provinces.some((p) => p.name === '湖北' && p.items.some((i) => i.area.includes('武汉'))), '应含武汉/湖北条目');
  });

  s.test('乡村振兴协理员：cunban 详情含 ruralJobs，结构正确、河南不限户籍', async () => {
    const res = await admin.get('/api/categories/cunban/detail', { token: null });
    const d = res.body.data;
    assert(d.ruralJobs, '村官（cunban）详情应含乡村振兴协理员块 ruralJobs');
    const rj = d.ruralJobs;
    assert(rj.intro && rj.intro.includes('乡村振兴协理员'), '应有简介');
    assert(rj.caveat && rj.caveat.includes('覆盖度声明'), '应有覆盖度声明');
    assert(rj.summary.headcount > 0, '总人数 > 0');
    assert(rj.summary.provincesWithData >= 1, '有数据的省份 > 0');
    assert(Array.isArray(rj.provinces), '应有省份数组');
    // 河南：省级事业编专项、不限户籍、来源齐全
    const henan = rj.provinces.find((p) => p.key === 'henan');
    assert(henan, '应含河南');
    const henItem = henan.items[0];
    assertEqual(henItem.level, 'official', '河南应为 official');
    assert(henItem.sourceUrl && henItem.sourceUrl.startsWith('http'), '河南应带来源链接');
    assertIncludes(henItem.hukou, '不限户籍', '河南应明确不限户籍');
    // 诚实边界：级别在白名单内；有来源链接的必须是 http(s)
    for (const p of rj.provinces) {
      for (const it of p.items) {
        assert(['official', 'thirdparty'].includes(it.level), `${p.name}·${it.area} 级别应在白名单内`);
        if (it.sourceUrl) assert(it.sourceUrl.startsWith('http'), `${p.name}·${it.area} 来源应为 http(s)`);
      }
    }
  });

  s.test('乡村振兴协理员全国清单独立接口：结构正确、可单独调用', async () => {
    const res = await admin.get('/api/rural-coordinator-jobs', { token: null });
    assertEqual(res.status, 200, 'HTTP 状态');
    const d = res.body.data;
    assert(d.summary.headcount > 0, '人数 > 0');
    assert(Array.isArray(d.provinces), '省份数组');
    const henan = d.provinces.find((p) => p.key === 'henan');
    assert(henan && henan.items[0].level === 'official', '应含河南 official 条目');
  });

  s.test('网格员：shequ 详情含 gridJobs，结构正确、户籍/编制口径逐条标', async () => {
    const res = await admin.get('/api/categories/shequ/detail', { token: null });
    const d = res.body.data;
    assert(d.gridJobs, '社区工作者（shequ）详情应含网格员块 gridJobs');
    const gj = d.gridJobs;
    assert(gj.intro && gj.intro.includes('网格员'), '应有简介');
    assert(gj.caveat && gj.caveat.includes('覆盖度声明'), '应有覆盖度声明');
    assert(gj.summary.headcount > 0, '总人数 > 0');
    assert(gj.summary.provinceCount >= 4, '覆盖省份数 ≥ 4');
    assert(Array.isArray(gj.provinces), '应有省份数组');
    for (const p of gj.provinces) {
      for (const it of p.items) {
        assert(it.sourceUrl && it.sourceUrl.startsWith('http'), `${p.name}·${it.area} 应带来源链接`);
        assert(['official', 'thirdparty'].includes(it.level), `${p.name}·${it.area} 级别应在白名单内`);
        assert(it.hukou, `${p.name}·${it.area} 应标户籍口径`);
        assert(it.abroad, `${p.name}·${it.area} 应标国境外学历口径`);
        // 编制属性：逐条说明无事业编制（措辞可能是「临聘」/「编外」/「非事业编制」之一）
        const noEstab = ['临聘', '编外', '非事业编制', '无事业编制'].some((k) => it.note.includes(k));
        assert(noEstab, `${p.name}·${it.area} 应说明临聘/编外无编`);
      }
    }
  });

  s.test('网格员全国清单独立接口：结构正确、可单独调用', async () => {
    const res = await admin.get('/api/grid-worker-jobs', { token: null });
    assertEqual(res.status, 200, 'HTTP 状态');
    const d = res.body.data;
    assert(d.summary.headcount > 0, '人数 > 0');
    assert(Array.isArray(d.provinces), '省份数组');
    assert(d.provinces.length >= 4, '应覆盖 ≥4 省/地区');
  });

  s.test('武汉双盲考试：shiye 详情含 wuhanDoubleBlind，机制说明 + 两场 + 双盲标', async () => {
    const res = await admin.get('/api/categories/shiye/detail', { token: null });
    const d = res.body.data;
    assert(d.wuhanDoubleBlind, '事业单位（shiye）详情应含武汉双盲块');
    const wj = d.wuhanDoubleBlind;
    assert(wj.intro && wj.intro.includes('双盲'), '应有简介');
    assert(wj.doubleBlind && wj.doubleBlind.text.includes('双盲'), '应有双盲机制说明');
    assert(wj.doubleBlind.sourceUrl && wj.doubleBlind.sourceUrl.startsWith('http'), '双盲机制说明应带来源（诺码信战报）');
    assert(wj.summary.headcount > 0, '总人数 > 0');
    assert(Array.isArray(wj.provinces), '应有省份数组');
    const wuhan = wj.provinces.find((p) => p.key === 'wuhan');
    assert(wuhan, '应含武汉');
    assertEqual(wuhan.items.length, 2, '武汉应含两场事业编招聘');
    for (const it of wuhan.items) {
      assertEqual(it.doubleBlind, true, `${it.area} 应标双盲面试`);
      assert(it.sourceUrl && it.sourceUrl.startsWith('http'), `${it.area} 应带官方来源`);
      assertEqual(it.level, 'official', `${it.area} 应为 official`);
      assertIncludes(it.hukou, '国籍', `${it.area} 户籍口径应只列国籍`);
    }
  });

  s.test('武汉双盲考试专项独立接口：结构正确、可单独调用', async () => {
    const res = await admin.get('/api/wuhan-double-blind', { token: null });
    assertEqual(res.status, 200, 'HTTP 状态');
    const d = res.body.data;
    assert(d.doubleBlind && d.doubleBlind.text, '应有双盲机制说明');
    assert(d.summary.headcount > 0, '人数 > 0');
    assert(d.provinces[0].items.every((i) => i.doubleBlind === true), '武汉两场都标双盲');
  });

  s.test('诚实边界：forecast 块一律标 forecast，带结论块必须带来源', async () => {
    for (const key of ALL_KEYS) {
      const res = await admin.get(`/api/categories/${key}/detail`, { token: null });
      const d = res.body.data;
      if (d.forecast) {
        assertEqual(d.forecast.level, 'forecast', `${key} 预测块必须标 forecast`);
        assert(d.forecast.sourceUrl, `${key} 预测块应带来源链接`);
      }
      if (d.thisYear) {
        assert(['official', 'thirdparty'].includes(d.thisYear.level), `${key} 今年动态级别应在白名单内`);
        assert(d.thisYear.sourceUrl, `${key} 今年动态应带来源链接`);
      }
      if (d.hukou) {
        assert(['open', 'fresh', 'local', 'mixed'].includes(d.hukou.level), `${key} 户籍级别应在白名单内`);
        assert(d.hukou.sourceUrl, `${key} 户籍口径应带来源链接`);
      }
      for (const n of d.notes) {
        if (n.sourceUrl) assert(n.sourceUrl.startsWith('http'), `${key} 备注来源应为 http(s)`);
      }
    }
  });

  return s;
}
