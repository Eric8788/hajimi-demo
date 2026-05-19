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
  alumniId: string;
  name: string;
  university: string;
  universityAbbr: string;
  major: string;
  country: string;
  state: string | null;
  city: string;
  campus: string;
  lat: number;
  lng: number;
  rankType: string | null;
  rankValue: number | null;
  graduationYear: number;
  avatarId: string;
  logoUrl: string;
  mapPoint: {
    x: number;
    y: number;
    labelDx?: number;
    labelDy?: number;
  };
};

export type AlumniRegion = {
  id: AlumniRegionId;
  label: string;
  shortLabel: string;
  groupLabel: string;
  summary: string;
  description: string;
  color: string;
  fill: string;
  activeFill: string;
  fallbackViewBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
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
    groupLabel: '北美',
    summary: '北美大学与研究型项目最密集的区域。',
    description: '适合沉淀本科申请、研究型项目、CS/AI、工程、商科和交叉方向的校友网络。',
    color: '#6c5ce7',
    fill: 'rgba(108, 92, 231, 0.22)',
    activeFill: 'rgba(108, 92, 231, 0.46)',
    fallbackViewBox: { x: 125, y: 315, width: 205, height: 112 },
    shapePath:
      'M324 214 C382 186 485 179 552 202 C622 226 644 280 605 318 C554 366 451 364 374 336 C305 310 275 248 324 214 Z',
    labelPoint: { x: 232, y: 350 },
    pin: { x: 232, y: 350, labelX: 192, labelY: 312 },
    contacts: [
      {
        alumniId: "A006",
        name: "Harry",
        university: "杜克大学",
        universityAbbr: "Duke",
        major: "机械工程",
        country: "美国",
        state: "北卡罗来纳州",
        city: "达勒姆",
        campus: "西校区（主校区）",
        lat: 35.9940,
        lng: -78.8986,
        rankType: "US News美国大学综合排名",
        rankValue: 6,
        graduationYear: 2026,
        avatarId: "avatar_harry",
        logoUrl: "/alumni-logos/duke.svg",
        mapPoint: { x: 269.6, y: 359.3, labelDx: 8, labelDy: -10 }
      },
      {
        alumniId: "A007",
        name: "Kevin",
        university: "加州大学戴维斯分校",
        universityAbbr: "UC Davis",
        major: "生物学",
        country: "美国",
        state: "加利福尼亚州",
        city: "戴维斯",
        campus: "主校区",
        lat: 38.5382,
        lng: -121.7617,
        rankType: "US News美国大学综合排名",
        rankValue: 33,
        graduationYear: 2026,
        avatarId: "avatar_kevin",
        logoUrl: "/alumni-logos/uc-davis.svg",
        mapPoint: { x: 157.8, y: 344.8, labelDx: -30, labelDy: -10 }
      },
      {
        alumniId: "A008",
        name: "Thomas",
        university: "伊利诺伊大学厄巴纳-香槟分校",
        universityAbbr: "UIUC",
        major: "机械工程",
        country: "美国",
        state: "伊利诺伊州",
        city: "厄巴纳-香槟",
        campus: "主校区",
        lat: 40.1106,
        lng: -88.2272,
        rankType: "US News美国大学综合排名",
        rankValue: 33,
        graduationYear: 2026,
        avatarId: "avatar_thomas",
        logoUrl: "/alumni-logos/uiuc.svg",
        mapPoint: { x: 244.7, y: 345.4, labelDx: 9, labelDy: -10 }
      },
      {
        alumniId: "A010",
        name: "Victor",
        university: "南加利福尼亚大学",
        universityAbbr: "USC",
        major: "物理学",
        country: "美国",
        state: "加利福尼亚州",
        city: "洛杉矶",
        campus: "大学公园主校区",
        lat: 34.0224,
        lng: -118.2851,
        rankType: "US News美国大学综合排名",
        rankValue: 27,
        graduationYear: 2026,
        avatarId: "avatar_victor",
        logoUrl: "/alumni-logos/usc.svg",
        mapPoint: { x: 167.2, y: 358.8, labelDx: -18, labelDy: 16 }
      },
      {
        alumniId: "A012",
        name: "Alice",
        university: "华盛顿大学（西雅图）",
        universityAbbr: "UW Seattle",
        major: "传媒学",
        country: "美国",
        state: "华盛顿州",
        city: "西雅图",
        campus: "西雅图主校区",
        lat: 47.6553,
        lng: -122.3035,
        rankType: "US News美国大学综合排名",
        rankValue: 7,
        graduationYear: 2026,
        avatarId: "avatar_alice",
        logoUrl: "/alumni-logos/uw-seattle.svg",
        mapPoint: { x: 153.9, y: 317.4, labelDx: -12, labelDy: -12 }
      },
      {
        alumniId: "A013",
        name: "Jimmy",
        university: "北卡罗来纳大学教堂山分校",
        universityAbbr: "UNC-Chapel Hill",
        major: "运动科学",
        country: "美国",
        state: "北卡罗来纳州",
        city: "教堂山",
        campus: "主校区",
        lat: 35.9049,
        lng: -79.0469,
        rankType: "US News美国大学综合排名",
        rankValue: 22,
        graduationYear: 2026,
        avatarId: "avatar_jimmy",
        logoUrl: "/alumni-logos/unc-chapel-hill.svg",
        mapPoint: { x: 269.2, y: 359.6, labelDx: -38, labelDy: 16 }
      },
      {
        alumniId: "A014",
        name: "Jeremy",
        university: "加州大学圣地亚哥分校",
        universityAbbr: "UCSD",
        major: "机械工程",
        country: "美国",
        state: "加利福尼亚州",
        city: "圣地亚哥",
        campus: "拉霍亚主校区",
        lat: 32.8801,
        lng: -117.2340,
        rankType: "US News美国大学综合排名",
        rankValue: 28,
        graduationYear: 2026,
        avatarId: "avatar_jeremy",
        logoUrl: "/alumni-logos/ucsd.svg",
        mapPoint: { x: 169.6, y: 362.8, labelDx: 9, labelDy: 18 }
      }
    ],
  },
  {
    id: 'canada',
    label: '加拿大',
    shortLabel: 'CAN',
    groupLabel: '北美',
    summary: '北美英联邦体系与多元城市群。',
    description: '适合收集本科转学、研究生申请、Co-op、移民路径和跨城市学习生活经验。',
    color: '#37c6d0',
    fill: 'rgba(55, 198, 208, 0.2)',
    activeFill: 'rgba(55, 198, 208, 0.42)',
    fallbackViewBox: { x: 105, y: 222, width: 190, height: 135 },
    shapePath:
      'M322 92 C410 39 594 20 706 38 C756 47 765 100 717 145 C651 206 490 227 376 191 C303 169 279 120 322 92 Z',
    labelPoint: { x: 205, y: 240 },
    pin: { x: 205, y: 240, labelX: 246, labelY: 202 },
    contacts: [
      {
        alumniId: "A005",
        name: "Flier",
        university: "不列颠哥伦比亚大学",
        universityAbbr: "UBC",
        major: "商业管理",
        country: "加拿大",
        state: "不列颠哥伦比亚省",
        city: "温哥华",
        campus: "温哥华主校区",
        lat: 49.2606,
        lng: -123.2460,
        rankType: "QS世界大学排名",
        rankValue: 38,
        graduationYear: 2026,
        avatarId: "avatar_flier",
        logoUrl: "/alumni-logos/ubc.svg",
        mapPoint: { x: 151.3, y: 310.9, labelDx: 10, labelDy: -10 }
      }
    ],
  },
  {
    id: 'united-kingdom',
    label: '英国',
    shortLabel: 'UK',
    groupLabel: '英国',
    summary: '英本、硕士和艺术人文方向的高频目的地。',
    description: '适合连接英本申请、G5/罗素集团、艺术设计、社科、商科和一年制硕士经验。',
    color: '#fd79a8',
    fill: 'rgba(253, 121, 168, 0.22)',
    activeFill: 'rgba(253, 121, 168, 0.48)',
    fallbackViewBox: { x: 430, y: 245, width: 95, height: 85 },
    shapePath:
      'M947 122 C974 110 1000 126 1002 155 C1004 184 975 198 948 185 C922 172 921 135 947 122 Z',
    labelPoint: { x: 472, y: 288 },
    pin: { x: 472, y: 288, labelX: 434, labelY: 250 },
    contacts: [
      {
        alumniId: "A001",
        name: "Moana",
        university: "卡迪夫大学",
        universityAbbr: "Cardiff",
        major: "考古学",
        country: "英国",
        state: "威尔士",
        city: "卡迪夫",
        campus: "主校区",
        lat: 51.4816,
        lng: -3.1791,
        rankType: null,
        rankValue: null,
        graduationYear: 2026,
        avatarId: "avatar_moana",
        logoUrl: "/alumni-logos/cardiff.svg",
        mapPoint: { x: 471.5, y: 301.7, labelDx: -28, labelDy: 15 }
      },
      {
        alumniId: "A002",
        name: "Emily",
        university: "伦敦大学学院",
        universityAbbr: "UCL",
        major: "统计学",
        country: "英国",
        state: "英格兰",
        city: "伦敦",
        campus: "布鲁姆斯伯里主校区",
        lat: 51.5246,
        lng: -0.1340,
        rankType: "QS世界大学排名",
        rankValue: 9,
        graduationYear: 2026,
        avatarId: "avatar_emily",
        logoUrl: "/alumni-logos/ucl.svg",
        mapPoint: { x: 479.6, y: 301.5, labelDx: 16, labelDy: -14 }
      },
      {
        alumniId: "A003",
        name: "Patrick",
        university: "牛津大学",
        universityAbbr: "Oxford",
        major: "生物学",
        country: "英国",
        state: "英格兰",
        city: "牛津",
        campus: "主校区",
        lat: 51.7520,
        lng: -1.2577,
        rankType: "QS世界大学排名",
        rankValue: 4,
        graduationYear: 2026,
        avatarId: "avatar_patrick",
        logoUrl: "/alumni-logos/oxford.svg",
        mapPoint: { x: 476.6, y: 300.5, labelDx: 18, labelDy: 14 }
      }
    ],
  },
  {
    id: 'hong-kong',
    label: '香港',
    shortLabel: 'HK',
    groupLabel: '亚洲',
    summary: '离内地最近的国际化大学网络。',
    description: '适合沉淀港校本科、授课型硕士、金融、数据、传媒、医学和跨境实习经验。',
    color: '#ffb545',
    fill: 'rgba(255, 181, 69, 0.28)',
    activeFill: 'rgba(255, 181, 69, 0.5)',
    fallbackViewBox: { x: 735, y: 360, width: 110, height: 95 },
    pin: { x: 784, y: 401, labelX: 824, labelY: 364 },
    contacts: [
      {
        alumniId: "A004",
        name: "Jiahan",
        university: "香港大学",
        universityAbbr: "HKU",
        major: "机械工程",
        country: "中国香港",
        state: null,
        city: "香港",
        campus: "薄扶林主校区",
        lat: 22.2830,
        lng: 114.1370,
        rankType: "QS世界大学排名",
        rankValue: 11,
        graduationYear: 2026,
        avatarId: "avatar_jiahan",
        logoUrl: "/alumni-logos/hku.svg",
        mapPoint: { x: 783.6, y: 400.4, labelDx: -30, labelDy: -12 }
      },
      {
        alumniId: "A009",
        name: "Angel",
        university: "香港大学",
        universityAbbr: "HKU",
        major: "经济学",
        country: "中国香港",
        state: null,
        city: "香港",
        campus: "薄扶林主校区",
        lat: 22.2830,
        lng: 114.1370,
        rankType: "QS世界大学排名",
        rankValue: 11,
        graduationYear: 2026,
        avatarId: "avatar_angel",
        logoUrl: "/alumni-logos/hku.svg",
        mapPoint: { x: 783.6, y: 400.4, labelDx: -30, labelDy: -12 }
      }
    ],
  },
  {
    id: 'singapore',
    label: '新加坡',
    shortLabel: 'SG',
    groupLabel: '亚洲',
    summary: '亚洲科技、金融与双语环境交汇点。',
    description: '适合收集 NUS/NTU/SMU、计算机、金融、商业分析、国际关系和实习就业经验。',
    color: '#16a085',
    fill: 'rgba(22, 160, 133, 0.26)',
    activeFill: 'rgba(22, 160, 133, 0.52)',
    fallbackViewBox: { x: 720, y: 405, width: 130, height: 105 },
    pin: { x: 807, y: 452, labelX: 850, labelY: 494 },
    contacts: [],
  },
  {
    id: 'australia',
    label: '澳洲',
    shortLabel: 'AUS',
    groupLabel: '大洋洲',
    summary: '南半球英联邦体系与生活方式导向区域。',
    description: '适合沉淀澳八大、商科、传媒、工程、医学相关路径，以及城市生活与签证经验。',
    color: '#ff7675',
    fill: 'rgba(255, 118, 117, 0.22)',
    activeFill: 'rgba(255, 118, 117, 0.46)',
    fallbackViewBox: { x: 770, y: 485, width: 130, height: 115 },
    shapePath:
      'M1608 659 C1646 611 1736 573 1799 607 C1864 642 1842 713 1785 752 C1719 795 1615 770 1587 716 C1578 696 1586 677 1608 659 Z',
    labelPoint: { x: 838, y: 545 },
    pin: { x: 838, y: 545, labelX: 878, labelY: 586 },
    contacts: [
      {
        alumniId: "A011",
        name: "Ryan",
        university: "悉尼大学",
        universityAbbr: "USYD",
        major: "数学",
        country: "澳大利亚",
        state: "新南威尔士州",
        city: "悉尼",
        campus: "坎珀当主校区",
        lat: -33.8885,
        lng: 151.1873,
        rankType: "QS世界大学排名",
        rankValue: 25,
        graduationYear: 2026,
        avatarId: "avatar_ryan",
        logoUrl: "/alumni-logos/usyd.svg",
        mapPoint: { x: 883.2, y: 558.5, labelDx: 14, labelDy: -12 }
      }
    ],
  },
  {
    id: 'europe',
    label: '欧洲',
    shortLabel: 'EU',
    groupLabel: '欧洲',
    summary: '大陆欧洲多语种、多学制与交换项目区域。',
    description: '适合收集法国、德国、荷兰、瑞士、意大利、西班牙等地区的本科、硕士、交换和科研经验。',
    color: '#4d96ff',
    fill: 'rgba(77, 150, 255, 0.2)',
    activeFill: 'rgba(77, 150, 255, 0.42)',
    fallbackViewBox: { x: 450, y: 240, width: 130, height: 115 },
    shapePath:
      'M1003 158 C1059 139 1128 165 1136 214 C1144 264 1074 293 1011 274 C956 249 936 181 1003 158 Z',
    labelPoint: { x: 510, y: 316 },
    pin: { x: 510, y: 316, labelX: 550, labelY: 278 },
    contacts: [],
  },
  {
    id: 'mainland-china',
    label: '中国内地',
    shortLabel: 'CN',
    groupLabel: '亚洲',
    summary: '国内顶尖高校与学术中心。',
    description: '适合连接国内一流学府的校友网络，涵盖计算机、工程、艺术及人文社科领域。',
    color: '#e74c3c',
    fill: 'rgba(231, 76, 60, 0.2)',
    activeFill: 'rgba(231, 76, 60, 0.42)',
    fallbackViewBox: { x: 660, y: 270, width: 210, height: 165 },
    pin: { x: 756, y: 356, labelX: 798, labelY: 318 },
    contacts: [],
  },
];

export const DEFAULT_ALUMNI_REGION_ID: AlumniRegionId = 'united-states';
