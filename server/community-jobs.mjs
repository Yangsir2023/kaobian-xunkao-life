/**
 * 2026 年全国社区工作者招聘公告清单。
 *
 * ── 为什么有这个文件 ─────────────────────────────────────────
 * 社区工作者是「巡考」里发布最碎的一类：没有全国统一考试，由各省市、区县、
 * 街道各自发文，一年到头随时在出。原来分类页只放了寥寥几条，根本看不出
 * 「到底还有多少地方在招」。这份清单把 2026 年已经公开发文的公告按省收下来，
 * 让人一眼看到：哪些地方还在报名、哪些刚截止、哪些马上开。
 *
 * ── 数据诚实边界（务必先读）────────────────────────────────────
 * 与 server/announcement-archive.mjs 同一套级别语言：
 *   official    政府门户 / 人事考试中心 / 招聘平台上的公告原文链接
 *   thirdparty  第三方机构（中公 / 华图 / 粉笔 / 易考吧 / 厚职 / 媒体）汇总或转载
 *
 * 收录纪律：
 *   1. 每条必须有 sourceUrl（测试强制校验）；
 *   2. 人数、报名窗口能从来源材料读到才写，读不到就留 null，前端显示「见原文」，
 *      不用「往年同期」补齐、不猜；
 *   3. 同一份汇总页支撑多条记录时，把汇总页链接写在该条的 sourceUrl 上，
 *      不伪造单条公告的独立链接；
 *   4. `abroad` 字段只在公告原文**明确写了**国（境）外学历怎么处理时才填，
 *      读不到就留 null——留学生能不能报，以当年公告原文为准。
 *
 * ── 覆盖度声明（重要）────────────────────────────────────────
 * 全国社区工作者招聘没有统一入口，公告散落在省 / 市 / 区县 / 街道四级官网，
 * 且全年滚动发布。这份清单**不是**全国穷举，只能说「检索到的、能拿到来源链接的」。
 * 缺的省份不代表没招，只代表没检索到可引用的原文。见 caveat 字段原文。
 */
import { RECOMMEND_LEVELS } from './best-recommend.mjs';

export const COMMUNITY_JOB_LEVELS = RECOMMEND_LEVELS.filter((l) => l.key !== 'forecast');
export const COMMUNITY_JOB_LEVEL_KEYS = COMMUNITY_JOB_LEVELS.map((l) => l.key);

/**
 * 省份构造器：items 里没单独写 sourceUrl 的，统一用省份级默认来源。
 * 这样同一份汇总页支撑十几条记录时不用把链接抄十几遍，也不会出现假链接。
 */
const P = (key, name, sourceUrl, sourceName, level, items) => ({
  key,
  name,
  items: items.map((it) => ({
    area: it.area,
    count: it.count,
    level: it.level || level,
    register: it.register || null,
    exam: it.exam || null,
    hukou: it.hukou || null,
    abroad: it.abroad || null,
    sourceUrl: it.sourceUrl || sourceUrl,
    sourceName: it.sourceName || sourceName,
  })),
});

/* ══════════════════ 华北 ══════════════════ */
const BEIJING = P(
  'beijing',
  '北京',
  'http://www.bjchy.gov.cn/affair/civilemployed/zhk/4028805a9e76c851019e85ee13d60ab9.html',
  '北京市朝阳区人民政府 · 朝阳区 2026 年社区工作者招聘公告',
  'official',
  [
    {
      area: '朝阳区',
      count: 456,
      register: '6-09 09:00 — 6-11 17:00',
      hukou: '朝阳区户籍',
      abroad: '设应届生专岗，明确「2024-01-01 至 2026-07-31 取得国（境）外学位并完成学历认证」可报；随军家属专岗 40 名另行定向',
    },
  ],
);

const TIANJIN = P(
  'tianjin',
  '天津',
  'https://www.zgsqks.com/2026/gg_0114/66864.html',
  '中公社区工作者考试网 · 天津市部分区 2026 年度社区工作者招聘公告（原文来源：天津市委社会工作部公众号）',
  'thirdparty',
  [
    {
      area: '滨海新区 / 红桥 / 东丽 / 西青 / 津南 / 宝坻 / 静海等部分区',
      count: 241,
      register: '1-21 09:00 — 1-27 16:00',
      exam: '笔试 3-08 · 面试 4-18—4-19',
      hukou: '天津市普通高校 2026 届本科及以上，或具有天津市户籍（含集体户口）的本科及以上',
      abroad: '公告明确「国境外留学须做学历、学位认证」',
    },
  ],
);

const HEBEI = P(
  'hebei',
  '河北',
  'https://wei.gov.cn/a/2026/newsshow_56099.html',
  '魏县党政网 · 魏县 2026 年公开招聘社区工作者公告',
  'official',
  [
    {
      area: '邯郸市魏县',
      count: 120,
      hukou: '本人或父母、配偶、配偶父母具有魏县户籍',
      abroad: '在国（境）外取得学历的人员，须于 2026-07-31 前完成教育部留学服务中心学历、学位认证',
    },
  ],
);

const SHANXI = P(
  'shanxi',
  '山西',
  'https://www.sxrb.com/content/202606/02/c175736.html',
  '山西新闻网 · 2026 年山西省公开招募 3000 名高校毕业生担任社区助理公告',
  'thirdparty',
  [
    {
      area: '全省各县（市、区）',
      count: 3000,
      register: '6-01 — 6-15',
      hukou: '不限户籍，限全日制普通高校 2026 届应届毕业生（大专及以上）',
      abroad: '取得国外学历的报名人员，须提供教育部留学服务中心出具的国外学历学位认证书',
    },
  ],
);

const NEIMENGGU = P(
  'neimenggu',
  '内蒙古',
  'https://www.zgsqks.com/2026/gg_0113/70717.html',
  '中公社区工作者考试网 · 2026 年内蒙古社区工作者招聘公告汇总',
  'thirdparty',
  [
    { area: '包头市昆都仑区', count: 200, hukou: '昆区户籍（社会工作专业毕业生不限户籍）' },
    {
      area: '赤峰市喀喇沁旗',
      count: 65,
      register: '8-01 09:00 — 8-05 24:00',
      exam: '笔试 8-15 09:00—11:00',
      hukou: '喀喇沁旗户籍',
      sourceUrl: 'https://www.offcn.com/shequ/2026/0725/144867.html',
      sourceName: '中公教育 · 2026 年赤峰市喀喇沁旗招聘社区工作者 65 人公告',
    },
  ],
);

/* ══════════════════ 东北 ══════════════════ */
const LIAONING = P(
  'liaoning',
  '辽宁',
  'https://m.fenbi.com/page/fenxiaozhaokaodetail/23/0/467396181644288',
  '粉笔 · 辽宁阜新市 2026 年面向社会公开招聘专职社区工作者公告（发文：中共阜新市委社会工作部）',
  'thirdparty',
  [
    {
      area: '阜新市（彰武 10 / 海州 30 / 细河 29 / 太平 19）',
      count: 88,
      register: '6-30 08:30 — 7-04 18:00',
      exam: '笔试 7-19 09:00—11:00',
      hukou: '报考岗位所在县区户籍',
    },
  ],
);

const HEILONGJIANG = P(
  'heilongjiang',
  '黑龙江',
  'https://m.huatu.com/rili/hlj/sqgz/2026',
  '华图教育 · 2026 年黑龙江社区工作者招聘公告日历',
  'thirdparty',
  [
    {
      area: '佳木斯市富锦市（面向社区专职网格员）',
      count: 207,
      register: '5-18 — 5-21',
    },
    {
      area: '绥化市青冈县',
      count: 30,
      register: '5-06 08:30 — 5-11 17:30',
      hukou: '青冈县户籍',
      sourceUrl: 'https://www.offcn.com/shequ/2026/0421/142186.html',
      sourceName: '中公教育 · 2026 年绥化市青冈县招聘社区工作者 30 人公告',
    },
    {
      area: '伊春市',
      count: 156,
      register: '9-20 — 9-24',
      sourceUrl: 'https://rili.huatu.com/sqgz/2026/',
      sourceName: '华图公考日历 · 2026 年社区工作者考试时间汇总',
    },
    {
      area: '齐齐哈尔市龙沙区',
      count: 40,
      register: '9-21 — 9-23（现场报名）',
      hukou: '龙沙区户籍',
      sourceUrl: 'https://hlj.huatu.com/2026/0914/2069221.html',
      sourceName: '黑龙江华图 · 2026 年齐齐哈尔市龙沙区公开招聘社区工作者 40 人公告（原文来源：龙沙区人民政府）',
    },
  ],
);

const JILIN = P(
  'jilin',
  '吉林',
  'https://rili.huatu.com/sqgz/2026/',
  '华图公考日历 · 2026 年社区工作者考试时间汇总',
  'thirdparty',
  [
    { area: '（本次检索未取到可引用的 2026 年吉林公告原文）', count: null },
  ],
);

/* ══════════════════ 华东 ══════════════════ */
const SHANGHAI = P(
  'shanghai',
  '上海',
  'https://m.sh.offcn.com/html/2026/01/293391.html',
  '上海中公教育 · 2026 年上海各区社区工作者招聘公告汇总',
  'thirdparty',
  [
    { area: '浦东新区（第一批）', count: 506, register: '4-03 10:00 — 4-10 16:00', exam: '笔试 5-10' },
    { area: '浦东新区（第二批）', count: 308, register: '9-09 — 9-15', exam: '笔试 10-18' },
    { area: '青浦区', count: 207, register: '9-13 — 9-15', exam: '笔试 10-11' },
    { area: '宝山区', count: 191, register: '5-29 10:00 — 6-02 16:00', exam: '笔试 6-13' },
    { area: '闵行区', count: 180, register: '6-09 — 6-12', exam: '笔试 7-12' },
    { area: '徐汇区', count: 146, register: '6-08 09:00 — 6-12 16:00', exam: '笔试 6-28' },
    { area: '杨浦区', count: 135, register: '6-22 10:00 — 6-26 16:00', exam: '笔试 7-11' },
    { area: '嘉定区', count: 132, register: '7-20 10:00 — 7-22 16:00' },
    { area: '奉贤区（社工 110 + 防疫哨员 15）', count: 125, register: '4-17 10:00 — 4-23 16:00', exam: '笔试 5-31' },
    { area: '静安区', count: 154, register: '5-27 10:00 — 6-01 16:00', exam: '笔试 6-06' },
    {
      area: '长宁区（26 个职位，含随军家属专岗）',
      count: 94,
      register: '6-15 10:00 — 6-17 16:00',
      exam: '笔试 6-27',
    },
    { area: '黄浦区', count: 94, register: '8-14 10:00 — 8-16 16:00', exam: '笔试 9-12' },
    { area: '虹口区', count: 69, register: '6-08 10:00 — 6-12 16:00', exam: '笔试 6-28' },
    { area: '松江区', count: 76, register: '6-20 10:00 — 6-24 16:00' },
    { area: '崇明区', count: 35, register: '6-22 10:00 — 6-29 16:00', exam: '笔试 7-18' },
    { area: '金山区', count: 15, register: '7-02 10:00 — 7-08 16:00' },
    { area: '普陀区（一笔多面，一次笔试全年有效）', count: null, register: '2-25 10:00 — 3-03 16:00' },
  ],
);

const ZHEJIANG = P(
  'zhejiang',
  '浙江',
  'https://zj.offcn.com/html/2026/01/495380.html',
  '浙江中公教育 · 2026 年浙江社区工作者考试报名时间提醒（按地市公告整理）',
  'thirdparty',
  [
    { area: '杭州市钱塘区', count: 85, register: '1-27 — 2-01' },
    { area: '温州市平阳县', count: 47, register: '3-25 — 3-31' },
    { area: '温州市瓯海区', count: 6, register: '3-24 — 3-30' },
    { area: '宁波市镇海区', count: 19, register: '4-09 — 4-15' },
    { area: '嘉兴市秀洲区', count: 33, register: '5-10 — 5-12' },
    { area: '嘉兴市海盐县', count: 16, register: '5-18 — 5-19' },
    { area: '杭州市萧山区（社区专职 + 两新党务）', count: 94, register: '5-25 — 6-07' },
    { area: '绍兴市上虞区', count: 42, register: '5-25 — 5-29' },
    { area: '嘉兴市南湖区', count: 18, register: '6-15 — 6-17' },
    { area: '宁波市北仑区', count: 26, register: '6-10 — 6-15' },
    { area: '衢州市柯城区（第一批）', count: 22, register: '6-09 — 6-15' },
    { area: '衢州市柯城区（第二批）', count: 15, register: '6-09 — 6-15' },
    { area: '宁波市海曙区', count: 23, register: '6-23 — 6-27' },
    { area: '宁波市鄞州区', count: 47, register: '6-26 — 7-02' },
    { area: '台州市临海市', count: 12, register: '6-12 — 6-18' },
    { area: '丽水市青田县', count: 18, register: '7-13 — 7-20' },
    { area: '杭州市西湖区（社区专职 + 两新党务）', count: 28, register: '7-24 — 7-30' },
    { area: '衢州市常山县', count: 17, register: '7-27 — 8-03' },
    { area: '台州市仙居县', count: 17, register: '8-01 — 8-05' },
    { area: '台州市温岭市', count: 30, register: '8-05 — 8-12' },
    { area: '金华市义乌市', count: 150, register: '8-17 — 8-19' },
    { area: '绍兴市柯桥区', count: 26, register: '8-25' },
    { area: '衢州市龙游县', count: 15, register: '8-27 — 9-02', exam: '笔试 9-12' },
    { area: '宁波市象山县', count: 11, register: '9-12 — 9-13' },
    { area: '宁波市奉化区', count: 16, register: '9-14 — 9-17' },
    { area: '杭州高新区（滨江）专业聘用制', count: 47, register: '8-06 — 8-14' },
    { area: '杭州市拱墅区', count: 58, register: '9-22 — 9-24' },
    { area: '宁波市宁海县', count: 17, register: '9-16 — 9-20' },
    { area: '杭州市淳安县', count: 15, register: '9-16 — 9-21' },
    { area: '丽水市遂昌县', count: 9, register: '9-20 — 9-24' },
    { area: '温州市瑞安市', count: 49, register: '10-08 — 10-13' },
    {
      area: '金华市武义县',
      count: 8,
      register: '10-08 08:30 — 10-13 17:00',
      exam: '笔试 10-24',
      sourceUrl: 'https://www.shiyebian.com/xinxi/46177.html',
      sourceName: '事业单位招聘考试网 · 2026 年度武义县招考专职社区工作者公告',
    },
    { area: '台州市三门县', count: 4, register: '10-12 — 10-16' },
    { area: '温州市文成县（社区矫正社工）', count: 3, register: '7-29 — 8-05' },
  ],
);

const SHANDONG = P(
  'shandong',
  '山东',
  'http://sq.chinasydw.cn/sd/quanbu/',
  '厚职社区工作者考试网 · 2026 年山东社区工作者招聘公告汇总（转载自政府官网）',
  'thirdparty',
  [
    {
      area: '德州市德城区',
      count: 100,
      register: '4-23 — 4-28',
      exam: '笔试 5-10',
      hukou: '德城区户籍（2022 年以来在德城区备案且在岗专职网格员不受户籍限制）',
      sourceUrl: 'http://www.decheng.gov.cn/n55840578/n55840694/c99680220/content.html',
      sourceName: '德州市德城区人民政府 · 2026 年公开招聘城市社区专职工作者公告',
      level: 'official',
    },
    {
      area: '济宁市兖州区',
      count: 50,
      register: '4-13 09:00 — 4-19 16:00',
      exam: '笔试 4-26',
      sourceUrl: 'http://www.yanzhou.gov.cn/art/2026/4/7/art_27843_2796346.html',
      sourceName: '济宁市兖州区人民政府 · 2026 年城市社区专职工作者公开招考简章',
      level: 'official',
    },
    {
      area: '德州市夏津县',
      count: 40,
      register: '7-15 09:00 — 7-21 16:00',
      exam: '笔试 8-06 09:00—11:00',
      sourceUrl: 'http://www.xiajin.gov.cn/n31121408/n31122705/c100774350/content.html',
      sourceName: '夏津县人民政府 · 2026 年夏津县公开招聘社区工作者公告',
      level: 'official',
    },
    { area: '威海市环翠区', count: 80 },
    { area: '烟台市龙口市', count: 30 },
    { area: '烟台市招远市', count: 30, register: '7-28 09:00 — 7-29 16:00' },
    { area: '聊城市东昌府区', count: 30 },
    { area: '德州市乐陵市', count: 24 },
    { area: '济宁市太白湖新区', count: 20 },
    { area: '青岛市即墨区（乡村振兴专员）', count: 20 },
    { area: '滨州市（社区金融专员）', count: 16 },
    { area: '临沂市总工会（工会社工）', count: 36 },
  ],
);

const JIANGSU = P(
  'jiangsu',
  '江苏',
  'https://rili.huatu.com/sqgz/2026/',
  '华图公考日历 · 2026 年社区工作者考试时间汇总',
  'thirdparty',
  [
    { area: '（本次检索未取到可引用的 2026 年江苏公告原文）', count: null },
  ],
);

const ANHUI = P(
  'anhui',
  '安徽',
  'https://rili.huatu.com/sqgz/2026/',
  '华图公考日历 · 2026 年社区工作者考试时间汇总',
  'thirdparty',
  [
    { area: '（本次检索未取到可引用的 2026 年安徽公告原文）', count: null },
  ],
);

const FUJIAN = P(
  'fujian',
  '福建',
  'https://www.fjtv.net/haibo5/folder8620/folder8559/2026-06-02/7156000.html',
  '福建网络广播电视台 · 2026 年福建省高校毕业生服务社区计划（多地招募）',
  'thirdparty',
  [
    { area: '三明市（三元 9 / 沙县 6 / 永安 7 等 11 个县区）', count: 50, register: '5-25 — 6-10' },
    { area: '南平市', count: 45, register: '6-02 09:00 — 6-08 18:00' },
    { area: '龙岩市', count: 45, register: '5-28 08:00 — 6-03 18:00' },
    { area: '莆田市（仙游县）', count: 10, register: '6-01 09:00 — 6-05 17:00' },
  ],
);

const JIANGXI = P(
  'jiangxi',
  '江西',
  'https://www.etest8.com/shequ/jiangxi/tongzhi/15620660.html',
  '易考吧 · 2026 年江西省吉安市公开招聘社区工作者公告',
  'thirdparty',
  [
    {
      area: '吉安市（全市统考）',
      count: 138,
      register: '7-06 — 7-10',
      exam: '笔试 7 月下旬（科目：基础知识 + 写作）',
    },
    {
      area: '赣州市大余县（社区工作者 / 专职网格员）',
      count: 9,
      register: '10-12 — 10-16（现场报名 + 邮箱）',
      sourceUrl: 'https://www.zgsqks.com/2026/gg_1012/71693.html',
      sourceName: '中公社区工作者考试网 · 2026 年赣州大余县社区工作者（专职网格员）招聘公告',
    },
  ],
);

/* ══════════════════ 华中 ══════════════════ */
const HENAN = P(
  'henan',
  '河南',
  'http://www.hnrsks.com/sitesources/hnsrskszx/page_pc/zngg/article3ba9c135f9b3438a85358046bc8ffdae.html',
  '河南省人事考试中心 · 2026 年社区网格事务协理员专项计划公告（省委组织部 / 省委社工部 / 省人社厅 / 省教育厅联合发文）',
  'official',
  [
    {
      area: '全省各省辖市（统一笔试、分市组织）',
      count: 10000,
      register: '6-04 09:00 — 6-10 17:00',
      exam: '笔试 6-28 09:00—11:00（科目：公共基础知识）',
      hukou: '不限户籍；面向 2024 / 2025 / 2026 届高校毕业生（本科及以上学历并具相应学位，38 周岁以下）',
      abroad: '公告未单独写明国（境）外学历口径，留学生需向意向省辖市招聘工作小组确认',
    },
  ],
);

const HUBEI = P(
  'hubei',
  '湖北',
  'http://www.shashi.gov.cn/ssqxw/ssyw/202608/t20260827_1131523.shtml',
  '荆州市沙市区人民政府 · 沙市区 2026 年公开招聘社区工作者公告',
  'official',
  [
    {
      area: '荆州市沙市区（6 街道 + 关沮镇）',
      count: 44,
      register: '9-01 09:00 — 9-08 17:00',
      exam: '笔试 9-19 09:00—11:30（公共基础知识 + 社区工作实务，满分 200）',
      hukou: '沙市区户籍 / 配偶为沙市区户籍 / 沙市区房产 / 沙市区常住居民，满足其一',
      abroad: '资格复审材料明确：留学回国人员须提供教育部中国留学服务中心出具的境外学历学位认证书',
    },
    {
      area: '武汉市江夏区',
      count: 48,
      register: '公告发布起 — 4-08 12:00',
      exam: '笔试科目《公共基础知识 + 社区工作专业知识》，合格线 60 分',
      hukou: '江夏区户籍；或武汉户籍且在江夏有房产 / 租房协议 / 暂住证',
      sourceUrl: 'https://www.jiangxia.gov.cn/zzzq/zzzq_gsgg/202604/P020260401421235145164.pdf',
      sourceName: '武汉市江夏区人民政府 · 江夏区 2026 年公开招聘社区专职工作人员公告（PDF 原文）',
    },
    {
      area: '宜昌市当阳市',
      count: 12,
      register: '7-13 08:30 — 7-17 17:30',
      hukou: '当阳市户籍或常住人口',
      sourceUrl:
        'http://www.dangyang.gov.cn/site_352_dangyangzixun/pcms_352_gongshigonggao_7/6a549b755e05d199ff7cdf72.html',
      sourceName: '当阳市人民政府 · 2026 年当阳市社区工作者招聘公告',
    },
  ],
);

const HUNAN = P(
  'hunan',
  '湖南',
  'https://www.zgsqks.com/2026/gg_0422/71527.html',
  '中公社区工作者考试网 · 2026 年浏阳市公开招聘社区专职工作人员公告',
  'thirdparty',
  [
    {
      area: '长沙市浏阳市',
      count: 14,
      hukou: '浏阳户籍 / 浏阳居住证 / 原浏阳户籍因升学迁出 / 本人配偶双方父母在浏阳有住房，满足其一',
    },
  ],
);

/* ══════════════════ 华南 ══════════════════ */
const GUANGDONG = P(
  'guangdong',
  '广东',
  'https://www.dingtiku.cn/sku/examination/detail/127/4863',
  '钉题库 · 2026 年下半年广东社区工作者公告汇总（附各公告原文链接）',
  'thirdparty',
  [
    {
      area: '广州市天河区（A 岗 37 面向社会 / B 岗 15 面向在岗编外）',
      count: 52,
      register: '8-02 09:00 — 8-04 18:00',
      exam: '笔试 8-16',
      hukou: '广州市户籍或有效期内广州居住证满 3 年（社保连续满 3 年视同）；非本市户籍的广州高校 2026 届应届生不受居住证限制',
      sourceUrl: 'http://www.thnet.gov.cn/thdt/tzgg/rsxx/rszp/content/post_10944302.html',
      sourceName: '广州市天河区人民政府 · 天河区 2026 年公开招聘社区专职工作人员公告',
      level: 'official',
    },
    {
      area: '广州市越秀区',
      count: 46,
      register: '7-12 09:00 — 7-14 18:00',
      sourceUrl: 'http://www.yuexiu.gov.cn/yxdt/tzgg/content/post_10894947.html',
      sourceName: '广州市越秀区人民政府 · 越秀区 2026 年招聘社区专职工作人员公告',
      level: 'official',
    },
    {
      area: '广州市荔湾区',
      count: 39,
      register: '6-24 09:00 — 6-26 18:00',
      sourceUrl:
        'https://lwsqzz2026.zhaopin.com/zk/#/notice_new?prantMenuid=b817b885028f4f2f9ad57f1460e2b9b0',
      sourceName: '荔湾区 2026 年社区专职工作人员招聘报名平台 · 公告原文',
      level: 'official',
    },
    {
      area: '广州市海珠区',
      count: 23,
      register: '5-26 09:00 — 5-28 17:00',
      sourceUrl: 'https://www.offcn.com/shequ/2026/0525/143086.html',
      sourceName: '中公教育 · 2026 年广州海珠区社区专职工作人员招聘 23 人公告',
    },
    {
      area: '佛山市南海区桂城街道（社区创熟专职）',
      count: 25,
      register: '6-29 — 7-03',
      sourceUrl: 'http://www.nanhai.gov.cn/fsnhq/bmdh/zj/gcjdb/xxgkml/tzgg/content/post_7180747.html',
      sourceName: '佛山市南海区人民政府 · 桂城街道招聘社区创熟专职工作人员公告',
      level: 'official',
    },
    {
      area: '汕尾市总工会（工会社会工作者）',
      count: 30,
      register: '8-03 09:00 — 8-07 16:00',
      sourceUrl: 'https://www.shanwei.gov.cn/swrsj/ztzl/rsks/qtzp/content/post_1265577.html',
      sourceName: '汕尾市人力资源和社会保障局 · 总工会招聘工会社会工作者公告',
      level: 'official',
    },
  ],
);

const GUANGXI = P(
  'guangxi',
  '广西',
  'https://rili.huatu.com/sqgz/2026/',
  '华图公考日历 · 2026 年社区工作者考试时间汇总',
  'thirdparty',
  [
    {
      area: '南宁市青秀区（专职化城市社区工作者）',
      count: 99,
      register: '10-12 08:30 — 10-16 17:00',
      exam: '笔试 10-24 09:00—11:00',
      sourceUrl: 'https://gx.huatu.com/2026/1009/2092327.html',
      sourceName: '广西华图 · 2026 年南宁市青秀区招聘专职化城市社区工作者 99 人公告',
    },
    { area: '梧州市龙圩区', count: 27, register: '8-18' },
    { area: '防城港市港口区', count: 22, register: '9-01' },
    { area: '柳州市城中区', count: 5, register: '9-04' },
    { area: '来宾市忻城县总工会', count: 2, register: '9-04' },
    { area: '玉林市北流市残联', count: 3, register: '9-07' },
    { area: '崇左市凭祥市', count: 2, register: '9-14' },
    { area: '河池市总工会', count: 3, register: '9-14' },
    { area: '百色市平果市总工会', count: 2, register: '8-12' },
    { area: '北海市合浦县', count: 4, register: '7-30' },
    { area: '贺州市八步区江南街道', count: 1, register: '7-31' },
    { area: '柳州市柳南区河西街道', count: 2, register: '8-04' },
  ],
);

const HAINAN = P(
  'hainan',
  '海南',
  'https://rili.huatu.com/sqgz/2026/',
  '华图公考日历 · 2026 年社区工作者考试时间汇总',
  'thirdparty',
  [{ area: '（本次检索未取到可引用的 2026 年海南公告原文）', count: null }],
);

/* ══════════════════ 西南 ══════════════════ */
const CHONGQING = P(
  'chongqing',
  '重庆',
  'https://m.huatu.com/rili/cq/sqgz/',
  '华图教育 · 2026 年重庆社区工作者招聘公告日历',
  'thirdparty',
  [
    {
      area: '綦江区',
      count: 300,
      register: '10-12 — 10-15',
    },
    {
      area: '万州区（同步建立 100 人后备库）',
      count: 53,
      register: '8-10 09:00 — 8-14 17:00',
      exam: '笔试 8-22 09:00—10:30 · 面试 8-23',
      hukou: '不限户籍（年龄 18—43 周岁，大专及以上，专业不限）',
      sourceUrl: 'https://pc.fenbi.com/page/exam-information-detail/468274288021504',
      sourceName: '粉笔 · 重庆市万州区 2026 年公开招聘社区工作者公告',
    },
    {
      area: '垫江县（桂阳 22 / 桂溪 26 / 澄溪 2 / 桂东 1）',
      count: 51,
      register: '8-08 09:00 — 8-10 18:00',
      exam: '笔试 8-15（科目《综合知识》）',
      sourceUrl: 'https://m.etest8.com/shequ/chongqing/tongzhi/15864671.html',
      sourceName: '易考吧 · 2026 年重庆市垫江县公开招聘选拔社区工作者及后备人选 51 人公告',
    },
    {
      area: '秀山土家族苗族自治县',
      count: 30,
      register: '8-04 — 8-05',
      exam: '笔试 8-08（科目《综合能力测试》）',
      sourceUrl: 'https://www.etest8.com/shequ/chongqing/tongzhi/15846030.html',
      sourceName: '易考吧 · 2026 年重庆市秀山县招聘社区专职 30 人公告',
    },
    {
      area: '北碚区（从社区专职后备人选库中招聘，只面试不笔试）',
      count: 39,
      register: '9-11 15:00 — 9-13 18:00',
      exam: '结构化面试，合格线 70 分',
      sourceUrl: 'https://beibei.gov.cn/zwxx_239/gggs/202609/t20260911_16064773.html',
      sourceName: '重庆市北碚区人民政府 · 2026 年北碚区从社区专职工作人员后备人选库中招聘社区工作者的公告',
      level: 'official',
    },
    { area: '梁平区', count: 9, register: '7-06 — 7-12' },
    { area: '綦江区丛林镇', count: 10, register: '8-11 — 8-17' },
  ],
);

const SICHUAN = P(
  'sichuan',
  '四川',
  'https://www.pidu.gov.cn/pidu/c125580/2026-05/27/content_7d4c81af6e084c41ac71edccc994bef8.shtml',
  '成都市郫都区人民政府 · 2026 年郫都区面向社会公开招聘城乡社区专职工作者公告',
  'official',
  [
    {
      area: '成都市郫都区（城乡社区专职，编制外）',
      count: 95,
      register: '5-27 — 6-04 12:00',
      hukou: '不限户籍（本科及以上，1986-05-27 及以后出生）',
    },
    {
      area: '成都市简阳市（四级城乡社区工作者）',
      count: 30,
      register: '9-21 — 9-30 17:00',
      hukou: '不限户籍（本科及以上，40 周岁以下）',
      abroad: '公告明确：执国（境）外文凭者需同时提供国家教育部认证的留学学历证明',
      sourceUrl: 'https://www.rc114.com/html/quyu/2026/0928/56523.htm',
      sourceName: '成都人才网 · 2026 年简阳市公开招聘四级城乡社区工作者公告',
      level: 'thirdparty',
    },
    {
      area: '成都市（社会工作服务岗位计划，市级统筹）',
      count: 159,
      register: '7-17 09:00 — 7-21 17:00',
      hukou: '面向 2026 届及 2023—2025 届未就业高校毕业生',
      sourceUrl: 'https://www.scpublic.cn/news/getNewsDatail?id=873069',
      sourceName: '四川发布 · 2026 年成都市社会工作服务岗位计划招募 159 人',
      level: 'thirdparty',
    },
    {
      area: '成都市成华区猛追湾街道（四级社区工作者）',
      count: 4,
      register: '6-16 — 6-18（现场报名）',
      sourceUrl:
        'https://www.chenghua.gov.cn/gkml/cdschqrmzfmzwjdbsc/zkly/1516124717713457152.shtml',
      sourceName: '成都市成华区人民政府 · 猛追湾街道 2026 年公开招聘社区工作人员公告',
    },
    {
      area: '成都市成华区万年场街道（四级一类）',
      count: 6,
      register: '4-07 — 4-09（现场报名）',
      sourceUrl: 'https://m.offcn.com/shequ/2026/0408/141849.html',
      sourceName: '中公教育 · 2026 年成都成华区万年场街道招聘社区工作者 6 人公告',
      level: 'thirdparty',
    },
    {
      area: '遂宁市经开区（社会 15 + 网格 14）',
      count: 29,
      register: '6-16 — 6-18',
      hukou: '遂宁市主城区户籍（大专及以上）',
      sourceUrl: 'https://snjkq.suining.gov.cn/xinwen/show/664f53a3ccf7c73a90501fe7f43c2a66.html',
      sourceName: '遂宁经济技术开发区管委会 · 2026 年公开招聘社区工作者公告',
    },
  ],
);

const GUIZHOU = P(
  'guizhou',
  '贵州',
  'https://rili.huatu.com/sqgz/2026/',
  '华图公考日历 · 2026 年社区工作者考试时间汇总',
  'thirdparty',
  [{ area: '（本次检索未取到可引用的 2026 年贵州公告原文）', count: null }],
);

const YUNNAN = P(
  'yunnan',
  '云南',
  'https://rili.huatu.com/sqgz/2026/',
  '华图公考日历 · 2026 年社区工作者考试时间汇总',
  'thirdparty',
  [{ area: '（本次检索未取到可引用的 2026 年云南公告原文）', count: null }],
);

const XIZANG = P(
  'xizang',
  '西藏',
  'https://rili.huatu.com/sqgz/2026/',
  '华图公考日历 · 2026 年社区工作者考试时间汇总',
  'thirdparty',
  [{ area: '（本次检索未取到可引用的 2026 年西藏公告原文）', count: null }],
);

/* ══════════════════ 西北 ══════════════════ */
const SHAANXI = P(
  'shaanxi',
  '陕西',
  'https://xian.offcn.com/html/2026/05/175717.html',
  '西安中公教育 · 2026 年陕西社区工作者招聘公告汇总（各地市人数 / 报名时间）',
  'thirdparty',
  [
    { area: '榆林市', count: 879, register: '4-14 — 4-18', exam: '笔试 5-18' },
    { area: '西安市', count: 249, register: '6-03 — 6-07', exam: '笔试 6-29' },
    { area: '宝鸡市', count: 234, register: '10-27 — 10-29', exam: '笔试 11-08' },
    { area: '咸阳市秦都区', count: 230, register: '9-26 — 9-30', exam: '笔试 10-19' },
    { area: '渭南市', count: 153, register: '7-17 — 7-21', exam: '笔试 8-16' },
    { area: '汉中市', count: 124, register: '7-05 — 7-09', exam: '笔试 7-16' },
    { area: '安康市汉滨区', count: 121, register: '10-10 — 10-15', exam: '笔试 10-25' },
    { area: '咸阳市彬州市', count: 71, register: '7-19 — 7-23', exam: '笔试 8-02' },
    { area: '安康市紫阳县', count: 32, register: '7-12 — 7-18', exam: '笔试 7-27' },
    { area: '咸阳市渭城区', count: 37, register: '7-13 — 7-17', exam: '笔试 7-27' },
    { area: '咸阳市乾县', count: 36, register: '7-13 — 7-17', exam: '笔试 7-26' },
    { area: '延安市志丹县', count: 38, register: '7-22 — 7-28', exam: '笔试 8-16' },
    { area: '咸阳市三原县', count: 28, register: '7-10 — 7-14', exam: '笔试 7-26' },
    { area: '安康市高新区', count: 29, register: '10-27 — 10-31', exam: '笔试 11-15' },
    { area: '杨陵区', count: 30, register: '10-27 — 10-31', exam: '笔试 11-15' },
    { area: '安康市岚皋县', count: 20, register: '6-09 — 6-14', exam: '笔试 6-21' },
    { area: '延安市安塞区', count: 18, register: '10-18 — 10-22', exam: '笔试 11-16' },
    { area: '安康市石泉县', count: 16, register: '8-04 — 8-10' },
    { area: '安康市白河县', count: 16, register: '9-23 — 9-29' },
    { area: '咸阳市泾阳县', count: 11, register: '7-22 — 7-26', exam: '笔试 8-09' },
  ],
);

const GANSU = P(
  'gansu',
  '甘肃',
  'http://www.gsht.gov.cn/zwdt/TZGG/art/2026/art_f4309a57b499422da78240280cfb40d7.html',
  '华亭市人民政府 · 华亭市 2026 年公开招聘社区工作者公告',
  'official',
  [
    {
      area: '平凉市华亭市',
      count: 10,
      register: '3-09 09:00 — 3-13 18:00',
      hukou: '华亭生源或华亭市户籍（大专及以上，45 周岁以下）',
    },
    {
      area: '平凉市崆峒区（4 街道 + 2 镇）',
      count: 20,
      register: '7-07 08:30 — 7-08 18:00',
      sourceUrl: 'https://fenbi.com/page/fenxiaozhaokaodetail/19/0/467356379271168',
      sourceName: '粉笔 · 崆峒区 2026 年公开选聘社区工作者公告',
      level: 'thirdparty',
    },
  ],
);

const QINGHAI = P(
  'qinghai',
  '青海',
  'https://beijing.fenbi.com/zhaokao/detail/2589/469656092037120',
  '粉笔 · 2026 年西宁市城东区面向社会公开招聘社区工作人员公告',
  'thirdparty',
  [
    {
      area: '西宁市城东区',
      count: 3,
      register: '10-10 09:00 — 10-26 20:00',
      hukou: '青海省户籍，或西宁市（不含湟中 / 大通 / 湟源）长期居住并持当地居住证',
    },
    {
      area: '全省（工会社会工作者，省级统考）',
      count: 99,
      sourceUrl: 'http://sq.chinasydw.cn/',
      sourceName: '厚职社区工作者考试网 · 2026 年青海省面向社会公开招聘工会社会工作者公告汇总',
    },
  ],
);

const NINGXIA = P(
  'ningxia',
  '宁夏',
  'http://sq.chinasydw.cn/',
  '厚职社区工作者考试网 · 2026 年宁夏社区工作者招聘公告汇总',
  'thirdparty',
  [
    { area: '银川市兴庆区（补充招考）', count: 86 },
    { area: '吴忠市青铜峡市（社区专职后备人才）', count: 80 },
    { area: '吴忠市红寺堡区（补录）', count: 15 },
    { area: '银川市贺兰县（城市网格员）', count: 3 },
  ],
);

const XINJIANG = P(
  'xinjiang',
  '新疆',
  'http://sq.chinasydw.cn/',
  '厚职社区工作者考试网 · 2026 年新疆专职网格员 / 到村工作招聘公告汇总',
  'thirdparty',
  [
    { area: '哈密市第十三师红山农场（连队「两委」后备）', count: 7 },
    { area: '第十师一八一团（专职网格员）', count: 7 },
    { area: '昌吉州木垒县（到村工作大学生）', count: 6 },
    { area: '第十师北屯市 182 团（专职网格员）', count: 6 },
    { area: '阿拉尔市七团玛滩镇（专职网格员）', count: 4 },
  ],
);

export const COMMUNITY_JOBS = {
  updatedAt: '2026-10-15',
  year: 2026,
  intro:
    '社区工作者没有全国统一考试，由省 / 市 / 区县 / 街道四级各自发文，全年滚动出公告。这里把 2026 年检索到的、能拿到来源链接的公告按省收下来，用来回答一个问题：现在到底还有哪些地方在招。',
  caveat:
    '覆盖度声明：这份清单不是全国穷举。社区招聘公告散落在四级政府门户和第三方招聘平台，全年滚动发布，本次检索覆盖 30 个省区市，其中吉林、江苏、安徽、海南、贵州、云南、西藏 7 个省份未取到可引用的 2026 年公告原文，已在对应分组里标注「未取到」，不等于当地没招。人数合计只统计本清单内已列出的条目，不代表全国招录总规模。',
  levels: COMMUNITY_JOB_LEVELS,
  provinces: [
    BEIJING, TIANJIN, HEBEI, SHANXI, NEIMENGGU,
    LIAONING, JILIN, HEILONGJIANG,
    SHANGHAI, JIANGSU, ZHEJIANG, ANHUI, FUJIAN, JIANGXI, SHANDONG,
    HENAN, HUBEI, HUNAN,
    GUANGDONG, GUANGXI, HAINAN,
    CHONGQING, SICHUAN, GUIZHOU, YUNNAN, XIZANG,
    SHAANXI, GANSU, QINGHAI, NINGXIA, XINJIANG,
  ],
};

/** 汇总统计：只统计本清单里写明了人数的条目。 */
export function communityJobsSummary() {
  const provinces = COMMUNITY_JOBS.provinces;
  const items = provinces.flatMap((p) => p.items);
  const withCount = items.filter((it) => typeof it.count === 'number');
  const headcount = withCount.reduce((sum, it) => sum + it.count, 0);
  const officialCount = items.filter((it) => it.level === 'official').length;
  const abroadItems = items.filter((it) => it.abroad);
  return {
    updatedAt: COMMUNITY_JOBS.updatedAt,
    year: COMMUNITY_JOBS.year,
    provinceCount: provinces.length,
    provincesWithData: provinces.filter((p) => p.items.some((it) => typeof it.count === 'number')).length,
    itemCount: items.length,
    countedItemCount: withCount.length,
    headcount,
    officialCount,
    thirdpartyCount: items.length - officialCount,
    abroadCount: abroadItems.length,
    levelKeys: COMMUNITY_JOB_LEVEL_KEYS,
    caveat: COMMUNITY_JOBS.caveat,
  };
}

/** 导出给接口用的省份清单（每条都带来源）。 */
export function communityJobsByProvince() {
  return COMMUNITY_JOBS.provinces.map((p) => ({
    key: p.key,
    name: p.name,
    headcount: p.items.reduce((s, it) => s + (typeof it.count === 'number' ? it.count : 0), 0),
    items: p.items,
  }));
}
