export type AlumniRegionId =
  | 'united-states'
  | 'canada'
  | 'united-kingdom'
  | 'hong-kong'
  | 'singapore'
  | 'australia'
  | 'europe'
  | 'mainland-china';

export type AlumniContact = {
  name: string;
  location: string;
  school: string;
  program: string;
  year: string;
  note: string;
  wechat?: string;
  email?: string;
};

export type AlumniRegion = {
  id: AlumniRegionId;
  label: string;
  shortLabel: string;
  summary: string;
  description: string;
  color: string;
  fill: string;
  activeFill: string;
  shapePath?: string;
  labelPoint?: {
    x: number;
    y: number;
  };
  pin?: {
    x: number;
    y: number;
    labelX: number;
    labelY: number;
  };
  contacts: AlumniContact[];
};

export const ALUMNI_REGIONS: AlumniRegion[] = [
  {
    id: 'united-states',
    label: '美国',
    shortLabel: 'USA',
    summary: '北美大学与研究型项目最密集的区域。',
    description: '适合沉淀本科申请、研究型项目、CS/AI、工程、商科和交叉方向的校友网络。',
    color: '#6c5ce7',
    fill: 'rgba(108, 92, 231, 0.22)',
    activeFill: 'rgba(108, 92, 231, 0.46)',
    shapePath:
      'M324 214 C382 186 485 179 552 202 C622 226 644 280 605 318 C554 366 451 364 374 336 C305 310 275 248 324 214 Z',
    labelPoint: { x: 460, y: 285 },
    pin: { x: 460, y: 285, labelX: 410, labelY: 240 },
    contacts: [
      {
        name: 'Harry',
        location: '北卡罗来纳州 达勒姆',
        school: '杜克大学 (Duke)',
        program: '机械工程专业',
        year: '2026 届',
        note: 'US News 美国大学综合排名第 6 位',
      },
      {
        name: 'Kevin',
        location: '加利福尼亚州 戴维斯',
        school: '加州大学戴维斯分校 (UC Davis)',
        program: '生物学专业',
        year: '2026 届',
        note: 'US News 美国大学综合排名第 33 位',
      },
      {
        name: 'Thomas',
        location: '伊利诺伊州 厄巴纳 - 香槟',
        school: '伊利诺伊大学厄巴纳 - 香槟分校 (UIUC)',
        program: '机械工程专业',
        year: '2026 届',
        note: 'US News 美国大学综合排名第 33 位',
      },
      {
        name: 'Victor',
        location: '加利福尼亚州 洛杉矶',
        school: '南加利福尼亚大学 (USC)',
        program: '物理学专业',
        year: '2026 届',
        note: 'US News 美国大学综合排名第 27 位',
      },
      {
        name: 'Alice',
        location: '华盛顿州 西雅图',
        school: '华盛顿大学（西雅图） (UW Seattle)',
        program: '传媒学专业',
        year: '2026 届',
        note: 'US News 美国大学综合排名第 7 位',
      },
      {
        name: 'Jimmy',
        location: '北卡罗来纳州 教堂山',
        school: '北卡罗来纳大学教堂山分校 (UNC-Chapel Hill)',
        program: '运动科学专业',
        year: '2026 届',
        note: 'US News 美国大学综合排名第 22 位',
      },
      {
        name: 'Jeremy',
        location: '加利福尼亚州 拉霍亚（圣地亚哥）',
        school: '加州大学圣地亚哥分校 (UCSD)',
        program: '机械工程专业',
        year: '2026 届',
        note: 'US News 美国大学综合排名第 28 位',
      },
    ],
  },
  {
    id: 'canada',
    label: '加拿大',
    shortLabel: 'CAN',
    summary: '北美英联邦体系与多元城市群。',
    description: '适合收集本科转学、研究生申请、Co-op、移民路径和跨城市学习生活经验。',
    color: '#37c6d0',
    fill: 'rgba(55, 198, 208, 0.2)',
    activeFill: 'rgba(55, 198, 208, 0.42)',
    shapePath:
      'M322 92 C410 39 594 20 706 38 C756 47 765 100 717 145 C651 206 490 227 376 191 C303 169 279 120 322 92 Z',
    labelPoint: { x: 535, y: 126 },
    pin: { x: 535, y: 126, labelX: 585, labelY: 80 },
    contacts: [
      {
        name: 'Flier',
        location: '不列颠哥伦比亚省 温哥华',
        school: '不列颠哥伦比亚大学 (UBC)',
        program: '商业管理专业',
        year: '2026 届',
        note: 'QS 世界大学排名第 38 位',
      },
    ],
  },
  {
    id: 'united-kingdom',
    label: '英国',
    shortLabel: 'UK',
    summary: '英本、硕士和艺术人文方向的高频目的地。',
    description: '适合连接英本申请、G5/罗素集团、艺术设计、社科、商科和一年制硕士经验。',
    color: '#fd79a8',
    fill: 'rgba(253, 121, 168, 0.22)',
    activeFill: 'rgba(253, 121, 168, 0.48)',
    shapePath:
      'M947 122 C974 110 1000 126 1002 155 C1004 184 975 198 948 185 C922 172 921 135 947 122 Z',
    labelPoint: { x: 965, y: 163 },
    pin: { x: 965, y: 163, labelX: 915, labelY: 120 },
    contacts: [
      {
        name: 'Moana',
        location: '威尔士 卡迪夫',
        school: '卡迪夫大学 (Cardiff)',
        program: '考古学专业',
        year: '2026 届',
        note: '-',
      },
      {
        name: 'Emily',
        location: '英格兰 伦敦',
        school: '伦敦大学学院 (UCL)',
        program: '统计学专业',
        year: '2026 届',
        note: 'QS 世界大学排名第 9 位',
      },
      {
        name: 'Patrick',
        location: '英格兰 牛津',
        school: '牛津大学 (Oxford)',
        program: '生物学专业',
        year: '2026 届',
        note: 'QS 世界大学排名第 4 位',
      },
    ],
  },
  {
    id: 'hong-kong',
    label: '香港',
    shortLabel: 'HK',
    summary: '离内地最近的国际化大学网络。',
    description: '适合沉淀港校本科、授课型硕士、金融、数据、传媒、医学和跨境实习经验。',
    color: '#ffb545',
    fill: 'rgba(255, 181, 69, 0.28)',
    activeFill: 'rgba(255, 181, 69, 0.5)',
    pin: { x: 1598, y: 371, labelX: 1648, labelY: 330 },
    contacts: [
      {
        name: 'Jiahan',
        location: '香港岛 薄扶林',
        school: '香港大学 (HKU)',
        program: '机械工程专业',
        year: '2026 届',
        note: 'QS 世界大学排名第 11 位',
      },
      {
        name: 'Angel',
        location: '香港岛 薄扶林',
        school: '香港大学 (HKU)',
        program: '经济学专业',
        year: '2026 届',
        note: 'QS 世界大学排名第 11 位',
      },
    ],
  },
  {
    id: 'singapore',
    label: '新加坡',
    shortLabel: 'SG',
    summary: '亚洲科技、金融与双语环境交汇点。',
    description: '适合收集 NUS/NTU/SMU、计算机、金融、商业分析、国际关系和实习就业经验。',
    color: '#16a085',
    fill: 'rgba(22, 160, 133, 0.26)',
    activeFill: 'rgba(22, 160, 133, 0.52)',
    pin: { x: 1560, y: 456, labelX: 1618, labelY: 503 },
    contacts: [],
  },
  {
    id: 'australia',
    label: '澳洲',
    shortLabel: 'AUS',
    summary: '南半球英联邦体系与生活方式导向区域。',
    description: '适合沉淀澳八大、商科、传媒、工程、医学相关路径，以及城市生活与签证经验。',
    color: '#ff7675',
    fill: 'rgba(255, 118, 117, 0.22)',
    activeFill: 'rgba(255, 118, 117, 0.46)',
    shapePath:
      'M1608 659 C1646 611 1736 573 1799 607 C1864 642 1842 713 1785 752 C1719 795 1615 770 1587 716 C1578 696 1586 677 1608 659 Z',
    labelPoint: { x: 1714, y: 694 },
    pin: { x: 1714, y: 694, labelX: 1764, labelY: 740 },
    contacts: [
      {
        name: 'Ryan',
        location: '新南威尔士州 悉尼',
        school: '悉尼大学 (USYD)',
        program: '数学专业',
        year: '2026 届',
        note: 'QS 世界大学排名第 25 位',
      },
    ],
  },
  {
    id: 'europe',
    label: '欧洲',
    shortLabel: 'EU',
    summary: '大陆欧洲多语种、多学制与交换项目区域。',
    description: '适合收集法国、德国、荷兰、瑞士、意大利、西班牙等地区的本科、硕士、交换和科研经验。',
    color: '#4d96ff',
    fill: 'rgba(77, 150, 255, 0.2)',
    activeFill: 'rgba(77, 150, 255, 0.42)',
    shapePath:
      'M1003 158 C1059 139 1128 165 1136 214 C1144 264 1074 293 1011 274 C956 249 936 181 1003 158 Z',
    labelPoint: { x: 1054, y: 218 },
    pin: { x: 1054, y: 218, labelX: 1104, labelY: 170 },
    contacts: [],
  },
  {
    id: 'mainland-china',
    label: '中国内地',
    shortLabel: 'CN',
    summary: '国内顶尖高校与学术中心。',
    description: '适合连接国内一流学府的校友网络，涵盖计算机、工程、艺术及人文社科领域。',
    color: '#e74c3c',
    fill: 'rgba(231, 76, 60, 0.2)',
    activeFill: 'rgba(231, 76, 60, 0.42)',
    pin: { x: 1480, y: 310, labelX: 1530, labelY: 260 },
    contacts: [],
  },
];

export const DEFAULT_ALUMNI_REGION_ID: AlumniRegionId = 'united-states';
