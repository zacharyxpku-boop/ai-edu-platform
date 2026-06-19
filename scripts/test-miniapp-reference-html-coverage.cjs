const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const referenceRoot = 'C:\\Users\\86136\\Desktop\\小程序';

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function includes(source, term, message) {
  assert(source.includes(term), message || `missing ${term}`);
}

function excludes(source, term, message) {
  assert(!source.includes(term), message || `unexpected ${term}`);
}

[
  'AI私教 主界面.html',
  'AI私教 子页 1：自由对话.html',
  'AI私教 子页 2：知识点讲解.html',
  'AI私教 子页 3：题目点拨.html',
  'AI私教 子页 4：卡住恢复.html',
  '知识乐园 主.html',
  '知识乐园 子页 1：选知识点.html',
  '知识乐园 子页 2：玩法选择.html',
  '知识乐园 子页 3：游戏进行中.html',
  '知识乐园 子页 4：一局结束.html',
  '成长报告 主.html',
  '成长报告 子页 1：1 分钟问卷.html',
  '成长报告 子页 2：上传材料.html',
  '成长报告 子页 3：报告预览.html',
  '成长报告 子页 4：家长行动卡.html'
].forEach((name) => {
  const target = path.join(referenceRoot, name);
  assert(fs.existsSync(target), `reference HTML exists: ${name}`);
  assert(fs.statSync(target).size > 0, `reference HTML is non-empty: ${name}`);
});

const tutorWxml = read('miniprogram/pages/tutor/tutor.wxml');
const tutorWxss = read('miniprogram/pages/tutor/tutor.wxss');
const tutorJs = read('miniprogram/pages/tutor/tutor.js');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
const reviewWxss = read('miniprogram/pages/review/review.wxss');
const reviewJs = read('miniprogram/pages/review/review.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const profileWxss = read('miniprogram/pages/profile/profile.wxss');
const profileJs = read('miniprogram/pages/profile/profile.js');
const learningReportJs = read('miniprogram/utils/learning-report.js');
const uploadWxml = read('miniprogram/pages/upload/upload.wxml');
const uploadWxss = read('miniprogram/pages/upload/upload.wxss');
const uploadJs = read('miniprogram/pages/upload/upload.js');
const entryDetailJs = read('miniprogram/pages/entry-detail/entry-detail.js');

// AI 私教：主界面和 4 个子状态要落到真实聊天/点拨能力。
includes(tutorWxml, 'yd-tutor-screen', 'AI 私教主壳存在');
includes(tutorWxml, '原点 · 咕点', 'AI 私教主界面保留参考品牌名');
includes(tutorWxml, 'gudian-sticker.png', 'AI 私教主界面使用咕点贴纸图标贴近参考欢迎卡');
includes(tutorWxml, '和咕点聊聊', 'AI 私教主界面保留参考主标题');
includes(tutorWxml, '想聊什么都可以...', 'AI 私教主界面输入框 placeholder 对齐参考稿（想聊什么都可以...）');
assert(!tutorWxml.slice(tutorWxml.indexOf('class="tutor-chat-card"'), tutorWxml.indexOf('tutor-socratic-panel')).includes('wx:for'), 'AI 私教首屏聊天卡只显示固定引导白，不把历史消息平铺到首屏（历史在对话子页展示）');
includes(tutorWxml, 'tutor-chat-card', '自由对话子页映射到聊天工作区');
includes(tutorWxml, 'tutor-input-bar', '自由对话有真实输入框');
includes(tutorWxml, 'wx:for="{{messages}}"', '自由对话渲染真实消息历史');
includes(tutorWxml, 'tutor-avatar-dot', '保留参考在线状态视觉');
includes(tutorWxml, '<text>AI私教在线</text>', '自由对话顶栏在线状态贴近参考 HTML');
includes(tutorWxml, '<text class="tutor-dialogue-title">正在陪你想第一步</text>', '自由对话顶栏标题贴近参考 HTML');
includes(tutorWxml, '咕点在线', '聊天卡保留在线身份');
excludes(tutorWxml, 'AI私教在线 · 咕点在线', '自由对话顶栏不能把咕点身份拼进参考标题');
includes(tutorJs, '小原，这道物理题我完全没思路，怎么做呀？', '自由对话保留参考物理题样例');
includes(tutorJs, '是 5米/秒。', '自由对话保留孩子样例回复');
includes(tutorJs, '刹车后2秒停下', '自由对话保留追问样例');
includes(tutorJs, '找得很准！👍', '自由对话保留参考鼓励反馈');
includes(tutorJs, '那么第二步，根据“刹车后2秒停下”，你能想到要用哪个公式来算加速度吗？', '自由对话保留参考完整追问');
includes(tutorWxml, '每天都有同学在这里说出自己的第一步', '主界面保留使用提示且不捏造数字');
includes(tutorWxml, '问知识点', '知识点讲解入口存在');
includes(tutorJs, '先变乘号，再翻个底朝天', '知识点讲解保留黑板口诀');
includes(tutorJs, '忘了把后面的分数颠倒过来', '知识点讲解保留错因线索');
includes(tutorWxml, '题目点拨', '题目点拨入口存在');
includes(tutorWxml, '把题目发来，<text>咕点</text>只问第一步</text>', '题目点拨首屏标题贴近参考 HTML');
excludes(tutorWxml, '看懂题意 · 找第一步 · 检查错因', '题目点拨首屏不再堆模式说明');
excludes(tutorWxml, '打字/拍照留档 · 安全摘要 · 不代写答案', '题目点拨首屏不再堆安全说明');
includes(tutorWxml, '上传题图', '题目点拨保留题图入口但不承诺自动识别');
includes(tutorWxml, '临时留档', '题目点拨说明题图只做本轮留档');
excludes(tutorWxml, '自动保存', '题目点拨不承诺题图自动保存或自动解析');
includes(tutorWxml, '找第一步', '题目点拨保留第一步模式');
includes(tutorWxml, '学了什么', '主界面保留参考 HTML 的复盘入口');
includes(tutorWxml, 'activeTutorScene === \'recap\'', '复盘入口有对应子页场景');
includes(tutorWxml, '跟小原说点什么', '自由对话输入框贴近参考 HTML');
includes(tutorJs, '刚才的思考小记', '卡住恢复保留参考复盘小记');
includes(tutorJs, '正确列出了算式：4/5 ÷ 2', '卡住恢复保留思考证据');
includes(tutorJs, '整数变成倒数', '卡住恢复保留卡点细节');
includes(tutorWxml, 'requestSmallerTutorPrompt', '卡住恢复可以请求更小提示');
includes(tutorWxml, 'bindtap="attachTutorPhoto"', '题目点拨有拍照/材料入口');
includes(tutorJs, 'send()', 'AI 私教消息路径已实现');
includes(tutorJs, 'launchFirstStep(event)', 'AI 私教快捷入口会启动真实回合');
includes(tutorJs, 'recordSocraticEffectivenessFeedback', 'AI 私教能记录孩子是否仍卡住');
includes(tutorWxss, '.tutor-chat-card .tutor-bubble.me', 'AI 私教区分用户和助手气泡');
includes(tutorJs, 'prepareTutorReviewHandoff(options = {})', 'AI 私教到知识乐园的承接有真实构造器');
includes(tutorJs, "type: 'tutor_to_knowledge_park'", 'AI 私教承接会生成知识乐园复测卡');
includes(tutorJs, "event: 'tutor_to_knowledge_park_handoff'", 'AI 私教承接会记录复测证据事件');
includes(tutorJs, "storage.saveReviewCards([card].concat", 'AI 私教承接会在跳转前保存复测卡');
includes(tutorJs, "route: '/pages/review/review?from=tutor_reference_action&stage=tool'", 'AI 私教承接会进入知识乐园玩法选择阶段');
includes(tutorJs, 'navigation.navigateLearningRoute(handoff.route)', 'AI 私教复测入口不能退回裸跳转');

// 知识乐园：保留核心玩法，不恢复旧分类和旧挑战体系。
includes(reviewWxml, 'yd-review-screen', '知识乐园主壳存在');
includes(reviewWxml, '知识乐园', '知识乐园主界面保留参考页面名');
includes(reviewWxml, '选个知识点，马上开局探索', '知识乐园选知识点子页保留参考副标题');
includes(reviewWxml, '选一个最适合现在的节奏，马上开始', '知识乐园玩法选择保留参考副标题');
includes(reviewWxml, '用这个开一局', '知识乐园选知识点 CTA 对齐参考');
includes(reviewWxml, '结算页', '知识乐园结束页保留参考页面定位');
includes(reviewWxml, 'review-topic-row', '选知识点子页映射到知识点卡片');
includes(reviewWxml, '推荐探索', '选知识点保留参考推荐标题');
includes(reviewWxml, 'review-topic-search', '选知识点子页提供参考 HTML 同款知识点搜索框');
includes(reviewWxml, '搜索知识点，如：小数乘法', '搜索框占位文案与参考 HTML 一致');
excludes(reviewWxml, 'review-route-map', '知识乐园主界面不增加参考 HTML 以外的路线地图层');
includes(reviewWxml, '当前攻克目标', '玩法选择保留目标卡');
['揪出隐藏的易错点', '极速反应知识快练', '核心概念连连看', '逻辑推导解题路线'].forEach((term) => {
  includes(reviewWxml, term, `知识乐园主屏玩法文案贴近参考 HTML：${term}`);
});
['打地鼠，灭错因，轻松找漏洞', '快速判断，高频刺激极速练习', '拼合线索，建立知识关联网络', '步步推导，连通思路直达终点'].forEach((term) => {
  includes(reviewJs, term, `知识乐园玩法选择子页动态文案贴近参考 HTML：${term}`);
});
['2-3 分钟', '1-2 分钟', '3-5 分钟', '4-6 分钟'].forEach((term) => {
  includes(reviewJs, term, `知识乐园玩法选择子页时长贴近参考 HTML：${term}`);
});
includes(reviewWxml, 'selectKnowledgeStarterTopic', '知识点卡片可点击');
includes(reviewWxml, 'setReviewFlowStage', '子状态切换可点击');
includes(reviewWxml, 'review-tool-grid', '玩法选择映射到工具卡片');
includes(reviewWxml, '{{visiblePlayableReviewTools}}', '玩法卡片按 HTML 参考只展示核心玩法');
includes(reviewJs, 'buildVisiblePlayableReviewTools', '玩法选择可见列表由 JS 明确裁剪');
includes(reviewJs, "'whack', 'quiz', 'flashcard', 'match', 'snake', 'uno', 'variant', 'print'", '底层仍保留 8 个玩法能力');
['小数乘法', '认识分数', '面积计算', '行程问题', '百分数应用', '平均数', '云端真题 · 小数运算', '云端真题 · 分数运算', '云端真题 · 面积计算', '云端真题 · 百分数'].forEach((term) => {
  includes(reviewJs, term, `选知识点动态卡保留参考结构并接入真实题库分类：${term}`);
});
['闪卡翻翻', 'UNO错因卡', '变式三连', '纸面复习包'].forEach((term) => {
  excludes(reviewWxml, term, `知识乐园主界面不塞二级玩法：${term}`);
});
includes(reviewWxml, 'selectPlayableReviewTool', '玩法卡片先选中，贴近 HTML 参考选择态');
includes(reviewWxml, 'startSelectedPlayableReviewTool', '底部 CTA 能启动选中的真实工具');
includes(reviewJs, 'runPlayableReviewTool(event)', '真实工具启动能力保留在 JS');
includes(reviewJs, "this.openPlayableReviewStage('live', tools)", '开始选中玩法必须进入进行中页面，而不是只改变选择态');
includes(reviewWxml, 'review-game-progress', '游戏进行中有进度状态');
includes(reviewJs, 'openPlayableReviewStage(stage = \'live\'', '进行中/结算页可直接构造可玩状态');
includes(reviewJs, "this.openPlayableReviewStage('live')", '直接点进行中不能退回空工具页');
includes(reviewJs, "this.openPlayableReviewStage('finished')", '直接点一局结束不能退回空工具页');
includes(reviewWxml, '需要提示', '游戏进行中保留提示动作');
includes(reviewWxml, '我能说第一步', '游戏进行中主按钮把参考答案表达安全替换为第一步表达');
excludes(reviewWxml, '我记得答案', '知识乐园进行中不能把参考 HTML 的答案按钮原样带回前台');
includes(reviewJs, 'result === \'remembered\'', '第一步主按钮仍写入 remembered 结果，不展示完整答案');
excludes(reviewWxml, 'review-choice-board', '游戏进行中不外露底层选项面板，保持参考单卡体验');
includes(reviewJs, 'selectWhackChoice', '错因地鼠底层选择能力保留在 JS');
includes(reviewJs, 'selectMatchTile', '配对玩法底层选择能力保留在 JS');
includes(reviewJs, 'pickSnakeTile', '路线接龙底层排序能力保留在 JS');
includes(reviewJs, 'reference_live_first_step_button', '参考四按钮能生成本轮第一步证据');
includes(reviewWxml, 'review-finish-card', '一局结束有证据总结');
includes(reviewWxml, '档案袋留下了', '一局结束保留证据袋表达');
includes(reviewWxml, 'activeReviewTool.finishEvidencePrimary', '一局结束保留参考记住内容结构，但改为本轮动态证据');
includes(reviewWxml, 'activeReviewTool.finishEvidenceSecondary', '一局结束保留第二条记住内容结构，但不增加长列表');
includes(reviewWxml, 'activeReviewTool.finishStuckLine', '一局结束保留参考卡点结构，但改为本轮动态卡点');
includes(reviewWxml, 'activeReviewTool.finishTomorrowLine', '一局结束保留参考明天回访结构，但改为本轮动态回访');
includes(reviewWxml, '明天再认认门～', '一局结束保留参考结算页的回访语气');
excludes(reviewWxml, '静夜思', '一局结束不再写死参考样例内容');
includes(reviewWxml, 'openReviewParentEvidence', '结束页可交给成长报告');
includes(reviewJs, 'buildFinishReviewSummary', '结束页由本轮尝试结果生成动态证据');
includes(reviewJs, 'finishPlayableReviewTool(event)', '完成玩法会写入真实回访证据');
includes(reviewJs, "const toolIds = ['whack', 'quiz', 'flashcard', 'match', 'snake', 'uno', 'variant', 'print'];", '知识乐园保留八个核心玩法集合');
['错因地鼠', '快闪问答', '闪卡翻翻', '拼图配对', '路线接龙', 'UNO错因卡', '变式三连', '打印练习单'].forEach((term) => {
  includes(reviewJs, term, `知识乐园玩法存在：${term}`);
});
includes(reviewJs, "const engineCatalog = ['whack', 'quiz', 'flashcard', 'match', 'snake', 'uno', 'variant', 'print'].map", '练习包生成八个玩法 deliverable');
includes(reviewJs, 'tool.templateOnly', '非实时引擎玩法会进入练习包承接而不是空跳');
includes(reviewJs, 'this.runTemplateDeliverable', 'UNO/变式/打印等玩法可打开真实练习包工作台');
includes(reviewWxml, 'review-template-workbench', '玩法选择页展示练习包承接面板');
includes(reviewWxml, 'practiceTemplateWorkbench.samples', '练习包承接面板展示真实样例来源');
includes(reviewWxss, '.review-template-workbench', '练习包承接面板有专属样式');
includes(reviewWxss, '.review-finish-card', '结束状态有专属样式');

// 成长报告：主界面、问卷、上传材料、报告预览、家长行动卡都要可见可点。
includes(profileWxml, 'yd-parent-screen', '成长报告主壳存在');
includes(profileWxml, '<text class="yd-parent-pill">••• ｜ ○</text>', '成长报告主屏顶部贴近参考 HTML 的胶囊菜单，不显示状态 badge');
includes(profileWxml, '材料越多，报告越准', '成长报告主界面保留参考核心承诺');
includes(profileWxml, '快速勾选，建立初像', '成长报告主界面保留参考问卷卡文案');
includes(profileWxml, '拍照留存，手动摘录', '成长报告主界面上传卡保留参考入口但不承诺自动识别');
includes(profileWxml, '性格、习惯与抗挫力', '成长报告主界面保留参考进度说明');
includes(profileWxml, '我们从碎片中拼凑出了孩子的学习画像', '报告预览保留参考说明');
includes(profileWxml, '孩子对图像、表格的敏感度远高于纯文字。建议在讲解抽象概念时，多使用手绘思维导图或实物辅助。', '报告预览保留参考偏好解释');
includes(profileWxml, '错题多集中在最后一步进位错误，这反映了由于基础计算熟练度不足导致的“工作记忆瓶颈”。', '报告预览保留参考卡点解释');
includes(profileWxml, '在开始正式作业前，先进行10分钟口算热身。这能“激活”数学思维状态，显著降低后续大题的笔误率。', '报告预览保留参考今晚建议');
includes(profileWxml, 'growth-questionnaire-panel', '问卷子页存在');
includes(profileWxml, 'growth-questionnaire-progress', '问卷进度存在');
includes(profileWxml, 'answerLearningQuestion', '问卷选项可点击');
includes(profileWxml, 'setGrowthScene', '成长报告子页 tabs 可点击');
includes(profileWxml, 'questionIndex === 0', '问卷首屏只渲染一题');
includes(profileWxml, 'growth-subpage-nav questionnaire', '问卷顶部对齐参考的关闭按钮与进度胶囊');
includes(profileWxml, 'growth-questionnaire-progress nav', '问卷进度胶囊位于顶部导航');
includes(profileWxml, '{{growthQuestionPrompt}}', '问卷标题由当前题动态驱动');
includes(profileJs, "growthQuestionPrompt: '孩子最近最常卡在哪里？'", '问卷首题默认文案对齐参考');
includes(learningReportJs, '孩子最近最常卡在哪里？', '底层问卷首题存在');
['听不懂知识点', '会做但总错', '不愿开始', '写得慢', '容易忘', '家长不确定'].forEach((term) => {
  includes(learningReportJs, term, `问卷首题选项存在：${term}`);
});

includes(profileWxml, '完善信息', '上传材料子页保留参考顶部状态');
includes(profileWxml, '收集线索碎片', '上传材料子页保留参考标题');
includes(profileWxml, '不必全部填满哦～', '上传材料子页保留参考轻量提示');
assert((profileWxml.match(/材料越真实，建议越具体。/g) || []).length === 1, '上传材料子页不重复堆叠同一句说明');
includes(profileWxml, 'growth-upload-card primary', '上传材料子页使用材料卡片');
assert((profileWxml.match(/class="growth-upload-card/g) || []).length >= 5, '上传材料子页至少有五张材料卡');
['错题描述', '成绩/周测', '老师反馈', '家长观察', '测评摘要'].forEach((term) => {
  includes(profileWxml, term, `上传材料卡包含：${term}`);
});
includes(profileWxml, '拍照留存/手动摘录', '成绩/周测卡只承诺拍照留存和手动摘录');
includes(uploadWxml, '拍照留存 · 手动摘录线索', '独立上传页只承诺拍照留存和手动摘录');
excludes(profileWxml + uploadWxml + entryDetailJs, '支持拍照识别', '可见小程序入口不承诺未上线的拍照识别能力');
['upload-folder-stack-transparent.png', 'report-radar-card-illustration.png', 'family-avatar-group-transparent.png'].forEach((asset) => {
  includes(profileWxml, asset, `成长报告使用参考资产：${asset}`);
});
includes(profileWxml, '专属学习偏好', '上传后解锁学习偏好');
includes(profileWxml, '听觉型', '上传后解锁听觉型示例');
includes(profileWxml, '深层卡点定位', '上传后解锁卡点定位');
includes(profileWxml, '概念脱节', '上传后解锁概念脱节示例');
includes(profileWxml, '今晚行动建议', '上传后解锁今晚行动');
includes(profileWxml, 'data-action="uploadPage"', '上传卡片能进入真实上传页');
includes(profileWxml, 'learningReportSummary.progressStatusLabel', '成长报告进度状态由真实 summary 驱动');
includes(profileWxml, 'learningReportSummary.preferenceProgressClass', '学习偏好进度不再硬编码完成态');
includes(profileWxml, 'learningReportSummary.materialProgressClass', '卡点材料进度不再硬编码完成态');
includes(profileWxml, 'learningReportSummary.actionProgressClass', '行动建议进度不再硬编码完成态');
includes(profileJs, 'questionnaireCollected: assessmentCount > 0', '成长报告问卷进度由答案数量驱动');
includes(profileJs, 'materialCollected: sourceCount > 0', '成长报告材料进度由真实来源驱动');
includes(profileJs, 'const draftHasContent = !!(', '成长报告不会把空 reportDraft 对象误判成已生成报告');
includes(profileJs, 'const reportHasDraft = !!(draftHasContent || reportState.reportJobCaseId)', '成长报告完成态由真实草稿内容或远端报告任务驱动');
includes(profileJs, "progressStatusLabel: reportHasDraft ? '已生成预览'", '成长报告顶部状态会随报告生成切换');
includes(profileWxss, '.growth-progress-step.done > text:last-child', '成长报告已完成进度项使用完成态标签');

includes(uploadWxml, 'upload-evidence-grid', '独立上传页也有证据类型网格');
includes(uploadWxml, 'yd-upload-back', '独立上传页顶部使用参考返回按钮');
includes(uploadWxml, 'yd-upload-titlebar', '独立上传页顶部标题居中');
excludes(uploadWxml, 'yd-upload-brand', '独立上传页不再使用旧品牌重顶栏');
includes(uploadWxml, '收集线索碎片 🧩', '独立上传页标题贴近参考上传材料 HTML');
includes(uploadWxml, '直接拍照或打字都可以', '独立上传页说明贴近参考上传材料 HTML');
includes(uploadWxml, '错题描述', '独立上传页首张材料卡贴近参考上传材料 HTML');
includes(uploadWxml, '手动摘录线索', '独立上传页成绩卡保留手动摘录边界文案');
includes(uploadWxml, 'upload-intake-workbench', '独立上传页保留文字材料输入');
includes(uploadWxml, 'chooseImage', '独立上传页支持照片留存动作');
includes(uploadJs, 'submit()', '独立上传页可以提交材料');
includes(uploadJs, 'importMaterialPack', '独立上传页可以导入材料包');
includes(uploadWxss, '.upload-evidence-grid', '独立上传页证据网格有样式');

includes(profileWxml, 'growth-report-preview', '报告预览子页存在');
includes(profileWxml, '成长线索初步发现', '报告预览标题对齐参考');
includes(profileWxml, '初步报告 · 基于 2 份材料', '报告预览保留参考状态');
includes(profileWxml, '不替孩子学习，只为成长提供更好的土壤', '家长行动卡保留参考短副标题');
includes(profileWxml, '开始了解', '成长报告主界面第三步不是死状态');
excludes(profileWxml, '待生成', '成长报告主界面不展示不可点击的死状态');
includes(profileWxml, '学习偏好线索', '报告预览有学习偏好卡');
includes(profileWxml, '当前卡点证据', '报告预览有卡点证据卡');
includes(profileWxml, 'learningReportSummary.learningPreferenceSource', '报告预览的问卷来源改为真实数据绑定');
includes(profileWxml, 'learningReportSummary.diagnosisSource', '报告预览的卡点来源改为真实数据绑定');
includes(profileWxml, '来源：AI私教', '报告预览保留 AI 私教来源兜底');
includes(profileWxml, '<text bindtap="shareGrowthReportPreview">↗</text>', '报告预览分享按钮可点击');
includes(profileJs, 'shareGrowthReportPreview()', '报告预览分享按钮有安全分享逻辑');
excludes(profileWxml, 'growth-report-action-card-link', '报告预览底部不额外堆第四个行动卡入口');
excludes(profileWxss, 'growth-report-action-card-link', '报告预览第四入口样式残留已清理');

includes(profileWxml, 'growth-parent-action-card', '家长行动卡子页存在');
includes(profileWxml, '今晚行动已为你准备好', '家长行动卡标题对齐参考');
includes(profileWxml, '今晚行动指南', '家长行动卡定位清楚');
includes(profileWxml, '正向具体表扬', '家长行动卡保留第一条行动');
includes(profileWxml, '清空桌面非学习用品', '家长行动卡保留环境行动');
includes(profileWxml, '只问问题，不讲答案', '家长行动卡保留提问行动');
includes(profileWxml, '完成勾选后，系统将为您更新明日建议', '家长行动卡保留完成反馈');
includes(profileWxml, 'completeParentActionCard', '家长行动卡完成动作可点击');
includes(profileWxml, 'remindParentActionLater', '家长行动卡稍后提醒可点击');
includes(profileWxml, '<text bindtap="remindParentActionLater">…</text>', '家长行动卡右上角菜单不是死控件');
includes(profileJs, 'uploadPage', '成长报告上传材料能跳到真实上传页');
includes(profileJs, "growthActiveScene: 'action'", '成长报告能切到行动卡');
includes(profileJs, 'generateLearningReport', '成长报告可以生成报告');
includes(profileJs, 'buildParentEvidenceRoute', '报告预览使用上下文证据路由');
includes(profileWxss, '.growth-report-preview', '报告预览有专属样式');
includes(profileWxss, '.growth-parent-action-card', '家长行动卡有专属样式');

const activeUi = [
  tutorWxml,
  tutorWxss,
  reviewWxml,
  reviewWxss,
  profileWxml,
  profileWxss,
  uploadWxml,
  uploadWxss
].join('\n');

['练习单生成器', '课堂互动工具', '学生自主练习', '排行榜', '商店', '勋章', '闯关', 'arcade', 'mole-', 'ux-kit', 'ux-entry', 'module-v1', 'v1-'].forEach((term) => {
  excludes(activeUi, term, `不得回流旧 UI/产品词：${term}`);
});

console.log('Miniapp reference HTML coverage contract passed.');
