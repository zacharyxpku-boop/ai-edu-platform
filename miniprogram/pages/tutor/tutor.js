const api = require('../../utils/api');
const storage = require('../../utils/storage');

function fallbackReply(text, selected) {
  const target = selected && selected.text ? selected.text : '第一项必须做';
  if (/答案|直接|代写|帮我写/.test(text)) {
    return '我不能替你写答案。我们只做一步：你先说这题卡在哪个条件，我给最小提示。';
  }
  return `先抓「${target}」。别整套摊开，我们只看第一步：题目给了哪些已知条件？你先用自己的话写一句。`;
}

Page({
  data: {
    input: '',
    loading: false,
    selected: null,
    messages: []
  },

  onShow() {
    const selected = storage.get(storage.KEYS.selectedHomework, null);
    const messages = storage.get(storage.KEYS.tutorMessages, null) || [
      {
        role: 'assistant',
        text: '我只辅导必须做和关键错因，不替你写作业。把题目、你的步骤，或今晚第一项必须做发来。'
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
      this.setData({ input: '请根据今天雷达，带我做第一项必须做。' });
      return;
    }
    this.setData({ input: `带我做这项：${selected.text}` });
  },

  send() {
    const input = String(this.data.input || '').trim();
    if (!input || this.data.loading) return;

    const state = storage.loadState();
    const selected = this.data.selected;
    const messages = this.data.messages.concat([{ role: 'user', text: input }]);
    this.setData({ messages, input: '', loading: true });

    api.sendTutorMessage({
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
        text: '清空了。我们继续按规则来：只处理必须做和关键错因。'
      }
    ];
    storage.set(storage.KEYS.tutorMessages, messages);
    this.setData({ messages });
  }
});
