const COPY = {
  privacy: {
    title: '隐私政策',
    items: [
      '我们只收集提供学习建议所需的信息：年级、学科、作业清单、错题描述、家长主动提交的联系方式。',
      'MVP 阶段照片只做本地留档，不做自动图片识别，不上传识别。',
      '手机号仅用于内测回访和服务沟通，不会公开展示或出售给第三方。',
      '用户可在“我的”页面撤回授权，并要求删除个人信息。'
    ]
  },
  terms: {
    title: '用户协议',
    items: [
      '原点智学提供 AI 辅助学习建议，不替代学校教学、老师判断或家长监护。',
      'AI 内容仅作学习参考，重要学习决策请结合老师反馈和实际情况。',
      '产品不承诺固定学习结果，不提供代写作业服务。',
      '请勿输入违法、侵权、隐私敏感或与学习无关的内容。'
    ]
  },
  minor: {
    title: '未成年人保护',
    items: [
      '未成年人使用前应获得家长或监护人同意。',
      '原小点不鼓励长时间连续使用；正式版会加入时长提醒和夜间保护。',
      '孩子完整对话默认不直接展示给家长，家长侧优先看到进展、弱点类型和作业建议。',
      '如孩子表达明显负面情绪，请优先联系家长、老师或专业支持渠道。'
    ]
  }
};

Page({
  data: {
    title: COPY.privacy.title,
    items: COPY.privacy.items
  },

  onLoad(query) {
    const doc = COPY[query.type] || COPY.privacy;
    wx.setNavigationBarTitle({ title: doc.title });
    this.setData(doc);
  }
});
