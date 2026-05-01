const api = require('../../utils/api');
const storage = require('../../utils/storage');

function fallbackReply(text, selected) {
  const target = selected && selected.text ? selected.text : '第一项必须做';
  if (/答案|直接|代写|帮我写/.test(text)) {
    return '我不能替你写答案。我们只做一步：你先说这题卡在哪个条件，我给最小提示。';
  }
  return `先抓「${target}」。别整套摊开，我们只看第一步：题目给了哪些已知条件？你先用自己的话写一句。`;
}

function safetyReply(result, input, selected) {
  if (result && result.risk_type === 'self_harm') {
    return '这个内容我不能继续展开。请先告诉家长或老师；如果你现在很难受，优先联系身边可信的大人或当地紧急支持渠道。';
  }
  return fallbackReply(input, selected);
}

Page({
  data: {
    input: '',
    loading: false,
    selected: null,
    messages: []
  },

  onShow() {
    const state = storage.loadState();
    let selected = storage.get(storage.KEYS.selectedHomework, null);
    if (!selected) {
      selected = ((state.homework_plan || {}).must_do || [])[0] || null;
      if (selected) {
        storage.set(storage.KEYS.selectedHomework, selected);
        storage.set(storage.KEYS.selectedHomeworkSource, 'auto_first_must');
      }
    }
    const messages = storage.get(storage.KEYS.tutorMessages, null) || [
      {
        role: 'assistant',
        text: selected
          ? `我已锁定今晚第一项必须做：「${selected.text}」。先把题目或你卡住的步骤发来，我只给最小提示。`
          : '我只处理高优先级任务和关键错因，不替你写作业。先从雷达页选择一项必须做，或把题目和你的步骤发来。'
      }
    ];
    this.setData({ selected, messages });
  },

  onInput(event) {
    this.setData({ input: event.detail.value });
  },

  quickStart() {
    const selected = this.data.selected;
    if (!selected) {
      const state = storage.loadState();
      const first = ((state.homework_plan || {}).must_do || [])[0];
      if (first) {
        storage.set(storage.KEYS.selectedHomework, first);
        storage.set(storage.KEYS.selectedHomeworkSource, 'quick_start_auto');
        this.setData({ selected: first, input: `带我做这项必须做：${first.text}` });
        return;
      }
      wx.switchTab({ url: '/pages/radar/radar' });
      return;
    }
    this.setData({ input: `带我做这项必须做：${selected.text}` });
  },

  send() {
    const input = String(this.data.input || '').trim();
    if (!input || this.data.loading) return;

    const state = storage.loadState();
    const selected = this.data.selected;
    const messages = this.data.messages.concat([{ role: 'user', text: input }]);
    this.setData({ messages, input: '', loading: true });

    api.checkContent(input).then((check) => {
      if (check && check.safe === false) {
        this.appendAssistant(safetyReply(check, input, selected));
        return null;
      }
      return api.sendTutorMessage({
        mode: 'homework',
        message: input,
        context: {
          selected_homework: selected,
          weak_points: state.weak_points || [],
          homework_plan: state.homework_plan || null
        }
      }).then((res) => {
        const reply = (res && res.reply) || fallbackReply(input, selected);
        this.appendAssistant(reply);
        return null;
      });
    }).catch(() => {
      this.appendAssistant(fallbackReply(input, selected));
    });
  },

  appendAssistant(reply) {
    const next = this.data.messages.concat([{ role: 'assistant', text: reply }]);
    storage.set(storage.KEYS.tutorMessages, next.slice(-20));
    this.setData({ messages: next, loading: false });
  },

  clearChat() {
    const messages = [
      {
        role: 'assistant',
        text: '清空了。我们继续按规则来：只处理高优先级任务和关键错因。'
      }
    ];
    storage.set(storage.KEYS.tutorMessages, messages);
    this.setData({ messages });
  }
});
