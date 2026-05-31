export const WEB_SURFACE_ROUTES = [
  {
    id: 'home',
    label: '学习主界面',
    path: '/',
    miniappParity: 'pages/home/home',
    primaryAction: '选择今晚第一步',
    promise: '一屏看懂上传、报告、AI私教、复习和家长下一步。'
  },
  {
    id: 'upload',
    label: '上传资料',
    path: '/upload',
    miniappParity: 'pages/upload/upload',
    primaryAction: '上传或粘贴材料',
    promise: '把测评、成绩、错题、学校反馈分门别类变成可分析证据。'
  },
  {
    id: 'report',
    label: '个性化报告',
    path: '/report',
    miniappParity: 'pages/entry-detail/entry-detail?scene=report + pages/entry-detail/entry-detail?scene=parent + pages/profile/profile',
    primaryAction: '查看报告与导出 PDF',
    promise: '先讲证据，再讲天赋和方法匹配，最后给家长今晚能做的一步。'
  },
  {
    id: 'tutor',
    label: 'AI私教',
    path: '/tutor',
    miniappParity: 'pages/tutor/tutor',
    primaryAction: '开始第一问',
    promise: '用苏格拉底式追问帮孩子说出第一步，不代写答案。'
  },
  {
    id: 'review',
    label: '复习岛',
    path: '/review',
    miniappParity: 'pages/review/review',
    primaryAction: '开始一轮挑战',
    promise: '把错因修复成回忆、迁移和复盘挑战。'
  },
  {
    id: 'parent',
    label: '家长中心',
    path: '/parent',
    miniappParity: 'pages/profile/profile',
    primaryAction: '看证据和下一步',
    promise: '让家长知道孩子为什么这样学、今晚问什么、下次看什么证据。'
  },
  {
    id: 'map',
    label: '今晚路径',
    path: '/map',
    miniappParity: 'pages/entry-detail/entry-detail?scene=today + pages/review/review',
    primaryAction: '查看今晚和未来 7 天路径',
    promise: '把上传、报告、AI私教、复习和家长回访串成一条能走完、能验证的学习路线。'
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
