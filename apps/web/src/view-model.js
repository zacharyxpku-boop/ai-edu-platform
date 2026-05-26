export const WEB_DEMO_STATE = {
  active: 'home',
  selectedMaterialType: '天赋测评',
  progress: [
    { id: 'upload', label: '上传资料', done: true },
    { id: 'report', label: '生成报告', done: true },
    { id: 'tutor', label: '说第一步', active: true },
    { id: 'review', label: '3分钟回访' },
    { id: 'parent', label: '家长查看' }
  ],
  uploads: [
    { file: '期中数学试卷_小明.jpg', type: '错题照片', size: '2.4MB', status: '分析完成', color: 'orange' },
    { file: '三年级下学期期末成绩单.pdf', type: '成绩单', size: '1.2MB', status: '分析完成', color: 'blue' },
    { file: '班主任评语_2024春季.pdf', type: '学校反馈', size: '0.9MB', status: '分析完成', color: 'yellow' },
    { file: '口算练习错题集.mp4', type: '错题照片', size: '15.6MB', status: '分析中', color: 'orange' },
    { file: '家长观察记录_兴趣与特长.pdf', type: '家长观察', size: '1.1MB', status: '待分析', color: 'purple' }
  ]
};

export const WEB_ENTRY_CARDS = [
  {
    id: 'upload',
    number: '01',
    title: '上传资料',
    desc: '上传天赋测评、成绩单、错题、老师反馈',
    icon: 'folder',
    tone: 'green'
  },
  {
    id: 'report',
    number: '02',
    title: '个性化报告',
    desc: '看懂证据、优势短板、下一步建议',
    icon: 'report',
    tone: 'blue'
  },
  {
    id: 'tutor',
    number: '03',
    title: 'AI私教',
    desc: '先说第一步，AI追问引导，不直接给答案',
    icon: 'bot',
    tone: 'mint'
  },
  {
    id: 'review',
    number: '04',
    title: '复习游戏',
    desc: '把错因变成闯关、回忆、迁移挑战',
    icon: 'game',
    tone: 'amber'
  },
  {
    id: 'parent',
    number: '05',
    title: '家长中心',
    desc: '今晚该问什么，孩子进展，下一步怎么做',
    icon: 'family',
    tone: 'peach'
  },
  {
    id: 'map',
    number: '06',
    title: '学习地图',
    desc: '查看本周路线、任务进度、回访节点',
    icon: 'map',
    tone: 'sage'
  }
];

export const WEB_PAGE_GUIDES = {
  upload: {
    title: '上传页主线',
    steps: [
      ['01', '分门别类', '先判断材料类型，不急着下结论'],
      ['02', '抽取证据', '成绩、错题、反馈进入同一证据台账'],
      ['03', '生成报告', '跳到报告页解释置信度和方法匹配']
    ],
    cta: ['report', '查看报告解释']
  },
  report: {
    title: '报告页主线',
    steps: [
      ['01', '看证据', '哪些来自材料，哪些只是待验证假设'],
      ['02', '配方法', '把学习信号映射到苏格拉底、费曼、回忆'],
      ['03', '去执行', '进入私教第一问或复习验证']
    ],
    cta: ['tutor', '进入AI私教']
  },
  tutor: {
    title: '私教页主线',
    steps: [
      ['01', '说第一步', '孩子先说自己从哪里开始想'],
      ['02', '只追问', 'AI补提示，不直接给完整答案'],
      ['03', '沉淀卡点', '把卡点送到复习页做回访']
    ],
    cta: ['review', '去做3分钟回访']
  },
  review: {
    title: '复习页主线',
    steps: [
      ['01', '主动回忆', '先不看答案说出关键步骤'],
      ['02', '变式迁移', '换问法验证方法是否真的会用'],
      ['03', '家长复盘', '把证据汇总给家长看下一步']
    ],
    cta: ['parent', '给家长看复盘']
  },
  parent: {
    title: '家长页主线',
    steps: [
      ['01', '看懂证据', '今晚发生了什么，孩子卡在哪里'],
      ['02', '只问一句', '家长用一个问题确认真懂'],
      ['03', '回到上传', '补材料或进入下一轮7天验证']
    ],
    cta: ['upload', '补充新材料']
  }
};

export const WEB_MATERIAL_PIPELINE = [
  ['材料入口', '天赋测评、成绩单、错题、学校反馈、家长观察先归档'],
  ['证据分级', '强证据、弱证据、方法假设分开标注，避免贴标签'],
  ['行动出口', '报告、私教、复习和家长问题共用同一组证据']
];

export const WEB_CONFIDENCE_BANDS = [
  ['强证据', '成绩单、错题本、老师反馈', '可直接支撑学科优先级和错因判断'],
  ['中证据', '课堂表现、家长观察', '用于解释学习习惯和执行环境'],
  ['待验证假设', '天赋测评、学习偏好', '只用于推荐方法组合，需7天回访验证']
];
