const navigation = require('../../utils/navigation');

const PROOF_FLOW = [
  { scene: 'upload', label: '材料', hint: '先分类', icon: '/assets/reference/entry-upload.png' },
  { scene: 'report', label: '报告', hint: '看依据', icon: '/assets/reference/entry-report.png' },
  { scene: 'tutor', label: '私教', hint: '说一步', icon: '/assets/reference/entry-tutor.png' },
  { scene: 'review', label: '回访', hint: '验迁移', icon: '/assets/reference/entry-review.png' },
  { scene: 'parent', label: '家长', hint: '下一步', icon: '/assets/reference/entry-parent.png' }
];

function proofFlow(activeScene) {
  return PROOF_FLOW.map((item) => Object.assign({}, item, {
    active: item.scene === activeScene || (activeScene === 'today' && item.scene === 'tutor')
  }));
}

const SCENES = {
  today: {
    badge: '今晚主线',
    title: '先把今晚任务变成 3 个可执行动作',
    subtitle: '入口页只负责决定从哪开始。这里承接任务拆解、证据记录和下一步跳转。',
    heroImage: '/assets/reference/entry-map.png',
    primaryLabel: '去原小点说第一步',
    primaryRoute: '/pages/tutor/tutor?from=entry_today_first_step&open=flow',
    secondaryLabel: '先补材料',
    secondaryRoute: '/pages/upload/upload?from=entry_today_material',
    cards: [
      { label: '先定优先级', value: '把必须做、可放后、明天回访分开。', icon: '/assets/reference/entry-upload.png' },
      { label: '再说第一步', value: '孩子先说准备从哪里开始，私教只追问下一句。', icon: '/assets/reference/entry-tutor.png' },
      { label: '最后留证据', value: '完成后进入复习小关或家长进展卡。', icon: '/assets/reference/entry-review.png' }
    ],
    spotlight: {
      kicker: '今晚路线板',
      title: '入口只做一件事：决定从哪一步开始',
      image: '/assets/reference/entry-map.png',
      metrics: [
        { label: '任务拆解', value: '3步' },
        { label: '预计用时', value: '15分' },
        { label: '回流证据', value: '1条' }
      ],
      points: [
        '先把今晚任务变成可执行动作，不在首页堆满说明。',
        '孩子先说第一步，系统再决定去私教、复习还是家长页。',
        '每次完成都留下证据，明天能接着回访。'
      ]
    },
    proofSteps: proofFlow('today')
  },
  tutor: {
    badge: '原小点提示',
    title: '先问一句，不替孩子做完',
    subtitle: '把题目、卡点或第一步发进来，系统只给最小提示，并把可复习的点沉淀下来。',
    heroImage: '/assets/reference/entry-tutor.png',
    primaryLabel: '进入追问对话',
    primaryRoute: '/pages/tutor/tutor?from=entry_tutor_first_step&open=flow',
    secondaryLabel: '说完去复习卡',
    secondaryRoute: '/pages/review/review?from=entry_tutor_card',
    cards: [
      { label: '孩子说', value: '我准备先看哪个条件/哪句话。', icon: '/assets/reference/entry-tutor.png' },
      { label: 'AI 问', value: '下一步只问一个更小的问题。', icon: '/assets/reference/entry-map.png' },
      { label: '家长看', value: '只看第一步证据和明天怎么回访。', icon: '/assets/reference/entry-parent.png' }
    ],
    spotlight: {
      kicker: '私教追问板',
      title: '不直接给答案，只追问下一小步',
      image: '/assets/reference/entry-tutor.png',
      metrics: [
        { label: '提示层级', value: '3层' },
        { label: '答案边界', value: '守住' },
        { label: '沉淀卡点', value: '可回访' }
      ],
      points: [
        '先确认孩子已经说出的第一步，而不是替他开讲。',
        '只给最小提示：条件、依据、反例三选一。',
        '对话结束后生成复习卡，避免一次讲完就忘。'
      ]
    },
    proofSteps: proofFlow('tutor')
  },
  review: {
    badge: '复习小关',
    title: '5 分钟验证记忆和迁移',
    subtitle: '不在入口页铺满关卡。先选今天要验证的一张卡，再进入 90 秒回忆或错因复盘。',
    heroImage: '/assets/reference/entry-review.png',
    primaryLabel: '开始 90 秒回忆',
    primaryRoute: '/pages/review/review?mode=recall_return&from=entry_review',
    secondaryLabel: '回到原小点',
    secondaryRoute: '/pages/tutor/tutor?from=entry_review_repair',
    cards: [
      { label: '记忆', value: '能不能说出关键概念。', icon: '/assets/reference/entry-review.png' },
      { label: '迁移', value: '换一道同类题还会不会开始。', icon: '/assets/reference/entry-map.png' },
      { label: '证据', value: '只记录第一步、错因和明天回访。', icon: '/assets/reference/entry-report.png' }
    ],
    spotlight: {
      kicker: '复习闯关板',
      title: '先回忆，再迁移，最后回流证据',
      image: '/assets/reference/entry-review.png',
      metrics: [
        { label: '单局长度', value: '90秒' },
        { label: '验证目标', value: '迁移' },
        { label: '奖励来源', value: '真回忆' }
      ],
      points: [
        '游戏不是刷分，而是验证昨天那一步还记不记得。',
        '换一道同类题，看孩子能不能自己启动。',
        '只把错因和可迁移动作回流给报告和家长。'
      ]
    },
    proofSteps: proofFlow('review')
  },
  report: {
    badge: '个性化报告',
    title: '先讲清楚证据，再匹配学习方法',
    subtitle: '报告页不是营销页。它要说明材料从哪里来、天赋信号和成绩表现是否互相支持，以及为什么推荐这一组学习方法。',
    heroImage: '/assets/reference/entry-report.png',
    primaryLabel: '查看证据报告',
    primaryRoute: '/pages/profile/profile?from=entry_report_evidence&open=flow',
    secondaryLabel: '补充测评/错题',
    secondaryRoute: '/pages/upload/upload?from=entry_report_material',
    cards: [
      { label: '证据来源', value: '测评、成绩、错题、对话和复习记录分开标注，不混成一句结论。', icon: '/assets/reference/entry-upload.png' },
      { label: '天赋匹配', value: '先解释孩子适合怎样输入、输出和反馈，再落到具体方法。', icon: '/assets/reference/entry-report.png' },
      { label: '方法依据', value: '把费曼、苏格拉底追问、短周期回访变成可执行动作。', icon: '/assets/reference/entry-tutor.png' }
    ],
    spotlight: {
      kicker: '报告决策板',
      title: '证据先分层，结论才可信',
      image: '/assets/reference/entry-report.png',
      metrics: [
        { label: '材料完整度', value: '4类' },
        { label: '交叉验证', value: '3步' },
        { label: '方法匹配', value: '可执行' }
      ],
      points: [
        '先把测评、成绩、错题和家长观察分开看。',
        '只把互相支持的信号写进结论，弱证据进入待补充。',
        '每个建议都必须落到今晚能做的一步。'
      ]
    },
    proofSteps: proofFlow('report')
  },
  parent: {
    badge: '家长视图',
    title: '家长只看该问什么和下一步',
    subtitle: '家长不需要替孩子学习，也不需要被制造焦虑。这里把报告结论、第一步证据和明天回访动作收成一张家庭行动卡。',
    heroImage: '/assets/reference/entry-parent.png',
    primaryLabel: '打开家长中心',
    primaryRoute: '/pages/profile/profile?from=entry_parent_report&open=flow',
    secondaryLabel: '补一条证据',
    secondaryRoute: '/pages/upload/upload?from=entry_parent_material',
    cards: [
      { label: '证据来自哪里', value: '测评、成绩、错题、对话和复习记录。', icon: '/assets/reference/entry-report.png' },
      { label: '为什么这样学', value: '从学习偏好和当前卡点匹配方法。', icon: '/assets/reference/entry-tutor.png' },
      { label: '今晚怎么做', value: '只给一张家庭行动卡，不制造焦虑。', icon: '/assets/reference/entry-parent.png' }
    ],
    spotlight: {
      kicker: '家长行动卡',
      title: '今晚只问一个低压问题',
      image: '/assets/reference/entry-parent.png',
      metrics: [
        { label: '今晚目标', value: '一句话' },
        { label: '家长角色', value: '观察者' },
        { label: '回访时间', value: '明天' }
      ],
      points: [
        '不要催完整答案，只问“你准备从哪一步开始”。',
        '只记录孩子说出的第一步和卡住原因。',
        '明天用同类小题回访，不翻旧账。'
      ]
    },
    proofSteps: proofFlow('parent')
  },
  upload: {
    badge: '材料入口',
    title: '先分类，再生成学习包',
    subtitle: '材料不一致也要输出稳定 SOP：识别材料类型、提取证据、生成下一步。',
    heroImage: '/assets/reference/entry-upload.png',
    primaryLabel: '选择文件/图片',
    primaryRoute: '/pages/upload/upload?from=entry_upload_file&open=flow',
    secondaryLabel: '没有报告，做快测',
    secondaryRoute: '/pages/profile/profile?from=entry_upload_quiz&panel=assessment&quick_assessment=1',
    cards: [
      { label: '天赋/测评', value: '提取学习偏好、注意力和优势通道。', icon: '/assets/reference/entry-report.png' },
      { label: '成绩/错题', value: '提取学科卡点、错因和回访优先级。', icon: '/assets/reference/entry-review.png' },
      { label: '家长观察', value: '补足情绪、习惯和家庭配合线索。', icon: '/assets/reference/entry-parent.png' }
    ],
    spotlight: {
      kicker: '材料分类板',
      title: '先识别材料类型，再进入报告 SOP',
      image: '/assets/reference/entry-upload.png',
      metrics: [
        { label: '可上传', value: '6类' },
        { label: '弱证据', value: '待确认' },
        { label: '输出格式', value: '稳定' }
      ],
      points: [
        '测评、成绩、错题、老师反馈、家长观察分开处理。',
        '材料不足时先生成待补清单，不硬下结论。',
        '所有材料最后都进入同一个报告和学习闭环。'
      ]
    },
    proofSteps: proofFlow('upload')
  }
};

const SCENE_NAV = {
  today: { label: '今晚主线', image: '/assets/reference/entry-map.png' },
  upload: { label: '上传材料', image: '/assets/reference/entry-upload.png' },
  report: { label: '个性化报告', image: '/assets/reference/entry-report.png' },
  tutor: { label: '原小点', image: '/assets/reference/entry-tutor.png' },
  review: { label: '复习小关', image: '/assets/reference/entry-review.png' },
  parent: { label: '家长中心', image: '/assets/reference/entry-parent.png' }
};

const LOOP_NODES = [
  { key: 'upload', label: '上传', image: '/assets/reference/entry-upload.png' },
  { key: 'report', label: '报告', image: '/assets/reference/entry-report.png' },
  { key: 'tutor', label: '点拨', image: '/assets/reference/entry-tutor.png' },
  { key: 'review', label: '回访', image: '/assets/reference/entry-review.png' },
  { key: 'parent', label: '家长', image: '/assets/reference/entry-parent.png' }
];

function buildSceneLinks(activeKey) {
  return Object.keys(SCENE_NAV)
    .filter((key) => key !== activeKey)
    .map((key) => Object.assign({ key }, SCENE_NAV[key]));
}

Page({
  data: {
    sceneKey: 'today',
    scene: SCENES.today,
    sceneLinks: buildSceneLinks('today'),
    loopNodes: LOOP_NODES
  },

  onLoad(query = {}) {
    const key = query.scene || 'today';
    this.setScene(key);
  },

  setScene(key = 'today') {
    const sceneKey = SCENES[key] ? key : 'today';
    this.setData({
      sceneKey,
      scene: SCENES[sceneKey],
      sceneLinks: buildSceneLinks(sceneKey)
    });
  },

  openScene(event) {
    const key = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.scene
      : 'today';
    this.setScene(key);
  },

  goPrimary() {
    navigation.navigateLearningRoute(this.data.scene.primaryRoute);
  },

  goSecondary() {
    navigation.navigateLearningRoute(this.data.scene.secondaryRoute);
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: '/pages/home/home' });
  }
});
