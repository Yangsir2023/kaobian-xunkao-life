/**
 * 公共招考节点数据集（唯一来源）。
 *
 * 被两处复用：
 *   - server/seed.mjs     命令行导入到数据库
 *   - tests/helpers.mjs   测试环境初始化，保证验收脚本面向真实数据
 *
 * 诚实边界：日期来自各招考年度的一般规律，属「参考节点」，verifed=false + disclaimer
 * 会一并入库并在界面提示；announcementUrl 只指向主管部门官方入口页，不伪造深层链接。
 */
export const DISCLAIMER = '节点日期为参考值（非官方承诺），请以主管部门当年正式公告为准。';

export const OFFICIAL_NODES = [
  {
    title: '2027 年度国家公务员考试 · 公告与职位表发布',
    category: 'guokao',
    deadline: '2026-10-15',
    announcementUrl: 'http://bm.scs.gov.cn',
    notes: '公告与职位表同日发布，先看职位表再决定是否报名。重点核对：专业目录、基层工作经历年限、应届生身份界定。',
  },
  {
    title: '2027 年度国考 · 网上报名截止',
    category: 'guokao',
    deadline: '2026-10-24',
    deadlineTime: '18:00',
    announcementUrl: 'http://bm.scs.gov.cn',
    notes: '报名系统通常在 18:00 关闭，务必提前 1-2 天提交，留出资格审查被退回后改报的时间。',
  },
  {
    title: '2027 年度国考 · 笔试',
    category: 'guokao',
    deadline: '2026-11-29',
    deadlineTime: '09:00',
    announcementUrl: 'http://bm.scs.gov.cn',
    notes: '上午行测、下午申论。准考证一般在笔试前一周开放打印，注意考点城市与交通。',
  },
  {
    title: '2027 年度国考 · 成绩查询与面试名单',
    category: 'guokao',
    deadline: '2027-01-10',
    announcementUrl: 'http://bm.scs.gov.cn',
    notes: '成绩公布后一周内陆续发布面试名单与调剂公告。',
  },
  {
    title: '2026 年度国考补录 · 报名截止（已结束，可作历史参考）',
    category: 'guokao',
    deadline: '2026-09-30',
    announcementUrl: 'http://bm.scs.gov.cn',
    notes: '补录窗口通常只有 3-5 天，建议把「补录公告发布」也设成提醒。',
  },
  {
    title: '湖北省 2027 年度省市县乡考试录用公务员 · 公告',
    category: 'shengkao',
    deadline: '2027-01-05',
    announcementUrl: 'https://www.hbsrsksy.cn',
    notes: '联考省份公告集中在 1 月发布，湖北近年参加春季联考，需关注是否有乡镇机关单独批次。',
  },
  {
    title: '湖北省考 · 报名截止',
    category: 'shengkao',
    deadline: '2027-01-15',
    deadlineTime: '17:00',
    announcementUrl: 'https://www.hbsrsksy.cn',
    notes: '省考报名常分「应届生岗位」与「社会岗位」，注意自身条件匹配。',
  },
  {
    title: '湖北省考 · 公共科目笔试',
    category: 'shengkao',
    deadline: '2027-03-14',
    deadlineTime: '09:00',
    announcementUrl: 'https://www.hbsrsksy.cn',
    notes: '联考同日举行，一旦选择省份便无法改报其他联考省份。',
  },
  {
    title: '湖北省 2027 年事业单位统一公开招聘（联考）· 公告与报名',
    category: 'shiye',
    deadline: '2027-04-20',
    announcementUrl: 'https://www.hbsrsksy.cn',
    notes: '事业单位考试分 A-E 五类，岗位表会标注类别，复习资料按类别区分。',
  },
  {
    title: '湖北省事业单位联考 · 笔试',
    category: 'shiye',
    deadline: '2027-05-22',
    deadlineTime: '08:30',
    announcementUrl: 'https://www.hbsrsksy.cn',
    notes: '《职业能力倾向测验》+《综合应用能力》连考，中间不休息。',
  },
  {
    title: '武汉市社区工作者招聘（春季批次）· 公告与报名',
    category: 'shequ',
    deadline: '2027-03-05',
    announcementUrl: 'https://mzj.hubei.gov.cn',
    notes: '社区工作者按区单独组织，公告分散在区政府网站与街道公众号，建议同时盯本地民政局官网。',
  },
  {
    title: '武汉市社区工作者招聘 · 报名截止',
    category: 'shequ',
    deadline: '2027-03-20',
    announcementUrl: 'https://mzj.hubei.gov.cn',
    notes: '多数岗位限本区户籍或常住人口，报名前先确认资格条件。',
  },
  {
    title: '湖北省 2027 年选调生招录 · 公告发布',
    category: 'hubei-xuandiao',
    deadline: '2026-12-15',
    announcementUrl: 'https://www.hbzzb.gov.cn',
    notes: '选调生仅面向应届毕业生，且对院校层次与政治面貌有明确要求，公告中的《报考指南》要逐条比对。',
  },
  {
    title: '湖北省选调生 · 报名截止',
    category: 'hubei-xuandiao',
    deadline: '2026-12-28',
    deadlineTime: '17:00',
    announcementUrl: 'https://www.hbzzb.gov.cn',
    notes: '需学校就业部门审核盖章，建议提前一周准备推荐材料。',
  },
  {
    title: '2027 年军队文职人员公开招考 · 公告与报名',
    category: 'jundui',
    deadline: '2027-01-08',
    announcementUrl: 'http://81rc.81.cn',
    notes: '军队文职岗位分管理岗与专业技术岗，专业科目差异大，先定岗再备考。',
  },
  {
    title: '军队文职 · 报名截止',
    category: 'jundui',
    deadline: '2027-01-20',
    deadlineTime: '18:00',
    announcementUrl: 'http://81rc.81.cn',
    notes: '报名需上传学历学位证明与政治考核材料，材料不全会影响审核。',
  },
  {
    title: '军队文职 · 统一笔试',
    category: 'jundui',
    deadline: '2027-03-28',
    deadlineTime: '09:00',
    announcementUrl: 'http://81rc.81.cn',
    notes: '笔试含公共科目与专业科目，注意体检标准（视力/体能）是否满足。',
  },
  {
    title: '湖北省 2027 年三支一扶计划 · 招募公告',
    category: 'sanzhiyifu',
    deadline: '2027-05-08',
    announcementUrl: 'https://rst.hubei.gov.cn',
    notes: '服务期 2 年，服务期满且考核合格可享受定向招录、考研加分等政策，报考前先看清服务地。',
  },
  {
    title: '湖北省三支一扶 · 报名截止',
    category: 'sanzhiyifu',
    deadline: '2027-05-25',
    announcementUrl: 'https://rst.hubei.gov.cn',
    notes: '部分岗位限定本地生源，报名时注意岗位条件表。',
  },
  {
    title: '甘肃定西市 2026 年度第二批人才引进 · 报名截止（正在进行）',
    category: 'rencai',
    deadline: '2026-10-27',
    deadlineTime: '18:00',
    announcementUrl: 'https://zk.xnrczpw.com/nindex/?ecode=dxrcyj',
    announcementSource: 'official',
    verified: true,
    notes:
      '市直岗位要求 2026 QS 前 200 院校硕士及以上、县区岗位 QS 前 500——不看本科层次，普通本科 + QS 前 200 硕士正好符合。306 岗 360 人；报名:计划 ≤15:1 免笔试直接面试，面试 80 分合格。报名 10-13 08:30 起；初审未通过可改报至 10-29 12:00。博士单列考核、一事一议。',
  },
  {
    title: '甘肃定西市 2026 年度第二批人才引进 · 改报与资格初审截止',
    category: 'rencai',
    deadline: '2026-10-29',
    deadlineTime: '12:00',
    announcementUrl: 'https://zk.xnrczpw.com/nindex/?ecode=dxrcyj',
    announcementSource: 'official',
    verified: true,
    notes: '资格初审 10-14 08:30 至 10-28 18:00；未通过初审的可在 10-29 12:00 前补充材料或改报，之后系统关闭。留学回国人员按公告提供留服学历认证材料。',
  },
  {
    title: '人才引进全年滚动 · 建议每季度核查目标城市公告',
    category: 'rencai',
    deadline: '2026-12-31',
    announcementUrl: 'https://zk.xnrczpw.com',
    announcementSource: 'official',
    verified: false,
    notes:
      '已核对的 QS 前 200 硕士通道：甘肃定西（市直 QS200 / 县区 QS500）、湖北十堰丹江口、浙江温州（四大榜单前 200）、湖北咸宁崇阳、荆州监利。这类招聘全年滚动、公告分散在市级官网，建议固定每季度查一轮；岗位表的专业要求逐条核对。',
  },
  {
    title: '云南省 2027 年度考试录用公务员 · 公告与报名（参考节点）',
    category: 'shengkao',
    deadline: '2027-02-01',
    announcementUrl: 'https://ylxf.1237125.cn/TopicWeb/ynskslygwy/index.html',
    announcementSource: 'official',
    verified: false,
    notes:
      '云南省考公告近年集中在 1-2 月发布、3 月笔试（2026 年度笔试为 3 月 14 日）。云南县级职位合格线 95 分（总分口径），乡镇艰苦边远地区 85 分，是低分上岸的重点省份；职位表发布后先核对专业目录再报名。',
  },
  {
    title: '重庆市 2027 年高校毕业生三支一扶 · 公告与报名（参考节点）',
    category: 'sanzhiyifu',
    deadline: '2027-04-15',
    announcementUrl: 'https://rlsbj.cq.gov.cn',
    announcementSource: 'official',
    verified: false,
    notes:
      '重庆是三支一扶里对低分最友好的省份之一：2026 年简章明确「医疗卫生岗位未达开考比例可开考且不递减指标」，其他岗位 2:1 未达核减取消、已缴费者退费或调整岗位。服务期 2 年，期满考核合格享定向招录与考研加分。',
  },
  {
    title: '2027 年大学生志愿服务西部计划 · 报名（参考节点）',
    category: 'xibu',
    deadline: '2027-05-10',
    announcementUrl: 'https://xibu.youth.cn',
    announcementSource: 'official',
    verified: false,
    notes:
      '2026 年度报名时间为 3 月 1 日至 5 月 10 日，全国拟招募约 6 万人，90% 以上岗位在乡镇及以下；应届毕业生或在读研究生可报，服务期 1-3 年。没有开考比例概念，选拔由各省项目办组织；有志愿服务经历者优先录用。',
  },
  {
    title: '国（境）外学历学位认证 · 建议在报考资格审查前完成',
    category: 'liufu',
    deadline: '2026-12-01',
    announcementUrl: 'https://zwfw.cscse.edu.cn',
    notes: '认证常年受理，但审核需 10-20 个工作日。报考要求「学历学位认证」的岗位时，最好在报名前拿到认证书，避免资格复审卡壳。',
  },
  {
    title: '国（境）外学历学位认证 · 年度材料更新提醒',
    category: 'liufu',
    deadline: '2027-06-30',
    announcementUrl: 'https://zwfw.cscse.edu.cn',
    notes: '毕业证签发后如信息变更（姓名/专业译名），需及时申请补充或复核。',
  },
];

/**
 * 幂等导入公共节点。
 * @returns {Promise<{inserted:number, skipped:number, total:number}>}
 */
export async function importOfficialNodes({ db, newId, nowIso, reset = false }) {
  if (reset) await db.reminders().deleteMany({ source: 'official' });

  let inserted = 0;
  let skipped = 0;
  for (const node of OFFICIAL_NODES) {
    const existing = await db.reminders().findOne({ title: node.title, source: 'official' });
    if (existing) {
      skipped += 1;
      continue;
    }
    await db.reminders().insertOne({
      id: newId('off'),
      ownerId: null,
      source: 'official',
      title: node.title,
      category: node.category,
      deadline: node.deadline,
      deadlineTime: node.deadlineTime || null,
      announcementUrl: node.announcementUrl,
      announcementSource: node.announcementSource || 'official',
      notes: node.notes,
      attachments: [],
      remindOffsets: [30, 14, 7, 3, 1],
      status: 'active',
      // 逐条声明是否已核对到官方公告原文：未核实的（一般规律推算的参考节点）保持 false 并带 disclaimer
      verified: node.verified === true,
      disclaimer: node.verified === true ? null : DISCLAIMER,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    inserted += 1;
  }
  return { inserted, skipped, total: await db.reminders().count({ source: 'official' }) };
}
