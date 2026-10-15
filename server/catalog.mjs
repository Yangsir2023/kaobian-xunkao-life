/**
 * 考试分类目录：前端筛选、后端校验、类型配色共享同一份定义（单一事实来源）。
 *
 * 分类 key 一旦发布不再变更，避免已存数据分类失效；改名只改 name/alias。
 * officialSite 为官方公告入口，仅作为「公告原文跳转」的默认来源，具体公告以用户填写链接为准。
 */
export const CATEGORIES = [
  {
    key: 'guokao',
    name: '国家公务员考试',
    short: '国考',
    group: '公务员',
    color: '#C0392B',
    accent: '#FBEDEB',
    icon: 'flag',
    officialSite: 'http://bm.scs.gov.cn',
    officialName: '国家公务员局 · 中央机关及其直属机构考试录用公务员专题',
    description: '每年 10 月发布公告与职位表，11 月下旬至 12 月初笔试。',
    typicalMonths: [10, 11, 12],
  },
  {
    key: 'shengkao',
    name: '省公务员考试',
    short: '省考',
    group: '公务员',
    color: '#1F5AE0',
    accent: '#EAF0FF',
    icon: 'map',
    officialSite: 'https://www.hbsrsksy.cn',
    officialName: '湖北省人事考试网（各省人事考试网）',
    description: '联考省份通常 1-3 月报名、3 月笔试；湖北近年多参加春季联考。',
    typicalMonths: [1, 2, 3],
  },
  {
    key: 'shiye',
    name: '事业单位招聘',
    short: '事业编',
    group: '事业单位',
    color: '#0E8074',
    accent: '#E6F5F2',
    icon: 'briefcase',
    officialSite: 'https://www.hbsrsksy.cn',
    officialName: '湖北省人事考试网 · 事业单位公开招聘',
    description: '省直与市县分批发布，常见 5 月（联考 D/E 类）与 10-11 月两批。',
    typicalMonths: [5, 10, 11],
  },
  {
    key: 'shequ',
    name: '社区工作者',
    short: '社区工作者',
    group: '基层岗位',
    color: '#7A4FD1',
    accent: '#F1ECFC',
    icon: 'users',
    officialSite: 'https://mzj.hubei.gov.cn',
    officialName: '湖北省民政厅 · 各市州社区工作者招聘公告',
    description: '按区县单独组织，公告密度高、周期短，需盯紧本地民政局与街道发布渠道。',
    typicalMonths: [3, 4, 8, 9],
  },
  {
    key: 'hubei-xuandiao',
    name: '湖北省选调生',
    short: '湖北选调',
    group: '基层岗位',
    color: '#B8791A',
    accent: '#FBF3E4',
    icon: 'award',
    officialSite: 'https://www.hbzzb.gov.cn',
    officialName: '中共湖北省委组织部 · 选调生招录公告',
    description: '面向应届毕业生，通常 12 月至次年 1 月发布公告，3 月前后笔试。',
    typicalMonths: [12, 1, 2],
  },
  {
    key: 'jundui',
    name: '军队文职人员',
    short: '军队文职',
    group: '部队序列',
    color: '#2C6E49',
    accent: '#EAF4EE',
    icon: 'shield',
    officialSite: 'http://81rc.81.cn',
    officialName: '军队人才网 · 全军面向社会公开招考文职人员',
    description: '近年多在年初发布公告，次年 1-2 月报名、3-4 月笔试。',
    typicalMonths: [1, 2, 3],
  },
  {
    key: 'sanzhiyifu',
    name: '三支一扶',
    short: '三支一扶',
    group: '基层岗位',
    color: '#0F7BB5',
    accent: '#E8F3FA',
    icon: 'sprout',
    officialSite: 'https://rst.hubei.gov.cn',
    officialName: '湖北省人力资源和社会保障厅 · 三支一扶计划',
    description: '面向高校毕业生到基层支教/支农/支医与帮扶乡村振兴，公告集中在 4-6 月；多设 2:1~3:1 开考比例，重庆医疗卫生岗未达比例也可开考。',
    typicalMonths: [4, 5, 6],
  },
  {
    key: 'rencai',
    name: '人才引进',
    short: '人才引进',
    group: '基层岗位',
    color: '#C2410C',
    accent: '#FFF0E6',
    icon: 'award',
    officialSite: 'https://zk.xnrczpw.com',
    officialName: '各地人才引进报名系统（以公告为准）',
    description: '事业单位高层次人才引进，QS 前 200/500 硕士通道不看本科层次；多数不设开考比例、报名:计划≤15:1 免笔试直接面试，全年滚动。',
    typicalMonths: [3, 4, 10, 11],
  },
  {
    key: 'xibu',
    name: '西部计划',
    short: '西部计划',
    icon: 'globe',
    group: '基层岗位',
    color: '#4D7C0F',
    accent: '#F7FEE7',
    officialSite: 'https://xibu.youth.cn',
    officialName: '大学生志愿服务西部计划官方网站',
    description: '志愿服务西部计划，应届毕业生或在读研究生可报，无开考比例概念；报名多在 3-5 月，服务期 1-3 年。',
    typicalMonths: [3, 4, 5],
  },
  {
    key: 'cunban',
    name: '大学生村官 / 村级后备干部',
    short: '村官',
    group: '基层岗位',
    color: '#4B7B3A',
    accent: '#EDF4E9',
    icon: 'sprout',
    officialSite: 'http://www.hnrsks.com',
    officialName: '河南省人事考试中心 · 乡村振兴村级协理员专项计划',
    description: '两类并存：河南万名带编协理员（公告逐字不限户籍），与县乡自招的村级后备干部（多数限本地户籍，逐公告核对）。',
    typicalMonths: [4, 5, 6, 7, 8],
  },
  {
    key: 'zhuanli',
    name: '专利审查员全国统考',
    short: '专利审查',
    group: '专业系统',
    color: '#0B6E99',
    accent: '#E2F0F8',
    icon: 'briefcase',
    officialSite: 'http://chd.ncss.cn',
    officialName: '国家大学生就业服务平台 · 专利审查协作中心招聘',
    description: '国家知识产权局专利审查协作中心全国统考，事业编制；电学 / 通信 / 光电领域点名计算机科学与技术与人工智能专业。',
    typicalMonths: [7, 8, 9],
  },
  {
    key: 'yancao',
    name: '中国烟草系统招聘',
    short: '烟草系统',
    group: '央企国企',
    color: '#8A6D3B',
    accent: '#F5EFE3',
    icon: 'briefcase',
    officialSite: 'http://www.tobacco.gov.cn/gjyc/zpxx/list.shtml',
    officialName: '国家烟草专卖局 · 人才招聘平台（各省公司统一发布入口）',
    description: '各省公司独立发布、独立笔试，公告把留学回国人员逐字写进招录对象；多集中在 11 月—次年 4 月。',
    typicalMonths: [11, 12, 1, 2, 3, 4],
  },
  {
    key: 'dianwang',
    name: '电网系统统一考试',
    short: '电网系统',
    group: '央企国企',
    color: '#C2410C',
    accent: '#FFF0E6',
    icon: 'briefcase',
    officialSite: 'https://zhaopin.sgcc.com.cn',
    officialName: '国家电网有限公司人力资源招聘平台（一批 / 二批统一考试报名入口）',
    description: '国家电网 / 南方电网一批（约 11 月报名、12 月笔试）与二批（约次年 3—4 月）统一考试；计算机类集中在信通与数字化岗。',
    typicalMonths: [11, 12, 3, 4],
  },
  {
    key: 'nongxin',
    name: '农商行 / 农信社统考',
    short: '农信系统',
    group: '央企国企',
    color: '#4B7B3A',
    accent: '#EDF4E9',
    icon: 'briefcase',
    officialSite: 'https://www.hbxh.com.cn',
    officialName: '各省农村信用社联合社 · 招聘公告',
    description: '各省联社独立批次（湖北 2026 年 3 月、7 月各一批）；不足 1:3 会核减甚至取消岗位，但多数批次要求 3—5 年工作经验。',
    typicalMonths: [3, 7],
  },
  {
    key: 'xiaofang',
    name: '国家综合性消防救援队伍招录',
    short: '消防救援',
    group: '特殊通道',
    color: '#C0392B',
    accent: '#FBEDEB',
    icon: 'shield',
    officialSite: 'https://www.mem.gov.cn',
    officialName: '应急管理部 · 国家综合性消防救援队伍消防员招录',
    description: '全国统一招录、可在户籍地或经常居住地省份报名（持居住证即可）；仅招男性，年龄上限硬（18—22 周岁，专科以上放宽至 24 周岁）。',
    typicalMonths: [6, 7],
  },
  {
    key: 'liufu',
    name: '留学生学历学位认证',
    short: '留服认证',
    group: '学历认证',
    color: '#4B5563',
    accent: '#EEF0F3',
    icon: 'globe',
    officialSite: 'https://zwfw.cscse.edu.cn',
    officialName: '教育部留学服务中心 · 国（境）外学历学位认证系统',
    description: '认证申请常年开放，但需预留 10-20 个工作日审核期；报考岗位前务必确认认证状态。',
    typicalMonths: [1, 3, 6, 9, 12],
  },
];

export const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.key, c]));

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

/**
 * 每类考试「考什么 · 备什么」：通用备考口径的人工整理。
 *
 * 数据诚实边界：这是**常识级整理**，不是官方公告 —— 科目名称、流程、准备清单
 * 按历年公告的普遍规律写，逐条在界面标注「以当年公告原文为准」；
 * 拿不准的一律不写数字（如科目占比、通过率），避免伪装成官方口径。
 */
export const EXAM_INFO = {
  guokao: {
    subjects: [
      { name: '行政职业能力测验', note: '常识 / 言语 / 数量 / 判断 / 资料五大模块，全客观题' },
      { name: '申论', note: '按副省级 / 市地级 / 行政执法三类卷分级命题，主观题' },
      { name: '专业科目（部分职位）', note: '8 个非通用语职位、证监会、公安机关人民警察等加试，看职位表备注' },
    ],
    interview: '结构化面试 / 无领导小组讨论为主，部分中央机关另有专业测试',
    prep: [
      '留服认证：留学人员报名前把认证办出来，资格复审要用',
      '应届身份：当年公告写明留学生应届认定口径，逐条核对',
      '选岗：对照专业目录与基层经历口径筛职位表，政法类留学生禁入',
      '备考：行测分模块限时刷题，申论练历年真题的概括与大作文',
    ],
  },
  shengkao: {
    subjects: [
      { name: '行政职业能力测验', note: '各省自主命题，部分省分乡镇卷 / 分类分级' },
      { name: '申论', note: '同卷分级；公安类职位加公安专业科目' },
    ],
    interview: '多为结构化面试，部分省法官助理 / 检察官助理有专业环节',
    prep: [
      '选定一个联考省份：只能报一个，报名前逐省读报考指南',
      '留学生学历认定口径各省不同，报名前确认本省怎么审',
      '留服认证 + 本省人事考试网公告为主，别依赖转载',
    ],
  },
  shiye: {
    subjects: [
      { name: '职业能力倾向测验', note: '联考统考科目，类似行测但更轻' },
      { name: '综合应用能力', note: '按岗位分 A(管理)/B(社科)/C(自然科技)/D(教师)/E(医疗) 五类' },
      { name: '公共基础知识（部分）', note: '单位自招常考公基，或直接只面试' },
    ],
    interview: '结构化为主，教师 / 医疗岗有试讲 / 实操',
    prep: [
      '先认清岗位类别（A-E）再复习，科目侧重完全不同',
      '留服认证 + 专业目录对照表：事业单位审专业比公务员更死板',
      '盯省人事考试网与目标单位官网，公告分散',
    ],
  },
  shequ: {
    subjects: [
      { name: '综合能力测试', note: '各区县自命题，常见公共基础知识 + 社区治理 / 社区工作实务 + 写作' },
    ],
    interview: '结构化或面谈，常问本地社区情境题',
    prep: [
      '盯本区民政局 / 街道公众号：按区县单独组织，公告周期短',
      '收集本区往年公告与进面分，命题风格延续性强',
      '社区工作知识（网格治理、议事协商）是拉开分差的重点',
    ],
  },
  'hubei-xuandiao': {
    subjects: [
      { name: '行政职业能力测验', note: '选调生卷，题量与难度略低于省考卷' },
      { name: '申论', note: '选调生卷，侧重基层治理与群众工作话题' },
    ],
    interview: '面谈 / 结构化面试；定向选调另有单独考核安排',
    prep: [
      '资格条件硬：应届 + 党员 / 学生干部 / 服役经历等，逐条核对公告',
      '应届身份与派遣资格要在报名时成立，留学人员以当年公告口径为准',
      '体检政审按公务员标准，提前自查',
    ],
  },
  jundui: {
    subjects: [
      { name: '公共科目', note: '基本知识 + 岗位能力两部分，全军统考' },
      { name: '专业科目', note: '按岗位分约 13 类，计算机岗多考数学 + 计算机专业基础' },
    ],
    interview: '面试 + 体检 + 政治考核，军队标准从严',
    prep: [
      '专业科目对照招考目录先确认考哪门，再动手复习',
      '留学人员有专门申报口径，以军队人才网公告与政治考核要求为准',
      '先面试后笔试的岗位节奏不同，报名时看清批次',
    ],
  },
  sanzhiyifu: {
    subjects: [
      { name: '职业能力测验', note: '各省自命题，难度低于省考行测' },
      { name: '综合知识', note: '含农业农村知识 / 时政 / 写作，部分省单科' },
    ],
    interview: '结构化面试为主',
    prep: [
      '分清支教 / 支农 / 支医 / 帮扶乡村振兴四类岗位，专业要求不同',
      '了解服务期满政策（考研加分、定向招录）再决定投入',
      '留意开考比例：多设 2:1~3:1，个别岗位未达比例也可开考',
    ],
  },
  rencai: {
    subjects: [
      { name: '多数免笔试', note: '报名:计划 ≤15:1 的批次直接进面试' },
      { name: '面试（面谈 / 结构化 / 专业化）', note: '部分批次考公共基础知识或写作，逐公告确认' },
    ],
    interview: '面谈为主，围绕学历背景、研究经历与本地匹配度',
    prep: [
      '留服认证时限卡准：报名 / 资格复审通常要求认证在手或可出',
      '学校层次认定（QS 前 200 / 双一流）决定走哪条通道，提前对表',
      '材料包：学位证 + 成绩单 + 护照签证记录 + 授权声明一次备齐',
    ],
  },
  xibu: {
    subjects: [
      { name: '笔试（部分省）', note: '公共基础知识 + 志愿服务相关知识，各省不一' },
    ],
    interview: '校 / 省两级审核 + 面试，体检按志愿项目标准',
    prep: [
      '应届毕业生或在读研究生身份，报名在官方系统进行',
      '想清楚服务期 1-3 年的规划（就学 / 就业衔接政策）',
      '报名窗口集中在春季，提前准备材料不临时抱佛脚',
    ],
  },
  cunban: {
    subjects: [
      { name: '公共基础知识', note: '河南万名协理员等带编岗为统考命题' },
      { name: '农业农村知识 + 写作', note: '村级后备干部岗常见，部分加本地情况测试' },
    ],
    interview: '结构化 / 面谈，重实务与本地适配',
    prep: [
      '户籍口径逐公告核对：河南带编协理员公告逐字不限户籍，县乡自招多数限本地',
      '熟悉本县农业农村政策与村情，面试高频',
      '确认用工与编制性质（带编 / 备用岗）再报名',
    ],
  },
  zhuanli: {
    subjects: [
      { name: '专业科目', note: '按技术领域分卷（电学 / 通信等），考专业基础' },
      { name: '职业能力测验', note: '类似行测的客观题卷' },
    ],
    interview: '结构化 + 专业面，部分中心有英文环节',
    prep: [
      '专业对口是门槛：电学 / 通信领域点名计算机科学与技术、人工智能等',
      '英语阅读能力要练：审查工作涉及外文文献',
      '事业编制岗位竞争集中在专业面，复习以本领域基础为主',
    ],
  },
  yancao: {
    subjects: [
      { name: '行政职业能力测验', note: '各省公司自命题，行业统考风格' },
      { name: '专业知识（按岗）', note: '计算机 / 财会 / 机械等按岗位出题，部分加写作' },
    ],
    interview: '半结构化为主，部分省有第二轮',
    prep: [
      '认清用工性质：央企 / 国企校招多为合同制或劳务派遣，不是行政 / 事业编制',
      '留学回国人员及留服认证时限公告逐字写明，按公告准备',
      '各省独立发布独立笔试，只盯目标省公告即可',
    ],
  },
  dianwang: {
    subjects: [
      { name: '综合能力（约两成）', note: '公共基础知识 + 电力能源战略 + 企业文化' },
      { name: '专业课题（约八成）', note: '计算机类考数据结构 / 操作系统 / 网络 / 数据库等' },
    ],
    interview: '统考后按分数与志愿组织面试，部分省公司无面试',
    prep: [
      '卡批次节奏：一批约 11 月报名 12 月笔试，二批约次年 3-4 月',
      '应届生身份与证书（四六级 / 计算机等级）是常见加分项',
      '南方电网另出一套卷，别混着复习',
    ],
  },
  nongxin: {
    subjects: [
      { name: '综合知识卷', note: '常见公共基础知识 + 经济金融 + 会计 + 计算机 + 行测' },
    ],
    interview: '结构化 / 半结构化，部分省无领导小组',
    prep: [
      '看清经验要求：多数批次要求 3-5 年工作经验，应届可报岗少',
      '1:3 比例不足会核减甚至取消岗位，捡漏与踩空并存',
      '各省联社独立批次，只考目标省的卷',
    ],
  },
  xiaofang: {
    subjects: [
      { name: '体格检查 + 体能测试', note: '1000 米跑 / 俯卧撑等项目逐项达标，标准公开' },
      { name: '岗位适应性测试 + 心理测试', note: '消防职业特点的专门测试' },
    ],
    interview: '面试 + 政治考核；不考行测申论，与公务员路线完全不同',
    prep: [
      '年龄硬杠：18-22 周岁，专科以上放宽至 24 周岁，超龄无法放宽',
      '提前 3 个月按公开标准练体能，临时突击过不了',
      '非户籍地报名持居住证即可，全国统考可在经常居住地省份报名',
    ],
  },
  liufu: {
    subjects: [
      { name: '不是考试', note: '在线认证流程：提交材料 → 评估 → 电子认证书' },
    ],
    interview: '无',
    prep: [
      '材料一次备齐：学位证 + 成绩单 + 护照签证记录 + 授权声明',
      '出入境记录要完整，中断 / 材料不全会补正拖时间',
      '预留 10-20 个工作日审核期，报考前把认证办出来，别卡在报名当天',
    ],
  },
};

export function getExamInfo(key) {
  return EXAM_INFO[key] || null;
}

export function getCategory(key) {
  return CATEGORY_MAP.get(key) || null;
}

export function publicCategories() {
  return CATEGORIES.map((c) => ({
    key: c.key,
    name: c.name,
    short: c.short,
    group: c.group,
    color: c.color,
    accent: c.accent,
    icon: c.icon,
    description: c.description,
    officialSite: c.officialSite,
    officialName: c.officialName,
    typicalMonths: c.typicalMonths,
    // 考什么 · 备什么：通用备考口径（常识级整理，界面标注以公告原文为准）
    examInfo: EXAM_INFO[c.key] || null,
  }));
}

/** 倒计时与紧急度：全站共用的唯一算法，前后端结果一致 */
export function deadlineMeta(deadline, deadlineTime) {
  const timePart = deadlineTime && /^\d{2}:\d{2}$/.test(deadlineTime) ? `${deadlineTime}:00` : '23:59:59';
  const target = new Date(`${deadline}T${timePart}`);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const days = Math.ceil(diffMs / 86_400_000);
  const hours = Math.floor(diffMs / 3_600_000);

  let level = 'normal';
  if (diffMs < 0) level = 'expired';
  else if (days <= 3) level = 'urgent';
  else if (days <= 14) level = 'soon';

  return {
    days,
    hours,
    expired: diffMs < 0,
    level,
    label: diffMs < 0 ? `已截止 ${Math.abs(days)} 天` : days === 0 ? '今天截止' : `还有 ${days} 天`,
  };
}
