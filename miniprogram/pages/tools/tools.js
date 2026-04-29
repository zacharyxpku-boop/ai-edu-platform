Page({
  data: {
    tools: [
      {
        key: 'diagnosis',
        name: '测评诊断',
        desc: '用 10 分钟输入成绩、错题和题目描述，先定位弱点。',
        action: '开始测评',
        path: '/pages/diagnosis/diagnosis'
      },
      {
        key: 'upload',
        name: '试卷/作业录入',
        desc: '拍照可留档，诊断依据来自手动录入的题号、错题和清单。',
        action: '录入清单',
        path: '/pages/upload/upload'
      },
      {
        key: 'radar',
        name: '雷达弱点',
        desc: '把弱点翻译成今晚必须做、灵活选、可以跳过。',
        action: '看雷达',
        tab: true,
        path: '/pages/radar/radar'
      },
      {
        key: 'tutor',
        name: '原小点陪练',
        desc: '只引导高优先级任务和关键错因，不替孩子写答案。',
        action: '去陪练',
        tab: true,
        path: '/pages/tutor/tutor'
      }
    ]
  },

  openTool(event) {
    const index = event.currentTarget.dataset.index;
    const item = this.data.tools[index];
    if (!item) return;
    if (item.tab) {
      wx.switchTab({ url: item.path });
    } else {
      wx.navigateTo({ url: item.path });
    }
  }
});
