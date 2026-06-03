export const WEB_SURFACE_ROUTES = [
  {
    id: 'home',
    label: '官网首页',
    path: '/',
    miniappParity: 'pages/home/home',
    primaryAction: '打开产品体验',
    promise: '用上传材料、个性化报告、AI 私教、短回访和家长复盘，帮家庭决定今晚先做什么。'
  },
  {
    id: 'upload',
    label: '上传材料',
    path: '/upload',
    miniappParity: 'pages/entry-detail/entry-detail?scene=upload + pages/upload/upload',
    primaryAction: '上传或粘贴材料',
    promise: '把测评、成绩、错题、学校反馈和家长观察变成可追溯证据。'
  },
  {
    id: 'report',
    label: '个性化报告',
    path: '/report',
    miniappParity: 'pages/entry-detail/entry-detail?scene=report + pages/entry-detail/entry-detail?scene=parent + pages/profile/profile',
    primaryAction: '查看报告',
    promise: '先讲证据，再讲方法匹配，最后给出今晚可执行的一步。'
  },
  {
    id: 'tutor',
    label: 'AI 私教',
    path: '/tutor',
    miniappParity: 'pages/entry-detail/entry-detail?scene=tutor + pages/tutor/tutor',
    primaryAction: '开始第一问',
    promise: '用苏格拉底式追问帮孩子说出第一步，不代写答案。'
  },
  {
    id: 'review',
    label: '短回访',
    path: '/review',
    miniappParity: 'pages/entry-detail/entry-detail?scene=review + pages/review/review',
    primaryAction: '开始短回访',
    promise: '用主动回忆、迁移和变式验证，把错因修复成证据。'
  },
  {
    id: 'parent',
    label: '家长中心',
    path: '/parent',
    miniappParity: 'pages/entry-detail/entry-detail?scene=parent + pages/profile/profile',
    primaryAction: '看证据和下一步',
    promise: '让家长知道孩子为什么卡住、今晚问什么、下次看什么证据。'
  },
  {
    id: 'map',
    label: '今晚路线',
    path: '/map',
    miniappParity: 'pages/entry-detail/entry-detail?scene=today + pages/review/review',
    primaryAction: '查看路线',
    promise: '把上传、报告、AI 私教、短回访和家长复盘串成一条走得完的路线。'
  },
  {
    id: 'lobster',
    label: '龙虾 AI 教师',
    path: '/lobster',
    miniappParity: 'web-only',
    primaryAction: '打开配置入口',
    promise: '官网独立入口，承接家庭设备里的 AI 教师配置。',
    webOnly: true
  }
];

export const WEB_ENTRY_FLOW = [
  ['home', 'upload'],
  ['upload', 'report'],
  ['report', 'tutor'],
  ['tutor', 'review'],
  ['review', 'parent'],
  ['parent', 'map'],
  ['map', 'upload']
];

export function getWebRoute(id) {
  return WEB_SURFACE_ROUTES.find((route) => route.id === id) || WEB_SURFACE_ROUTES[0];
}
