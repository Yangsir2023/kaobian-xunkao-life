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

  s.test('考什么 · 备什么：目录与岗位行都带备考口径与官方入口', async () => {
    // 分类目录：16 类都带 examInfo（分类卡片与岗位详情弹层共用这份数据）
    const catRes = await admin.get('/api/catalog/categories', { token: null });
    const cats = catRes.body.data.categories;
    assertEqual(cats.length, 16, '分类数');
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
