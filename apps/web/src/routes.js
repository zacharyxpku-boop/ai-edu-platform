export const WEB_SURFACE_ROUTES = [
  {
    id: 'home',
    label: '首页总览',
    path: '/',
    miniappParity: 'pages/home/home',
    primaryAction: '选择今晚第一步',
    promise: '一屏看懂资料、报告、私教、复习和家长下一步。'
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
    miniappParity: 'pages/radar/radar + pages/profile/profile',
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
    label: '复习游戏',
    path: '/review',
    miniappParity: 'pages/arcade/arcade + pages/review/review',
    primaryAction: '开始一轮挑战',
    promise: '把错因修复成回忆、迁移和复盘挑战。'
  },
  {
    id: 'parent',
    label: '家长中心',
    path: '/parent',
    miniappParity: 'pages/profile/profile',
    primaryAction: '看证据和下一步',
    promise: '让家长知道孩子为什么这样学、今晚问什么、下一次看什么证据。'
  }
];

export const WEB_ENTRY_FLOW = [
  ['home', 'upload'],
  ['upload', 'report'],
  ['report', 'tutor'],
  ['tutor', 'review'],
  ['review', 'parent'],
  ['parent', 'upload']
];

export function getWebRoute(id) {
  return WEB_SURFACE_ROUTES.find((route) => route.id === id) || WEB_SURFACE_ROUTES[0];
}
