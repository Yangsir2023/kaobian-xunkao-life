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
    description: '面向高校毕业生到基层支教/支农/支医与帮扶乡村振兴，公告集中在 4-6 月。',
    typicalMonths: [4, 5, 6],
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
