export const WEB_DEMO_STATE = {
  active: 'home',
  student: { name: '小明', grade: '四年级', focus: '多步应用题' },
  progress: [
    { id: 'upload', label: '上传材料', done: true },
    { id: 'report', label: '生成报告', done: true },
    { id: 'tutor', label: 'AI 第一问', active: true },
    { id: 'review', label: '短回访' },
    { id: 'parent', label: '家长复盘' }
  ],
  uploads: [
    { file: '四年级数学单元卷.jpg', type: '错题照片', size: '2.4MB', status: '分析完成' },
    { file: '期末成绩单.pdf', type: '成绩单', size: '1.2MB', status: '分析完成' },
    { file: '学习风格测评.pdf', type: '测评报告', size: '0.9MB', status: '待验证' }
  ]
};

export const WEB_ENTRY_CARDS = [
  { id: 'upload', number: '01', title: '上传材料', desc: '测评、成绩、错题和反馈先进入证据链。', image: 'entry-upload.png', tone: 'green' },
  { id: 'report', number: '02', title: '个性化报告', desc: '解释证据、优势、待开发点和下一步。', image: 'entry-report.png', tone: 'blue' },
  { id: 'tutor', number: '03', title: 'AI 私教', desc: 'AI 追问第一步，不直接给答案。', image: 'entry-tutor.png', tone: 'green' },
  { id: 'review', number: '04', title: '短回访', desc: '把错因变成回忆、迁移和变式证据。', image: 'entry-review.png', tone: 'yellow' },
  { id: 'parent', number: '05', title: '家长中心', desc: '告诉家长今晚问什么、看什么证据。', image: 'entry-parent.png', tone: 'orange' },
  { id: 'map', number: '06', title: '今晚路线', desc: '看见本周路径、任务进度和复盘节点。', image: 'entry-map.png', tone: 'green' }
];

export const WEB_PAGE_GUIDES = {
  upload: {
    title: '上传页主线',
    steps: [
      ['01', '分门别类', '先判断材料类型，不急着下结论。'],
      ['02', '抽取证据', '成绩、错题、反馈进入同一证据台账。'],
      ['03', '生成报告', '跳到报告页解释置信度和方法匹配。']
    ],
    cta: ['report', '查看报告解释']
  },
  report: {
    title: '报告页主线',
    steps: [
      ['01', '先看证据', '区分强证据、弱证据和待验证假设。'],
      ['02', '匹配方法', '把学习信号映射到费曼、追问、回忆和变式。'],
      ['03', '去执行', '进入 AI 私教第一问或短回访验证。']
    ],
    cta: ['tutor', '进入 AI 私教']
  },
  tutor: {
    title: 'AI 私教主线',
    steps: [
      ['01', '说第一步', '孩子先说自己从哪里开始想。'],
      ['02', '只追问', 'AI 补提示，不给完整答案。'],
      ['03', '沉淀卡点', '把卡点送到短回访做验证。']
    ],
    cta: ['review', '去做短回访']
  },
  review: {
    title: '短回访主线',
    steps: [
      ['01', '主动回忆', '先不看答案，说出关键步骤。'],
      ['02', '变式迁移', '换问法验证方法是否真的会用。'],
      ['03', '家长复盘', '把证据汇总给家长看下一步。']
    ],
    cta: ['parent', '给家长看复盘']
  },
  parent: {
    title: '家长页主线',
    steps: [
      ['01', '看懂证据', '今晚发生了什么，孩子卡在哪里。'],
      ['02', '只问一句', '家长用一个问题确认真懂。'],
      ['03', '回到闭环', '补材料或进入下一轮 7 天验证。']
    ],
    cta: ['map', '查看今晚路线']
  },
  map: {
    title: '路线页主线',
    steps: [
      ['01', '今晚闭环', '只展示当前最小闭环。'],
      ['02', '未来 7 天', '把回访和变式排进节奏。'],
      ['03', '回流家长', '每一步都有证据可看。']
    ],
    cta: ['upload', '补充材料']
  }
};

export const WEB_MATERIAL_PIPELINE = [
  ['材料入口', '测评、成绩单、错题、学校反馈和家长观察先归档。'],
  ['证据分级', '强证据、弱证据、方法假设分开标注，避免给孩子贴标签。'],
  ['行动出口', '报告、AI 私教、短回访和家长问题共用同一组证据。']
];

export const WEB_CONFIDENCE_BANDS = [
  ['强证据', '成绩单、错题本、老师反馈', '支撑学科优先级和错因判断。'],
  ['中证据', '课堂表现、家长观察', '解释学习习惯和执行环境。'],
  ['待验证假设', '测评和学习偏好', '用于推荐方法组合，需要 7 天回访验证。']
];
