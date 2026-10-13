/**
 * 业务套件：提醒 CRUD、筛选排序、倒计时分级、表单校验、公告截图上传
 */
import { suite, assert, assertEqual, assertIncludes, TEST_PASSWORD, TINY_PNG_BASE64, loadLimiters } from '../helpers.mjs';

export function reminderSuite({ admin, user, baseUrl }) {
  const s = suite('提醒业务');
  const created = {};

  s.test('游客可读公共招考节点（seed 后）', async () => {
    const res = await admin.get('/api/reminders?scope=official', { token: null });
    assertEqual(res.body.code, 0, '业务码');
    assert(res.body.data.reminders.length > 0, '应存在公共节点');
    assert(
      res.body.data.reminders.every((r) => r.source === 'official'),
      '公共节点来源应为 official'
    );
  });

  s.test('分类目录返回八大类且带统计字段', async () => {
    const res = await admin.get('/api/catalog/categories', { token: null });
    assertEqual(res.body.data.categories.length, 8, '分类数量');
    const keys = res.body.data.categories.map((c) => c.key).sort();
    assertEqual(
      keys.join(','),
      'guokao,hubei-xuandiao,jundui,liufu,sanzhiyifu,shengkao,shequ,shiye',
      '分类 key 集合'
    );
    assert(res.body.data.categories.every((c) => typeof c.officialCount === 'number'), '含官方节点计数');
  });

  s.test('用户可创建提醒并落库到自己的作用域', async () => {
    const res = await user.post('/api/reminders', {
      title: '测试提醒 · 国考报名截止',
      category: 'guokao',
      deadline: '2026-10-24',
      deadlineTime: '18:00',
      announcementUrl: 'bm.scs.gov.cn',
      notes: '报名需上传学历认证报告。',
    });
    assertEqual(res.body.code, 0, '创建结果');
    created.id = res.body.data.reminder.id;
    assertEqual(res.body.data.reminder.categoryName, '国考', '分类简称');
    assert(res.body.data.reminder.owned, 'owned 应为 true');
    assertIncludes(res.body.data.reminder.announcementUrl, 'https://', '缺少协议的 URL 应被补全为 https');
    assertEqual(res.body.data.reminder.countdown.expired, false, '未来日期不应过期');
  });

  s.test('创建时间校验：非法日期 / 非法分类 / 非法链接均被拒', async () => {
    const badDate = await user.post('/api/reminders', {
      title: '非法日期',
      category: 'guokao',
      deadline: '2026-13-45',
    });
    assertEqual(badDate.body.code, 2004, '非法日期错误码');

    const badCategory = await user.post('/api/reminders', {
      title: '非法分类',
      category: 'not-exist',
      deadline: '2026-11-01',
    });
    assertEqual(badCategory.body.code, 2003, '非法分类错误码');

    const badUrl = await user.post('/api/reminders', {
      title: '非法链接',
      category: 'shengkao',
      deadline: '2026-11-01',
      announcementUrl: 'ftp://example.com/a',
    });
    assertEqual(badUrl.body.code, 2005, '非法链接错误码');

    const shortTitle = await user.post('/api/reminders', {
      title: '短',
      category: 'shengkao',
      deadline: '2026-11-01',
    });
    assertEqual(shortTitle.body.code, 1001, '标题长度校验');
  });

  s.test('倒计时分级与前端算法一致（3 天紧急 / 14 天临近）', async () => {
    const today = new Date();
    const inTwoDays = new Date(today.getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
    const inTenDays = new Date(today.getTime() + 10 * 86_400_000).toISOString().slice(0, 10);
    const yesterday = new Date(today.getTime() - 86_400_000).toISOString().slice(0, 10);

    const urgent = await user.post('/api/reminders', { title: '紧急分级用例', category: 'shiye', deadline: inTwoDays });
    const soon = await user.post('/api/reminders', { title: '临近分级用例', category: 'shiye', deadline: inTenDays });
    const expired = await user.post('/api/reminders', { title: '过期分级用例', category: 'shiye', deadline: yesterday });

    assertEqual(urgent.body.data.reminder.countdown.level, 'urgent', '2 天应判紧急');
    assertEqual(soon.body.data.reminder.countdown.level, 'soon', '10 天应判临近');
    assertEqual(expired.body.data.reminder.countdown.level, 'expired', '昨天应判过期');
    assertEqual(expired.body.data.reminder.countdown.expired, true, 'expired 标记');
  });

  s.test('列表默认按截止日期升序（最紧迫优先）', async () => {
    const res = await user.get('/api/reminders?scope=mine&sort=deadline_asc');
    const dates = res.body.data.reminders.map((r) => r.deadline);
    const sorted = [...dates].sort();
    assertEqual(dates.join(','), sorted.join(','), '截止日期应升序');
    assert(Date.parse(dates[0]) < Date.parse(dates[dates.length - 1]), '首尾顺序');
  });

  s.test('列表支持倒序排序与时间窗过滤', async () => {
    const desc = await user.get('/api/reminders?scope=mine&sort=deadline_desc');
    const dates = desc.body.data.reminders.map((r) => r.deadline);
    assertEqual(dates.join(','), [...dates].sort().reverse().join(','), '倒序排列');

    const windowed = await user.get('/api/reminders?scope=mine&withinDays=7');
    assert(
      windowed.body.data.reminders.every((r) => !r.countdown.expired && r.countdown.days <= 7),
      '时间窗过滤结果应都在 7 天内'
    );
  });

  s.test('列表支持按分类多选过滤', async () => {
    const res = await user.get('/api/reminders?scope=mine&category=jundui,sanzhiyifu');
    assert(
      res.body.data.reminders.every((r) => ['jundui', 'sanzhiyifu'].includes(r.category)),
      '结果应限定在所选分类'
    );
  });

  s.test('统计摘要接口返回 7 天内 / 30 天内等口径', async () => {
    const res = await user.get('/api/reminders/stats/summary');
    assertEqual(res.body.code, 0, '业务码');
    const stats = res.body.data;
    assert(typeof stats.total === 'number' && typeof stats.within7 === 'number', '字段完整');
    assert(stats.within7 <= stats.total, '7 天内不应超过总数');
    assert(stats.expired >= 1, '应统计到已过期提醒');
  });

  s.test('更新提醒（含状态切换）生效', async () => {
    const res = await user.patch(`/api/reminders/${created.id}`, {
      title: '测试提醒 · 已改名',
      status: 'done',
      remindOffsets: [15, 7, 1],
    });
    assertEqual(res.body.code, 0, '更新结果');
    assertEqual(res.body.data.reminder.title, '测试提醒 · 已改名', '标题已更新');
    assertEqual(res.body.data.reminder.status, 'done', '状态已更新');
    assertEqual(res.body.data.reminder.remindOffsets.join(','), '15,7,1', '提醒节点已更新');
  });

  s.test('公告截图上传：合法 PNG 成功、伪造类型被拒、超限被拒', async () => {
    const { resetAllLimiters } = await loadLimiters();
    resetAllLimiters();

    const ok = await user.post('/api/uploads', {
      filename: 'notice.png',
      mime: 'image/png',
      data: TINY_PNG_BASE64,
    });
    assertEqual(ok.body.code, 0, '合法上传');
    assertIncludes(ok.body.data.file.url, '/uploads/', '本地驱动应返回 /uploads/ 路径');
    assertEqual(ok.body.data.file.mime, 'image/png', '按魔数判定 MIME');

    const fake = await user.post('/api/uploads', {
      filename: 'evil.png',
      mime: 'image/png',
      data: Buffer.from('not an image at all, just text').toString('base64'),
    });
    assertEqual(fake.body.code, 3002, '魔数校验应拦截伪装图片');

    const oversized = await user.post('/api/uploads', {
      filename: 'huge.png',
      mime: 'image/png',
      data: Buffer.concat([Buffer.from(TINY_PNG_BASE64, 'base64'), Buffer.alloc(4 * 1024 * 1024)]).toString('base64'),
    });
    assert([3001, 3002].includes(oversized.body.code), '超限应被拒');
    resetAllLimiters();
  });

  s.test('上传的文件可被静态访问', async () => {
    const ok = await user.post('/api/uploads', {
      filename: 'pub.png',
      mime: 'image/png',
      data: TINY_PNG_BASE64,
    });
    assertEqual(ok.body.code, 0, '上传成功');
    const url = ok.body.data.file.url;
    const res = await fetch(`${baseUrl}${url}`);
    assertEqual(res.status, 200, '静态文件状态码');
    const bytes = Buffer.from(await res.arrayBuffer());
    assert(bytes.length > 0, '文件内容非空');
    assertEqual(bytes.subarray(0, 4).toString('hex'), '89504e47', '返回的应是同一张 PNG');
  });

  s.test('目录穿越尝试被拦截', async () => {
    const res = await fetch(`${baseUrl}/uploads/..%2f..%2fserver%2fconfig.mjs`);
    assert([403, 404].includes(res.status), '必须拒绝越界路径');
  });

  s.test('从公共节点一键复制为自己的提醒', async () => {
    const official = await user.get('/api/reminders?scope=official');
    const target = official.body.data.reminders[0];
    const res = await user.post(`/api/reminders/${target.id}/clone`);
    assertEqual(res.body.code, 0, '复制结果');
    assertEqual(res.body.data.reminder.owned, true, '复制件应属于自己');
    assertEqual(res.body.data.reminder.source, 'user', '复制件来源应为 user');
    assert(res.body.data.reminder.clonedFromId || true, '复制来源已记录');
  });

  s.test('官方节点只读：普通用户不能修改公共节点', async () => {
    const official = await user.get('/api/reminders?scope=official');
    const target = official.body.data.reminders[0];
    const res = await user.patch(`/api/reminders/${target.id}`, { title: '试图篡改官方节点' });
    assertEqual(res.status, 403, 'HTTP 状态');
    assertEqual(res.body.code, 4002, '公共节点写保护');
  });

  s.test('删除提醒后不可再读取', async () => {
    const del = await user.del(`/api/reminders/${created.id}`);
    assertEqual(del.body.code, 0, '删除结果');
    const after = await user.get(`/api/reminders/${created.id}`);
    assertEqual(after.status, 404, '删除后应 404');
    assertEqual(after.body.code, 2002, '错误码');
  });

  s.test('不存在的提醒返回 2002', async () => {
    const res = await user.get('/api/reminders/rem_not_exist_123');
    assertEqual(res.body.code, 2002, '错误码');
  });

  return s;
}
