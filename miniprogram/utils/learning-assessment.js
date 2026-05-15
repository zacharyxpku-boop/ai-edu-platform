const SUBJECT_RULES = [
  { subject: '数学', patterns: /数学|方程|应用题|列式|几何|函数|代数|计算|分数|小数|比例|等量关系/i },
  { subject: '英语', patterns: /英语|单词|语法|阅读|听写|时态|主语|谓语|句型/i },
  { subject: '语文', patterns: /语文|作文|阅读|古诗|古文|默写|概括|主旨|段意/i }
];

const STRUGGLE_RULES = [
  { struggle: '没思路', patterns: /没思路|不会下手|不知道怎么开始|不知道先写什么|不会下一步|不会列式|看不懂题|读不懂题/i },
  { struggle: '坐不住', patterns: /坐不住|拖拉|磨蹭|不想学|不想练|注意力不集中|写一会儿就停/i },
  { struggle: '总错', patterns: /错题|反复错|总错|粗心|总是错|步骤乱|容易漏|计算错/i }
];

function detectSubject(text) {
  const value = String(text || '');
  const hit = SUBJECT_RULES.find((item) => item.patterns.test(value));
  return hit ? hit.subject : '未知';
}

function detectStruggle(text) {
  const value = String(text || '');
  const hit = STRUGGLE_RULES.find((item) => item.patterns.test(value));
  return hit ? hit.struggle : '说明学习状态';
}

function recommendCapability(text) {
  const value = String(text || '');
  if (/没思路|不会下手|不知道怎么开始|不会列式|看不懂题|读不懂题/i.test(value)) {
    return {
      id: 'tutor',
      label: '苏格拉底导师',
      reason: '先追问第一步，让孩子把想法说出来'
    };
  }
  if (/坐不住|拖拉|磨蹭|不想学|注意力不集中/i.test(value)) {
    return {
      id: 'focus',
      label: '专注舱',
      reason: '先把任务缩成一小段，留下开始过的证据'
    };
  }
  if (/错题|反复错|粗心|总错|步骤乱|计算错/i.test(value)) {
    return {
      id: 'review',
      label: '错题卡点修复',
      reason: '先把错因和下次检查点整理出来'
    };
  }
  if (/复习|练习|巩固|回访/i.test(value)) {
    return {
      id: 'tools',
      label: '轻回访与练习',
      reason: '先回看昨天那一步，再做一小局轻练习'
    };
  }
  return {
    id: 'tutor',
    label: '苏格拉底导师',
    reason: '先从孩子最卡的一步开始'
  };
}

function buildLearningAssessment(text) {
  const source = String(text || '').trim();
  const subject = detectSubject(source);
  const struggle = detectStruggle(source);
  const capability = recommendCapability(source);
  const nextQuestion = subject === '数学'
    ? '你先能圈出题干里的已知条件吗？'
    : subject === '英语'
      ? '先找主语和谓语，还是先读一遍题？'
      : subject === '语文'
        ? '这题是看细节、主旨，还是原因？'
        : '先说你准备从哪一步开始？';
  const methodHint = {
    tutor: '用咕点追问，让孩子把第一步说出来。',
    focus: '先进入专注舱，围绕这一小步坐一段。',
    review: '先修错题卡点，留下下次检查点。',
    tools: '先做轻回访，再进小游戏轻练习。'
  }[capability.id] || '先从最小动作开始。';

  return {
    sourceText: source,
    subject,
    struggle,
    capability,
    nextQuestion,
    methodHint,
    summaryLine: source
      ? `这段描述更像在说 ${subject === '未知' ? '当前学习状态' : subject} 的 ${struggle}。`
      : '先录入一次成绩、测评或学习状态。'
  };
}

module.exports = {
  buildLearningAssessment,
  detectSubject,
  detectStruggle,
  recommendCapability
};
