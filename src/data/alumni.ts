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
        name: 'Emily',
        location: 'Philadelphia, PA',
        school: '宾夕法尼亚大学 (UPenn)',
        program: '统计学专业',
        year: '2023 届',
        note: '藤校精英 / 顶尖统计学研究环境',
      },
      {
        name: 'Flier',
        location: 'Los Angeles, CA',
        school: '南加利福尼亚大学 (USC)',
        program: '传媒管理专业',
        year: '2023 届',
        note: '顶级传媒学院 / 专注于数字化战略与管理',
      },
      {
        name: 'Kevin',
        location: 'Davis, CA',
        school: '加州大学戴维斯分校 (UC Davis)',
        program: '数据科学专业',
        year: '2024 届',
        note: '公立名校 / 数据分析与科学计算背景',
      },
      {
        name: 'Victor',
        location: 'New York, NY',
        school: '纽约大学 (NYU)',
        program: '经济学专业',
        year: '2023 届',
        note: '曼哈顿核心区域 / 顶级商科与经济学氛围',
      },
      {
        name: 'Thomas',
        location: 'New York, NY',
        school: '纽约大学 (NYU)',
        program: '经济学专业',
        year: '2023 届',
        note: '一流研究型大学 / 卓越的经济学背景',
      },
      {
        name: 'Jeremy',
        location: 'Santa Barbara, CA',
        school: '加利福尼亚大学圣巴巴拉分校 (UCSB)',
        program: '机械工程专业',
        year: '2024 届',
        note: '顶尖工程学院 / 专注于动力学与机械设计',
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
    contacts: [],
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
    contacts: [],
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
        name: 'Moaha',
        location: 'Hong Kong',
        school: '香港大学 (HKU)',
        program: '哲学专业',
        year: '2023 届',
        note: '亚洲顶尖学府 / 卓越的人文学科背景',
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
        location: 'Melbourne, VIC',
        school: '墨尔本大学 (Unimelb)',
        program: '金融专业',
        year: '2023 届',
        note: '澳洲顶尖商学院 / 专注于金融工程与分析研究',
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
    contacts: [
      {
        name: 'Patrick',
        location: 'Beijing',
        school: '清华大学 (Tsinghua)',
        program: '计算机专业',
        year: '2023 届',
        note: '国内顶尖学府 / 专注于人工智能与算法研究',
      },
      {
        name: 'Jiahan',
        location: 'Shanghai',
        school: '同济大学 (Tongji)',
        program: '机械工程专业',
        year: '2023 届',
        note: '顶尖理工院校 / 扎实的工程力学基础',
      },
      {
        name: 'Harry',
        location: 'Beijing',
        school: '中央美术学院 (CAFA)',
        program: '工业设计专业',
        year: '2024 届',
        note: '顶级艺术院校 / 专注于工业产品设计与美学',
      },
      {
        name: 'Angel',
        location: 'Beijing',
        school: '北京电影学院 (BFA)',
        program: '电影学专业',
        year: '2024 届',
        note: '电影艺术最高学府 / 电影理论与实践',
      },
      {
        name: 'Alice',
        location: 'Shenzhen',
        school: '香港中文大学（深圳） (CUHKSZ)',
        program: '会计学专业',
        year: '2024 届',
        note: '国际化教育环境 / 专业会计与商业分析',
      },
      {
        name: 'Jimmy',
        location: 'Beijing',
        school: '北京理工大学 (BIT)',
        program: '计算机科学与技术专业',
        year: '2023 届',
        note: '国防七子名校 / 计算机软件与理论研究',
      },
    ],
  },
];

export const DEFAULT_ALUMNI_REGION_ID: AlumniRegionId = 'united-states';
