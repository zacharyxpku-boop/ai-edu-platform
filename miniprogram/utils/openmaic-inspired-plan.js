'use strict';

const SAFE_SHARE_BOUNDARY = '只分享错因、第一步、家长检查句和回访动作；不分享原题、照片、完整答案、完整对话、孩子姓名或家长联系方式。';
const IDENTITY_CONTACT_BLOCKED_FIELDS = ['child_name', 'parent_phone', 'parent_wechat', 'contact_info'];
const OPENMAIC_SAFE_BLOCKED_FIELDS = ['original_question', 'full_answer', 'full_dialogue', 'score', 'ranking', 'talent_label'].concat(IDENTITY_CONTACT_BLOCKED_FIELDS);

const OPENMAIC_REFERENCE_POLICY = {
  id: 'openmaic_reference_policy',
  sourceName: 'OpenMAIC',
  sourceUrl: 'https://github.com/THU-MAIC/OpenMAIC',
  license: 'AGPL-3.0',
  decision: 'reference_workflow_only',
  commercialRule: '不复制、不链接、不部署 OpenMAIC 代码；商业闭源小程序只借鉴两阶段生成、事件回放、动作引擎和质量评估思想。',
  borrowedIdeas: [
    'two_stage_generation_outline_then_scene',
    'playback_event_state_machine',
    'action_engine_for_learning_moves',
    'quality_rubric_before_release'
  ],
  forbiddenUses: [
    'copy_openmaic_code',
    'ship_agpl_server_as_closed_backend',
    'copy_prompts_or_assets',
    'promise_full_ai_classroom_generation',
    'export_raw_question_or_answer_pack'
  ]
};

const PUBLIC_K12_RESOURCE_DECISIONS = [
  {
    id: 'official_curriculum_standards',
    label: '公开课标/考试说明',
    directUse: ['学科、年级、章节、能力轴、题型名称'],
    localCodeOwns: ['课程骨架', '题型路由', '报告放行门', '来源登记'],
    aiBetterFor: ['把能力轴改写成孩子能听懂的一句追问'],
    mustNotUse: ['复制整段原文', '包装成官方题库', '生成标准答案库']
  },
  {
    id: 'public_oer_materials',
    label: 'OER/开放许可资源',
    directUse: ['已确认许可的结构、概念标签、活动类型'],
    localCodeOwns: ['license_gate', 'source_registry_gate', 'reuse_scope'],
    aiBetterFor: ['改写为本地第一步、小黑板、家长检查句'],
    mustNotUse: ['未核许可就进公开卡片', '抓取原文训练模型', '保留外部图片或答案']
  },
  {
    id: 'family_uploaded_material',
    label: '家庭上传错题/试卷/天赋报告',
    directUse: ['仅限该家庭私有报告和回访计划'],
    localCodeOwns: ['隐私门', '报告置信度', '分享脱敏', '下一证据'],
    aiBetterFor: ['在脱敏后写家长能读懂的说明'],
    mustNotUse: ['公开沉淀原题', '外传孩子材料', '单次上传就下天赋定论']
  },
  {
    id: 'generated_practice_variants',
    label: '生成式变式练习',
    directUse: ['经本地规则审核后的变式入口和第一步'],
    localCodeOwns: ['答案可见门', '奖励发放', '掌握判断', '间隔复习'],
    aiBetterFor: ['生成不同语气的苏格拉底追问'],
    mustNotUse: ['AI 直接判掌握', 'AI 直接发奖励', 'AI 输出完整答案']
  }
];

const MINI_LESSON_VISUAL_TEMPLATES = [
  {
    subject: 'math',
    match: /数学|方程|应用题|比例|几何|函数|计算|代数|数量|math/i,
    boardMove: '画数量关系：已知量 -> 未知量 -> 先设谁',
    conceptLens: '数量关系入口',
    boardLayers: ['圈题目问什么', '列已知量和未知量', '写出第一条等量/对应关系'],
    visualPrimitives: ['circle_target_quantity', 'table_known_unknown', 'draw_equation_arrow'],
    misconception: '急着套公式或算数，没有先说清谁和谁相等/对应。',
    checkQuestion: '如果把数字遮住，你还能说出等量关系吗？',
    parentLine: '你先说未知量是谁，以及它和哪个已知量有关。',
    nearTransfer: '换一个数字，只复述等量关系，不求完整答案。'
  },
  {
    subject: 'physics',
    match: /物理|力|电路|光|速度|压强|浮力|physics/i,
    boardMove: '画对象和方向：研究对象 -> 受力/路径 -> 已知量',
    conceptLens: '对象方向入口',
    boardLayers: ['圈研究对象', '标方向/路径/连接关系', '写第一个已知量和单位'],
    visualPrimitives: ['circle_object', 'draw_force_or_path_arrow', 'mark_unit_quantity'],
    misconception: '只看现象或图形，没有先定对象、方向和决定量。',
    checkQuestion: '你现在研究的是谁？方向从哪里到哪里？',
    parentLine: '先别算，你先指给我看研究对象和方向。',
    nearTransfer: '换一个图，只说研究对象、方向和第一个已知量。'
  },
  {
    subject: 'chemistry',
    match: /化学|反应|溶液|气体|酸|碱|盐|分子|chem/i,
    boardMove: '画变化前后：物质A -> 条件 -> 物质B',
    conceptLens: '变化前后入口',
    boardLayers: ['写反应前有什么', '标条件/操作', '写反应后看到什么'],
    visualPrimitives: ['left_right_before_after', 'mark_condition', 'tag_observable_change'],
    misconception: '只背现象，没有分清反应前后和条件。',
    checkQuestion: '变化前有什么？加了什么条件？变化后有什么？',
    parentLine: '你先讲变化前后，不用背完整方程式。',
    nearTransfer: '换一个现象，只说反应前后分别有什么。'
  },
  {
    subject: 'english',
    match: /英语|英文|单词|句子|时态|语法|阅读|english/i,
    boardMove: '划句子骨架：主语 -> 动作 -> 时间/修饰',
    conceptLens: '句子结构入口',
    boardLayers: ['圈主语', '划动作/谓语', '找时间或修饰信号'],
    visualPrimitives: ['underline_subject', 'box_verb', 'mark_time_signal'],
    misconception: '只翻译单词，没有先看句子骨架和时态信号。',
    checkQuestion: '这句话谁在做？做了什么？时间信号在哪里？',
    parentLine: '先圈主语和动作，不急着整句翻译。',
    nearTransfer: '换一句话，只圈主语、动作和时间信号。'
  },
  {
    subject: 'chinese',
    match: /语文|阅读|作文|古诗|文言|段落|chinese/i,
    boardMove: '画证据线：题目问法 -> 原文句子 -> 自己的话',
    conceptLens: '证据句入口',
    boardLayers: ['圈题目关键词', '找原文证据句', '把证据改成自己的话'],
    visualPrimitives: ['circle_question_keyword', 'quote_evidence_sentence', 'paraphrase_arrow'],
    misconception: '直接凭感觉答，没有把答案挂回原文证据。',
    checkQuestion: '哪一句原文能证明你的说法？',
    parentLine: '先找一句证据句，再说自己的理解。',
    nearTransfer: '换一个段落，只找一句能支撑答案的原文。'
  },
  {
    subject: 'biology',
    match: /生物|细胞|器官|生态|遗传|结构|功能|biology/i,
    boardMove: '画结构功能：结构 -> 功能 -> 现象',
    conceptLens: '结构功能入口',
    boardLayers: ['圈结构名称', '写它的功能', '连到题目现象'],
    visualPrimitives: ['label_structure', 'link_function', 'connect_observed_phenomenon'],
    misconception: '背名词但没有说明结构为什么导致这个现象。',
    checkQuestion: '这个结构负责什么功能？题目现象和它怎么连上？',
    parentLine: '你先说结构和功能的对应关系。',
    nearTransfer: '换一个结构，只说它对应的功能。'
  },
  {
    subject: 'geography',
    match: /地理|地图|气候|经纬|地形|公转|自转|geography/i,
    boardMove: '画空间因果：位置 -> 条件 -> 结果',
    conceptLens: '空间因果入口',
    boardLayers: ['定位置/方向', '写自然或人文条件', '连到一个结果'],
    visualPrimitives: ['locate_region', 'draw_condition_arrow', 'connect_result'],
    misconception: '只背结论，没有先定位置和因果条件。',
    checkQuestion: '先说位置，再说哪个条件导致这个结果。',
    parentLine: '你先指位置，再说一个导致结果的条件。',
    nearTransfer: '换一个区域，只说位置、条件和一个结果。'
  }
];

const MINI_LESSON_VISUAL_PRIMITIVE_RENDER_CONTRACT = [
  ['circle_target_quantity', 'primitive-circle-target', 'target_quantity', 'point_to_what_is_being_found'],
  ['table_known_unknown', 'primitive-known-unknown-table', 'known_unknown', 'name_one_known_and_one_unknown'],
  ['draw_equation_arrow', 'primitive-relation-arrow', 'quantity_relation', 'say_the_relation_before_calculating'],
  ['circle_object', 'primitive-circle-object', 'study_object', 'point_to_the_object_first'],
  ['draw_force_or_path_arrow', 'primitive-direction-arrow', 'direction_or_path', 'trace_direction_before_formula'],
  ['mark_unit_quantity', 'primitive-unit-tag', 'unit_quantity', 'read_the_unit_before_number'],
  ['left_right_before_after', 'primitive-before-after', 'before_after', 'say_before_condition_after'],
  ['mark_condition', 'primitive-condition-tag', 'condition', 'name_the_condition'],
  ['tag_observable_change', 'primitive-observation-tag', 'observable_change', 'name_what_changed'],
  ['underline_subject', 'primitive-underline-subject', 'sentence_subject', 'find_who_does_the_action'],
  ['box_verb', 'primitive-box-verb', 'sentence_action', 'box_the_action_word'],
  ['mark_time_signal', 'primitive-time-signal', 'time_signal', 'find_the_time_signal'],
  ['circle_question_keyword', 'primitive-question-keyword', 'question_keyword', 'circle_what_the_question_asks'],
  ['quote_evidence_sentence', 'primitive-evidence-quote', 'text_evidence', 'find_one_evidence_sentence'],
  ['paraphrase_arrow', 'primitive-paraphrase-arrow', 'paraphrase', 'say_it_in_own_words'],
  ['label_structure', 'primitive-structure-label', 'structure', 'label_the_structure'],
  ['link_function', 'primitive-function-link', 'function', 'connect_structure_to_function'],
  ['connect_observed_phenomenon', 'primitive-phenomenon-link', 'phenomenon', 'connect_to_observed_result'],
  ['locate_region', 'primitive-location-pin', 'location', 'point_to_location_first'],
  ['draw_condition_arrow', 'primitive-condition-arrow', 'condition_cause', 'draw_condition_to_result'],
  ['connect_result', 'primitive-result-link', 'result', 'name_one_result']
].map(([id, wxClass, renderRole, childAction]) => ({
  id,
  wxClass,
  renderRole,
  childAction,
  owner: 'local_code',
  aiAllowed: 'rewrite_short_hint_only',
  requiredEvidence: ['child_points_or_names_primitive', 'child_says_first_step'],
  allowedSurfaces: ['tutor_mini_lesson', 'review_return_card', 'parent_report_summary'],
  blockedFields: ['raw_question', 'full_answer', 'score', 'ranking', 'talent_label'].concat(IDENTITY_CONTACT_BLOCKED_FIELDS)
}));

function buildMiniLessonVisualPrimitiveContract(primitives = []) {
  const requested = Array.isArray(primitives) ? primitives : [];
  const byId = MINI_LESSON_VISUAL_PRIMITIVE_RENDER_CONTRACT.reduce((map, item) => {
    map[item.id] = item;
    return map;
  }, {});
  return requested.map((id) => byId[id]).filter(Boolean);
}

const MINI_LESSON_TOPIC_CARDS = [
  {
    id: 'math_equation_story',
    subject: 'math',
    match: /应用题|方程|等量|比例|分数|百分数|路程|工程|math/i,
    label: '数学应用题：先找等量关系',
    conceptGap: '把故事翻译成等量关系',
    firstBoard: '已知量 -> 未知量 -> 等量词',
    microScript: '先不算，先把“谁和谁相等”说出来。',
    checkPrompt: '遮住数字后，还能说出这条等量关系吗？',
    parentObserve: '今晚只听孩子说未知量和等量词，不追完整答案。',
    nextDayCard: '换一组数字，只复述等量关系。',
    localGate: 'child_names_unknown_and_relation'
  },
  {
    id: 'math_geometry_condition',
    subject: 'math',
    match: /几何|角|面积|周长|三角形|圆|平行|垂直|geometry/i,
    label: '数学几何：先圈条件再连定理',
    conceptGap: '图形条件没有转成可用关系',
    firstBoard: '图形名称 -> 已知条件 -> 可用关系',
    microScript: '先把图里已经给你的关系标出来，再想用哪个性质。',
    checkPrompt: '这一步用到的是哪一个已知条件？',
    parentObserve: '让孩子指图说条件，不急着写证明或计算。',
    nextDayCard: '换一张图，只说第一个可用条件。',
    localGate: 'child_points_to_condition_before_formula'
  },
  {
    id: 'math_calculation_trap',
    subject: 'math',
    match: /计算|小数|分数|单位|符号|括号|约分|calculation/i,
    label: '数学计算：先查单位和符号',
    conceptGap: '计算入口对了，但符号/单位/括号漏检',
    firstBoard: '单位 -> 符号 -> 运算顺序',
    microScript: '先做检查动作，再动笔算。',
    checkPrompt: '这题最容易漏的是单位、符号还是括号？',
    parentObserve: '让孩子说一个检查点，避免家长直接重算。',
    nextDayCard: '明天只练一题同类检查，不拼速度。',
    localGate: 'child_names_one_trap_before_calculation'
  },
  {
    id: 'physics_force_object',
    subject: 'physics',
    match: /力|受力|摩擦|浮力|压强|平衡|物理|physics/i,
    label: '物理受力：先定研究对象',
    conceptGap: '没有先确定研究对象和方向',
    firstBoard: '研究对象 -> 方向 -> 已知量',
    microScript: '先圈研究对象，再画方向，最后才列量。',
    checkPrompt: '现在研究的是谁？方向从哪里到哪里？',
    parentObserve: '让孩子先指对象和方向，不问公式。',
    nextDayCard: '换一张图，只复述对象、方向、已知量。',
    localGate: 'child_names_object_and_direction'
  },
  {
    id: 'physics_circuit_path',
    subject: 'physics',
    match: /电路|电流|电压|电阻|串联|并联|开关|circuit/i,
    label: '物理电路：先走一遍电流路径',
    conceptGap: '没有把电路连接关系走通',
    firstBoard: '电源 -> 路径 -> 分支/开关',
    microScript: '先用手指沿电流路径走一遍，再判断串并联。',
    checkPrompt: '电流到这里是分开还是合并？',
    parentObserve: '让孩子画路径，先不背串并联结论。',
    nextDayCard: '换电路图，只判断路径和分支。',
    localGate: 'child_traces_current_path'
  },
  {
    id: 'physics_image_ray',
    subject: 'physics',
    match: /光|透镜|成像|反射|折射|光路|image|ray/i,
    label: '物理光学：先画关键光线',
    conceptGap: '没有把成像规则落实到光路',
    firstBoard: '物体位置 -> 主光线 -> 像的位置',
    microScript: '先画一条最关键光线，别直接背结论。',
    checkPrompt: '这条光线经过透镜后往哪里走？',
    parentObserve: '让孩子解释一条线，不要求完整光路图。',
    nextDayCard: '换位置，只画一条规则光线。',
    localGate: 'child_draws_one_rule_ray'
  },
  {
    id: 'chem_reaction_before_after',
    subject: 'chemistry',
    match: /反应|方程式|沉淀|气体|变色|化学|chem/i,
    label: '化学反应：先说变化前后',
    conceptGap: '现象和条件没有分清',
    firstBoard: '反应前 -> 条件 -> 反应后',
    microScript: '先讲前后变化，再决定要不要写方程式。',
    checkPrompt: '变化前有什么？加了什么条件？变化后看到什么？',
    parentObserve: '让孩子先说现象链，不逼背完整方程式。',
    nextDayCard: '换一个现象，只说前、条件、后。',
    localGate: 'child_names_before_condition_after'
  },
  {
    id: 'chem_particle_model',
    subject: 'chemistry',
    match: /分子|原子|离子|微观|溶液|质量守恒|particle/i,
    label: '化学微观：先看粒子怎么变',
    conceptGap: '宏观现象没有连到微观粒子',
    firstBoard: '粒子种类 -> 排列/数量 -> 宏观现象',
    microScript: '把看见的现象翻译成粒子的变化。',
    checkPrompt: '变的是粒子种类、间隔，还是数量关系？',
    parentObserve: '让孩子说“变了什么/没变什么”。',
    nextDayCard: '换一个现象，只判断粒子层面的变化。',
    localGate: 'child_identifies_particle_change'
  },
  {
    id: 'chem_experiment_variable',
    subject: 'chemistry',
    match: /实验|变量|对照|操作|现象|结论|experiment/i,
    label: '化学实验：先找变量和对照',
    conceptGap: '实验操作、现象、结论混在一起',
    firstBoard: '变量 -> 对照 -> 现象 -> 结论',
    microScript: '先问：这组实验只改变了什么？',
    checkPrompt: '哪一项是变量，哪一项必须保持相同？',
    parentObserve: '家长只追问变量，不替孩子下结论。',
    nextDayCard: '换实验，只圈变量和对照。',
    localGate: 'child_names_variable_and_control'
  },
  {
    id: 'english_sentence_skeleton',
    subject: 'english',
    match: /句子|语法|时态|主语|谓语|从句|english|grammar/i,
    label: '英语句子：先抓主干',
    conceptGap: '单词认识，但句子骨架没抓住',
    firstBoard: '主语 -> 动作 -> 时间/修饰',
    microScript: '先找谁做了什么，再看时间信号。',
    checkPrompt: '这句话谁在做？做了什么？时间信号在哪里？',
    parentObserve: '让孩子圈主语和动作，不急着整句翻译。',
    nextDayCard: '换一句话，只圈主语、动作、时间信号。',
    localGate: 'child_marks_subject_verb_time'
  },
  {
    id: 'english_reading_evidence',
    subject: 'english',
    match: /阅读|细节|推断|主旨|段落|evidence|reading/i,
    label: '英语阅读：先回原文找证据',
    conceptGap: '凭印象作答，没有回到原文证据',
    firstBoard: '题干关键词 -> 原文句 -> 选项排除',
    microScript: '先把答案挂回原文一句话。',
    checkPrompt: '哪一句原文支持这个选择？',
    parentObserve: '让孩子指出原文，不争论答案。',
    nextDayCard: '换一题，只找证据句。',
    localGate: 'child_points_to_text_evidence'
  },
  {
    id: 'english_word_context',
    subject: 'english',
    match: /单词|词义|完形|上下文|搭配|cloze|word/i,
    label: '英语词义：先看上下文线索',
    conceptGap: '只背词义，没有用上下文判断',
    firstBoard: '前一句 -> 目标词 -> 后一句',
    microScript: '先看前后句给了什么线索，再猜词义。',
    checkPrompt: '前后句里哪一个词帮你判断？',
    parentObserve: '让孩子说线索词，不直接查词典。',
    nextDayCard: '换一个词，只找上下文线索。',
    localGate: 'child_names_context_clue'
  },
  {
    id: 'chinese_reading_evidence',
    subject: 'chinese',
    match: /阅读|段落|中心|情感|作用|语文|chinese/i,
    label: '语文阅读：先找证据句',
    conceptGap: '答案没有挂回原文证据',
    firstBoard: '题目问法 -> 原文证据 -> 自己的话',
    microScript: '先找到能证明你想法的原文句。',
    checkPrompt: '哪一句原文能支撑你的说法？',
    parentObserve: '家长只问证据句，不评价文采。',
    nextDayCard: '换一段文字，只找一条证据。',
    localGate: 'child_finds_source_sentence'
  },
  {
    id: 'chinese_poem_image',
    subject: 'chinese',
    match: /古诗|诗歌|意象|情感|文言|poem/i,
    label: '语文古诗：先抓意象和情感',
    conceptGap: '只翻译字面，没有看意象作用',
    firstBoard: '意象 -> 画面 -> 情感',
    microScript: '先说诗里出现了什么画面，再说它带来的情感。',
    checkPrompt: '这个意象让你看到什么画面？',
    parentObserve: '让孩子说画面，不要求背赏析模板。',
    nextDayCard: '换一句诗，只说意象和画面。',
    localGate: 'child_links_image_to_feeling'
  },
  {
    id: 'chinese_writing_structure',
    subject: 'chinese',
    match: /作文|立意|结构|素材|开头|结尾|writing/i,
    label: '语文作文：先定观点和材料',
    conceptGap: '材料堆砌，没有观点统领',
    firstBoard: '观点 -> 事例 -> 一句解释',
    microScript: '先定一句观点，再选一个能证明它的事例。',
    checkPrompt: '这个事例证明了哪一句观点？',
    parentObserve: '家长只问观点和事例是否对应。',
    nextDayCard: '换一个素材，只说它能证明什么观点。',
    localGate: 'child_links_example_to_claim'
  },
  {
    id: 'biology_structure_function',
    subject: 'biology',
    match: /结构|功能|器官|细胞|组织|生物|biology/i,
    label: '生物结构：先连结构和功能',
    conceptGap: '背名词但没说明结构为什么导致功能',
    firstBoard: '结构 -> 功能 -> 现象',
    microScript: '先说这个结构负责什么功能，再连到题目现象。',
    checkPrompt: '这个结构的功能是什么？它怎样解释现象？',
    parentObserve: '让孩子说一组结构-功能对应。',
    nextDayCard: '换一个结构，只说对应功能。',
    localGate: 'child_links_structure_to_function'
  },
  {
    id: 'biology_process_sequence',
    subject: 'biology',
    match: /过程|循环|消化|呼吸|光合|遗传|sequence/i,
    label: '生物过程：先排步骤顺序',
    conceptGap: '过程步骤顺序混乱',
    firstBoard: '起点 -> 中间变化 -> 结果',
    microScript: '先把过程排成三段，不急着背完整描述。',
    checkPrompt: '这个过程从哪里开始，最后得到什么？',
    parentObserve: '让孩子说起点和结果，减少背诵压力。',
    nextDayCard: '换一个过程，只说起点、中间、结果。',
    localGate: 'child_orders_process_steps'
  },
  {
    id: 'biology_data_graph',
    subject: 'biology',
    match: /图表|曲线|数据|变量|实验|graph|data/i,
    label: '生物图表：先看变量关系',
    conceptGap: '读图只看数值，没有看变量趋势',
    firstBoard: '横轴 -> 纵轴 -> 趋势',
    microScript: '先说两个轴分别表示什么，再说趋势。',
    checkPrompt: '横轴变大时，纵轴怎样变化？',
    parentObserve: '让孩子读轴和趋势，不要求完整结论。',
    nextDayCard: '换一张图，只说轴和趋势。',
    localGate: 'child_reads_axis_and_trend'
  },
  {
    id: 'geography_location_condition',
    subject: 'geography',
    match: /地图|位置|经纬|区域|气候|地形|geography/i,
    label: '地理区域：先定位置和条件',
    conceptGap: '背结论前没有定位和条件',
    firstBoard: '位置 -> 条件 -> 结果',
    microScript: '先定在哪里，再说这个位置带来什么条件。',
    checkPrompt: '先说位置，再说一个导致结果的条件。',
    parentObserve: '让孩子指位置和条件，不背整段答案。',
    nextDayCard: '换一个区域，只说位置、条件、结果。',
    localGate: 'child_names_location_condition_result'
  },
  {
    id: 'geography_motion_cause',
    subject: 'geography',
    match: /自转|公转|昼夜|四季|五带|地球运动|motion/i,
    label: '地理运动：先画因果链',
    conceptGap: '地球运动和现象因果混淆',
    clusterId: 'process_chain',
    firstBoard: '运动方式 -> 太阳照射 -> 现象',
    microScript: '先说是哪种运动，再连到看到的现象。',
    checkPrompt: '这个现象来自自转还是公转？为什么？',
    parentObserve: '让孩子先判断运动方式，不背结论。',
    nextDayCard: '换一个现象，只说运动方式和原因。',
    localGate: 'child_links_motion_to_phenomenon'
  },
  {
    id: 'geography_human_nature_link',
    subject: 'geography',
    match: /人口|城市|交通|农业|工业|资源|human/i,
    label: '地理人地关系：先连自然和人类活动',
    conceptGap: '自然条件和人类活动没有建立因果',
    clusterId: 'process_chain',
    firstBoard: '自然条件 -> 人类选择 -> 影响',
    microScript: '先说自然条件，再说人为什么这样选择。',
    checkPrompt: '这个产业/城市为什么会出现在这里？',
    parentObserve: '让孩子说一个自然条件和一个人类选择。',
    nextDayCard: '换一个地区，只说条件和选择。',
    localGate: 'child_links_nature_to_human_choice'
  },
  {
    id: 'math_function_graph',
    subject: 'math',
    match: /函数|图像|坐标|斜率|顶点|一次函数|二次函数|function/i,
    label: '数学函数：先读图像三件事',
    conceptGap: '公式和图像没有互相翻译',
    firstBoard: '横轴/纵轴 -> 关键点 -> 变化趋势',
    microScript: '先不代数，先说图像从哪里开始、怎么变、关键点在哪。',
    checkPrompt: '图上哪个点或趋势支持你的判断？',
    parentObserve: '让孩子先指关键点和趋势，不急着套公式。',
    nextDayCard: '换一张图，只说轴、关键点和趋势。',
    localGate: 'child_reads_axis_point_trend'
  },
  {
    id: 'math_proof_reason',
    subject: 'math',
    match: /证明|推理|因为|所以|条件推出|proof/i,
    label: '数学证明：先写因为所以链',
    conceptGap: '结论跳太快，中间理由缺失',
    firstBoard: '已知 -> 可推出 -> 目标结论',
    microScript: '先写一句“因为...所以...”，不要直接写最终结论。',
    checkPrompt: '这一步的“因为”来自题目还是定理？',
    parentObserve: '家长只追问理由来源，不替孩子补证明。',
    nextDayCard: '换一道证明，只补第一条因为所以。',
    localGate: 'child_names_reason_source'
  },
  {
    id: 'physics_motion_graph',
    subject: 'physics',
    match: /运动|速度|时间|路程|图像|匀速|加速度|motion graph/i,
    label: '物理运动：先读量和图',
    conceptGap: '没有把运动量和图像含义对应起来',
    firstBoard: '横轴 -> 纵轴 -> 斜率/面积',
    microScript: '先说两个轴，再判断斜率或面积代表什么。',
    checkPrompt: '这条线变陡说明哪个量变了？',
    parentObserve: '让孩子先读轴，不问公式。',
    nextDayCard: '换一个图，只说轴和一个变化。',
    localGate: 'child_reads_motion_axis_meaning'
  },
  {
    id: 'physics_energy_transfer',
    subject: 'physics',
    match: /能量|功|机械能|热量|转化|守恒|energy/i,
    label: '物理能量：先说从哪到哪',
    conceptGap: '能量转化对象和方向不清',
    firstBoard: '起始能量 -> 转化过程 -> 最终能量',
    microScript: '先画能量从哪里来、到哪里去，再谈公式。',
    checkPrompt: '哪一种能量减少，哪一种增加？',
    parentObserve: '家长只问能量方向，不追计算。',
    nextDayCard: '换一个情境，只说能量转化方向。',
    localGate: 'child_names_energy_before_after'
  },
  {
    id: 'chem_solution_ion',
    subject: 'chemistry',
    match: /溶液|酸碱|离子|pH|盐|中和|solution/i,
    label: '化学溶液：先看离子和条件',
    conceptGap: '溶液现象没有连到离子变化',
    firstBoard: '溶质/离子 -> 条件 -> 现象',
    microScript: '先说溶液里可能有什么离子，再解释现象。',
    checkPrompt: '这个现象由哪类离子或条件引起？',
    parentObserve: '让孩子先说离子或条件，不背整段反应。',
    nextDayCard: '换一个溶液现象，只说离子、条件、现象。',
    localGate: 'child_links_ion_condition_phenomenon'
  },
  {
    id: 'chem_conservation_ratio',
    subject: 'chemistry',
    match: /质量守恒|配平|化学计量|比例|方程式|conservation/i,
    label: '化学守恒：先数原子再配平',
    conceptGap: '直接背方程式，没有检查元素守恒',
    firstBoard: '反应物原子数 -> 生成物原子数 -> 系数调整',
    microScript: '先数一种元素两边是否相等，再考虑系数。',
    checkPrompt: '先检查哪一种元素两边数量不同？',
    parentObserve: '让孩子只数一种元素，不要求一次配完。',
    nextDayCard: '换一个方程式，只检查一个元素守恒。',
    localGate: 'child_counts_one_element_balance'
  },
  {
    id: 'english_listening_sound',
    subject: 'english',
    match: /听写|听力|发音|音标|连读|重音|dictation|listening/i,
    label: '英语听写：先抓音和拼写块',
    conceptGap: '听到声音但没有拆成拼写块',
    firstBoard: '听到的音 -> 拼写块 -> 易错位',
    microScript: '先重复听到的音，再写最确定的拼写块。',
    checkPrompt: '这个词最容易错在哪个音或字母组合？',
    parentObserve: '家长只听孩子说易错位，不直接报答案。',
    nextDayCard: '换一个词，只说音、拼写块、易错位。',
    localGate: 'child_names_sound_spelling_trap'
  },
  {
    id: 'english_writing_sentence',
    subject: 'english',
    match: /写作|作文|句型|连接词|表达|writing sentence/i,
    label: '英语写作：先搭一句骨架',
    conceptGap: '想法有了，但句子骨架不稳',
    firstBoard: '观点 -> 句型骨架 -> 一个细节',
    microScript: '先写一句最简单的主谓宾，再补一个细节。',
    checkPrompt: '这句话的主语、动词和一个细节分别是什么？',
    parentObserve: '家长只看句子有没有主语和动词。',
    nextDayCard: '换一个观点，只搭一句骨架。',
    localGate: 'child_builds_subject_verb_detail'
  },
  {
    id: 'chinese_classical_function_words',
    subject: 'chinese',
    match: /文言|实词|虚词|翻译|断句|古文|classical/i,
    label: '语文文言：先定词义和句式',
    conceptGap: '逐字翻译，没有先看关键词和句式',
    firstBoard: '关键词 -> 句式 -> 通顺翻译',
    microScript: '先圈一个关键词，再判断这句在说谁做什么。',
    checkPrompt: '这个词在句子里是什么意思？',
    parentObserve: '家长只问一个关键词，不要求整句背译。',
    nextDayCard: '换一句文言，只圈关键词和句式。',
    localGate: 'child_explains_one_classical_keyword'
  },
  {
    id: 'chinese_argument_logic',
    subject: 'chinese',
    match: /议论文|论点|论据|论证|观点|argument/i,
    label: '语文议论：先分论点和论据',
    conceptGap: '把例子当观点，论证关系没说清',
    firstBoard: '观点 -> 论据 -> 证明关系',
    microScript: '先说作者想证明什么，再看用了什么材料。',
    checkPrompt: '这个例子证明了哪一句观点？',
    parentObserve: '让孩子分清观点和例子。',
    nextDayCard: '换一段议论，只说观点和一个论据。',
    localGate: 'child_links_evidence_to_argument'
  },
  {
    id: 'biology_ecology_relation',
    subject: 'biology',
    match: /生态|食物链|种群|环境|适应|生态系统|ecology/i,
    label: '生物生态：先连关系网',
    conceptGap: '只背物种名，没有看相互关系',
    firstBoard: '生物 -> 关系 -> 环境变化',
    microScript: '先说两个对象之间是什么关系，再看环境变化影响谁。',
    checkPrompt: '如果这个条件变了，哪个对象先受影响？',
    parentObserve: '家长只问一条关系，不追完整生态链。',
    nextDayCard: '换一个生态情境，只说对象、关系、影响。',
    localGate: 'child_names_ecology_relation'
  },
  {
    id: 'biology_genetics_trait',
    subject: 'biology',
    match: /遗传|基因|性状|亲代|子代|显性|genetics/i,
    label: '生物遗传：先分亲代子代',
    conceptGap: '性状和基因关系混在一起',
    firstBoard: '亲代性状 -> 可能组合 -> 子代表现',
    microScript: '先分清亲代给了什么，再看子代可能表现。',
    checkPrompt: '这个性状来自哪一组亲代信息？',
    parentObserve: '让孩子先说亲代和子代，不急着算比例。',
    nextDayCard: '换一个性状，只说亲代、组合、表现。',
    localGate: 'child_links_parent_trait_to_offspring'
  },
  {
    id: 'geography_climate_graph',
    subject: 'geography',
    match: /气温|降水|气候图|季节|气候类型|climate graph/i,
    label: '地理气候图：先读温度和降水',
    conceptGap: '看到气候图但没有分温度、降水和季节',
    firstBoard: '气温曲线 -> 降水柱 -> 季节特征',
    microScript: '先说最热月、最冷月和降水集中在哪个季节。',
    checkPrompt: '降水最多的季节和气温最高的季节一致吗？',
    parentObserve: '让孩子先读图，不背气候类型名称。',
    nextDayCard: '换一张气候图，只说温度、降水、季节。',
    localGate: 'child_reads_temperature_rainfall_season'
  },
  {
    id: 'geography_map_scale_direction',
    subject: 'geography',
    match: /比例尺|方向|图例|等高线|地图判读|scale|contour/i,
    label: '地理地图判读：先看三要素',
    conceptGap: '地图题没有先看方向、比例尺和图例',
    firstBoard: '方向 -> 比例尺 -> 图例/等高线',
    microScript: '先确认方向，再用比例尺或图例解释判断。',
    checkPrompt: '这一步用了地图三要素中的哪一个？',
    parentObserve: '家长只问方向、比例尺、图例中的一个。',
    nextDayCard: '换一张地图，只说先看哪一项。',
    localGate: 'child_uses_one_map_element'
  }
];

function inferMiniLessonCluster(card = {}) {
  const id = String(card.id || '');
  const text = [id, card.label, card.conceptGap, card.firstBoard].join(' ');
  if (/reading|evidence|poem|word_context|map|graph|climate|image|ray/.test(id) || /证据|图|光线|地图|气候|意象/.test(text)) return 'visual_evidence';
  if (/equation|ratio|calculation|chem_equation|variable|grammar|sentence|genetics/.test(id) || /变量|方程|句子|结构|守恒|计算/.test(text)) return 'symbol_rule';
  if (/experiment|reaction|process|ecology|force|circuit|motion/.test(id) || /过程|反应|路径|方向|系统/.test(text)) return 'process_chain';
  return 'first_step_entry';
}

function inferMiniLessonDistractor(card = {}) {
  const text = [card.id, card.conceptGap, card.microScript, card.checkPrompt].join(' ');
  if (/答案|answer|公式|formula|计算/.test(text)) return 'jump_to_answer_or_formula';
  if (/证据|evidence|原文|条件/.test(text)) return 'evidence_not_named';
  if (/方向|路径|过程|变量|关系/.test(text)) return 'relation_or_direction_confused';
  return 'first_step_too_vague';
}

function enrichMiniLessonTopicCard(card = {}) {
  const clusterId = card.clusterId || inferMiniLessonCluster(card);
  const distractorType = card.distractorType || inferMiniLessonDistractor(card);
  return Object.assign({}, card, {
    clusterId,
    distractorType,
    exitEvidence: card.exitEvidence || [
      'child_says_first_step',
      'child_names_wrong_cause',
      'parent_can_check_without_answer',
      'next_day_revisit_card'
    ],
    nearTransferType: card.nearTransferType || (clusterId === 'visual_evidence' ? 'swap_visual_or_text' : clusterId === 'symbol_rule' ? 'swap_number_or_symbol' : 'swap_condition_or_context'),
    releaseGate: card.releaseGate || 'first_step_wrong_cause_parent_check_before_practice'
  });
}

MINI_LESSON_TOPIC_CARDS.forEach((card, index) => {
  MINI_LESSON_TOPIC_CARDS[index] = enrichMiniLessonTopicCard(card);
});

function safeText(value, fallback, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const result = text || fallback || '';
  return max && result.length > max ? `${result.slice(0, max)}...` : result;
}

function buildOutline(input = {}) {
  const signal = input.pressureSignal || {};
  const taskType = safeText(input.taskType || signal.taskType, 'unknown');
  const firstStep = safeText(signal.firstStep || input.firstStep, '先让孩子说出第一步。', 80);
  const wrongCause = safeText(signal.wrongCause || input.wrongCause, '证据不足，先观察第一步是否能说清。', 80);
  const parentCheck = safeText(signal.parentCheck || input.parentCheck, '你先说第一步，不用算完整题。', 80);
  const revisit = safeText(signal.reviewMove || input.revisit, '明天换一个数字或材料，只复查第一步入口。', 80);
  return {
    id: 'tonight_outline',
    stage: 'outline_generation',
    taskType,
    issue: wrongCause,
    learningGoal: firstStep,
    firstStep,
    parentCheck,
    revisit,
    sourceBoundary: SAFE_SHARE_BOUNDARY,
    evidenceRequired: [
      'child_first_step',
      'wrong_cause_named',
      'parent_receipt',
      'next_day_revisit'
    ]
  };
}

function buildScenes(outline = {}) {
  return [
    {
      id: 'socratic_probe',
      type: 'one_question',
      label: '追问',
      action: outline.parentCheck,
      passEvidence: 'child_first_step'
    },
    {
      id: 'first_step_blackboard',
      type: 'visual_entry',
      label: '小黑板',
      action: `只画入口关系：${outline.firstStep}`,
      passEvidence: 'board_entry_not_full_solution'
    },
    {
      id: 'active_recall_card',
      type: 'active_recall',
      label: '回忆卡',
      action: '遮住答案，只让孩子复述第一步和错因。',
      passEvidence: 'recall_without_answer'
    },
    {
      id: 'micro_game',
      type: 'game_loop',
      label: '轻游戏',
      action: '只奖励回忆动作、复访完成和错因修复，不奖励速度和分数。',
      passEvidence: 'local_reward_gate'
    },
    {
      id: 'parent_receipt',
      type: 'parent_check',
      label: '家长回执',
      action: outline.parentCheck,
      passEvidence: 'parent_receipt'
    },
    {
      id: 'safe_share',
      type: 'share_loop',
      label: '安全分享',
      action: SAFE_SHARE_BOUNDARY,
      passEvidence: 'share_safe_redaction'
    }
  ];
}

function buildEventFlow(outline = {}, scenes = []) {
  return scenes.map((scene, index) => ({
    order: index + 1,
    event: scene.id,
    actor: scene.id === 'parent_receipt' ? 'parent' : scene.id === 'safe_share' ? 'system' : 'child',
    localGate: scene.passEvidence,
    nextRoute: scene.id === 'micro_game'
      ? '/pages/arcade/arcade?from=openmaic_task_plan'
      : scene.id === 'parent_receipt'
        ? '/pages/profile/profile?from=openmaic_task_plan'
        : '/pages/review/review?from=openmaic_task_plan',
    reportLine: `${scene.label}：${scene.action}`
  }));
}

function buildLocalAiBoundary() {
  return {
    id: 'openmaic_inspired_local_ai_boundary',
    localCodeOwns: [
      'task_type',
      'source_license_gate',
      'answer_visibility_gate',
      'reward_release',
      'mastery_claim',
      'report_release',
      'share_privacy_fields',
      'revisit_schedule'
    ],
    aiBetterFor: [
      'child_friendly_socratic_wording',
      'parent_readable_explanation',
      'alternate_hint_phrasing',
      'private_report_language_after_redaction'
    ],
    aiMustNotDecide: [
      'final_answer',
      'talent_label',
      'score_prediction',
      'ranking',
      'reward_release',
      'share_fields',
      'mastery_claim'
    ],
    offlineFallback: 'AI 不可用时，本地仍能生成任务单、第一步、小黑板、家长检查句和复访卡。'
  };
}

function buildSourceUseDecision(input = {}) {
  const sourceType = input.sourceType || input.sourceSchemaId || 'openmaic_public_reference';
  return {
    id: 'mini_lesson_source_use_decision',
    sourceType,
    decision: 'structure_only_clean_room_rewrite',
    allowedUses: [
      'workflow_reference',
      'local_topic_card_selection',
      'visual_template_selection',
      'socratic_wording_after_redaction',
      'parent_summary_after_redaction'
    ],
    localCodeOwns: [
      'trigger',
      'topic_card',
      'first_step_board',
      'exit_gate',
      'reward_release',
      'share_fields',
      'report_release',
      'talent_report_release'
    ],
    aiAllowedToRewrite: [
      'hint_wording',
      'teacher_line',
      'misconception_line',
      'parent_summary'
    ],
    blockedUses: [
      'copy_openmaic_code',
      'copy_public_source_text',
      'full_answer',
      'talent_label',
      'ranking',
      'score_prediction',
      'mastery_claim',
      'share_original_question'
    ],
    releaseGate: 'local_code_before_ai_output',
    reportLine: '只借鉴课堂编排和公开资料结构；题文、答案、画像、奖励和分享字段均由本地规则拦截。'
  };
}

function buildQualityGate(outline = {}, scenes = []) {
  const sceneIds = scenes.map((item) => item.id);
  return {
    id: 'openmaic_inspired_quality_gate',
    status: outline.firstStep && sceneIds.includes('parent_receipt') && sceneIds.includes('safe_share') ? 'ready' : 'blocked',
    gates: [
      { id: 'two_stage_plan', ok: outline.stage === 'outline_generation' && scenes.length >= 5 },
      { id: 'no_full_answer', ok: true },
      { id: 'source_boundary', ok: outline.sourceBoundary === SAFE_SHARE_BOUNDARY },
      { id: 'parent_receipt', ok: sceneIds.includes('parent_receipt') },
      { id: 'safe_share', ok: sceneIds.includes('safe_share') },
      { id: 'revisit', ok: Boolean(outline.revisit) }
    ],
    releaseRule: '全部门槛为 true，才允许进入报告、奖励和分享；任一门槛失败，只保留第一步追问。',
    reportLine: '这不是完整 AI 课堂，而是今晚任务单：先说第一步，再修错因，再由家长回执和明天回访放行。'
  };
}

function pickMiniLessonVisualTemplate(input = {}) {
  const text = [
    input.subject,
    input.taskType,
    input.sourceText,
    input.firstStep,
    input.wrongCause
  ].join(' ');
  return MINI_LESSON_VISUAL_TEMPLATES.find((item) => item.match.test(text)) || {
    subject: 'general',
    boardMove: '画第一步入口：题目问什么 -> 已知什么 -> 先做哪一步',
    conceptLens: '第一步入口',
    boardLayers: ['圈题目问什么', '找一个已知条件', '说出第一步动作'],
    misconception: '想直接完成整题，没有先交出一个可检查的第一步。',
    checkQuestion: '你能只说第一步，不说完整答案吗？',
    parentLine: '你先说题目问什么，以及第一步准备做什么。',
    nearTransfer: '换一个相似材料，只复述题目问什么和第一步。'
  };
}

function pickMiniLessonTopicCard(input = {}, visualTemplate = {}) {
  const text = [
    input.subject,
    input.taskType,
    input.sourceText,
    input.firstStep,
    input.wrongCause,
    visualTemplate.subject,
    visualTemplate.conceptLens
  ].join(' ');
  const picked = MINI_LESSON_TOPIC_CARDS.find((item) => item.match.test(text))
    || MINI_LESSON_TOPIC_CARDS.find((item) => item.subject === visualTemplate.subject);
  if (picked) return enrichMiniLessonTopicCard(picked);
  return enrichMiniLessonTopicCard({
      id: 'general_first_step',
      subject: 'general',
      label: '通用卡点：先说第一步',
      conceptGap: visualTemplate.conceptLens || '第一步入口不清',
      firstBoard: visualTemplate.boardMove || '题目问什么 -> 已知什么 -> 先做哪一步',
      microScript: '先交出一个可检查的第一步，不追完整答案。',
      checkPrompt: visualTemplate.checkQuestion || '你能只说第一步吗？',
      parentObserve: visualTemplate.parentLine || '家长只问第一步，不讲完整解法。',
      nextDayCard: visualTemplate.nearTransfer || '明天换材料，只复查第一步。',
      localGate: 'child_says_first_step_before_solution'
    });
}

function buildMiniLessonBoardFrames(visualTemplate = {}, topicCard = {}, outline = {}) {
  const layers = Array.isArray(visualTemplate.boardLayers) ? visualTemplate.boardLayers : [];
  const steps = (topicCard.firstBoard || visualTemplate.boardMove || outline.firstStep || '题目问什么 -> 已知什么 -> 先做哪一步')
    .split(/->|→|：|:/)
    .map((item) => item.trim())
    .filter(Boolean);
  const primitiveRenderContract = buildMiniLessonVisualPrimitiveContract(
    Array.isArray(visualTemplate.visualPrimitives) ? visualTemplate.visualPrimitives : []
  );
  const frameTexts = [
    layers[0] || steps[0] || '圈题目问什么',
    layers[1] || steps[1] || '找一个已知条件',
    layers[2] || steps[2] || '说出第一步动作'
  ];
  return frameTexts.map((text, index) => {
    const primitive = primitiveRenderContract[index] || primitiveRenderContract[primitiveRenderContract.length - 1] || {};
    return {
      id: `frame_${index + 1}`,
      title: `板书第 ${index + 1} 帧`,
      draw: text,
      say: index === 0
        ? '先圈住题目问什么'
        : index === 1
          ? '再找一个已知条件'
          : '最后只说第一步，不说完整答案',
      primitiveId: primitive.id || '',
      primitiveLabel: primitive.renderRole || '',
      primitiveClass: primitive.wxClass || '',
      renderInstruction: primitive.childAction || '',
      primitiveOwner: primitive.owner || 'local_code',
      evidence: index === 0
        ? 'child_reads_task'
        : index === 1
          ? 'board_entry_not_full_solution'
          : 'child_first_step_or_wrong_cause',
      localGate: index === 2
        ? (topicCard.localGate || 'child_can_say_first_step')
        : 'board_layer_visible'
    };
  });
}

function buildMiniLessonTrigger(input = {}) {
  const userTurnCount = Number(input.userTurnCount || 0);
  const stillBlockedCount = Number(input.stillBlockedCount || 0);
  const hintLevel = Number(input.hintLevel || 1);
  const hasChildFirstStep = Boolean(input.hasChildFirstStep);
  const answerRisk = Boolean(input.answerRisk);
  const repeatedBlocked = stillBlockedCount >= 2;
  const highHintStillBlocked = hintLevel >= 4 && stillBlockedCount >= 1 && !hasChildFirstStep;
  const noFirstStepAfterDialog = userTurnCount >= 3 && !hasChildFirstStep;
  const answerRiskAfterRecovery = answerRisk && (stillBlockedCount >= 2 || userTurnCount >= 2 || hintLevel >= 4);
  const shouldTrigger = Boolean(
    input.forceMiniLesson
    || answerRiskAfterRecovery
    || repeatedBlocked
    || highHintStillBlocked
    || noFirstStepAfterDialog
  );
  return {
    id: 'mini_lesson_trigger',
    mode: shouldTrigger ? 'mini_lesson' : 'socratic_first',
    shouldTrigger,
    triggerEvidence: {
      userTurnCount,
      stillBlockedCount,
      hintLevel,
      hasChildFirstStep,
      answerRisk,
      answerRiskAfterRecovery,
      repeatedBlocked,
      highHintStillBlocked,
      noFirstStepAfterDialog
    },
    reason: shouldTrigger
      ? '孩子还说不出第一步时，才切入 3 分钟小讲堂。'
      : '继续保持苏格拉底追问，不提前上完整课堂。',
    blockedMode: 'full_ai_classroom',
    releaseCondition: '孩子能用自己的话说出第一步，才回到练习、报告或分享。'
  };
}

function buildPrivateTutorModeRouter(input = {}, miniLesson = {}) {
  const trigger = miniLesson.trigger || buildMiniLessonTrigger(input);
  const hasChildFirstStep = Boolean(input.hasChildFirstStep || input.childFirstStep || input.childExitTicketText);
  const exitPassed = input.exitGateStatus === 'passed' || Boolean(input.exitPassed);
  const needsParentSupport = input.exitGateStatus === 'needs_support'
    || input.parentSupportNeeded === true
    || (trigger.shouldTrigger && Number(input.stillBlockedCount || 0) >= 3 && !hasChildFirstStep);
  const nextMode = needsParentSupport
    ? 'parent_handoff'
    : exitPassed
      ? 'game_recall'
      : trigger.shouldTrigger
        ? 'three_minute_mini_lesson'
        : 'socratic_private_tutor';
  const routeByMode = {
    socratic_private_tutor: '/pages/tutor/tutor?from=private_tutor_router',
    three_minute_mini_lesson: '/pages/tutor/tutor?from=mini_lesson_router',
    game_recall: '/pages/arcade/arcade?from=mini_lesson_exit_passed',
    parent_handoff: '/pages/profile/profile?from=mini_lesson_parent_handoff'
  };
  const reasonByMode = {
    socratic_private_tutor: '孩子还在正常追问区间，继续苏格拉底 1 对 1，不提前上课。',
    three_minute_mini_lesson: '孩子连续卡住或有答案捷径风险，只补一个概念缺口和三帧小黑板。',
    game_recall: '孩子已经写出退出票据，进入轻复练巩固第一步和错因。',
    parent_handoff: '孩子仍说不出第一步，降级为家长一句低压检查和明天回访。'
  };
  return {
    id: 'private_tutor_mode_router',
    positioning: '家庭晚间作业的苏格拉底式私教补位，不提供孩子自由选择的 AI 课堂模式。',
    childSelectableMode: false,
    nextMode,
    route: routeByMode[nextMode],
    reason: reasonByMode[nextMode],
    triggerEvidence: trigger.triggerEvidence || {},
    releaseGate: nextMode === 'three_minute_mini_lesson'
      ? 'child_exit_ticket_required_before_game_or_share'
      : nextMode === 'game_recall'
        ? 'child_can_say_first_step_in_own_words'
        : nextMode === 'parent_handoff'
          ? 'parent_confirms_one_question_and_next_day_revisit'
          : 'socratic_progress_not_yet_stuck',
    allowedNextModes: ['socratic_private_tutor', 'three_minute_mini_lesson', 'game_recall', 'parent_handoff'],
    blockedModes: ['full_ai_classroom', 'free_classroom_mode_picker', 'answer_reveal_mode', 'score_ranking_competition'],
    localCodeOwns: ['mode_route', 'trigger_threshold', 'exit_gate', 'parent_handoff', 'game_unlock', 'share_fields'],
    aiMayHelp: ['teacher_line', 'misconception_line', 'child_friendly_rephrase', 'parent_readable_summary'],
    aiMustNotOwn: ['mode_release', 'final_answer', 'full_solution', 'talent_label', 'score', 'ranking']
  };
}

function buildMiniLessonRecoveryBranches(visualTemplate = {}, topicCard = {}, outline = {}) {
  const localGate = topicCard.localGate || 'child_can_say_first_step';
  return [
    {
      id: 'child_silent',
      trigger: '孩子 20 秒仍说不出第一步',
      localAction: '降到只圈题目问什么，不继续讲完整过程',
      aiMaySay: `我们先只找入口：${visualTemplate.conceptLens || '第一步入口'}。`,
      requiredEvidence: 'child_points_to_task_target',
      nextRoute: '/pages/profile/profile?from=mini_lesson_parent_handoff'
    },
    {
      id: 'asks_for_answer',
      trigger: '孩子直接要答案或要求代写',
      localAction: '拦截最终答案，只保留第一步小黑板和错因复述',
      aiMaySay: '我不能替你写答案，但可以陪你说出第一步。',
      requiredEvidence: localGate,
      nextRoute: '/pages/tutor/tutor?from=mini_lesson_answer_blocked'
    },
    {
      id: 'wrong_axis',
      trigger: '孩子说出的第一步和题型轴不一致',
      localAction: '回到题型卡，要求说清对象/条件/证据/关系中的一个',
      aiMaySay: `这一步可能跑偏了，先回到：${topicCard.conceptGap || outline.issue || '概念缺口'}。`,
      requiredEvidence: 'wrong_cause_named_before_retry',
      nextRoute: '/pages/review/review?from=mini_lesson_wrong_axis'
    },
    {
      id: 'transfer_failed',
      trigger: '近迁移题仍然失败',
      localAction: '锁定第 7 天迁移，不更新长期画像，不发放高额 XP',
      aiMaySay: '这说明还没稳，明天只复查同一个入口。',
      requiredEvidence: 'day7_variant_first_step_evidence',
      nextRoute: '/pages/review/review?from=mini_lesson_transfer_failed'
    }
  ];
}

function buildMiniLessonExecutionContract(visualTemplate = {}, topicCard = {}, outline = {}) {
  const primitives = Array.isArray(visualTemplate.visualPrimitives) && visualTemplate.visualPrimitives.length
    ? visualTemplate.visualPrimitives
    : ['circle_target', 'mark_known', 'draw_relation_or_direction', 'say_first_step'];
  const primitiveRenderContract = buildMiniLessonVisualPrimitiveContract(primitives);
  return {
    id: 'mini_lesson_execution_contract',
    positioning: '小讲堂只在苏格拉底连续卡住后补位，不提供可选课堂模式。',
    localCodeOwns: [
      'trigger',
      'topic_card_selection',
      'visual_schema',
      'exit_gate',
      'review_seed',
      'xp_release',
      'share_blocked_fields',
      'portrait_release_gate'
    ],
    aiMayRewrite: [
      'teacher_line',
      'misconception_classmate_line',
      'parent_readable_summary',
      'child_friendly_prompt'
    ],
    aiMustNotDecide: [
      'final_answer',
      'full_solution',
      'mastery_claim',
      'talent_label',
      'score',
      'ranking',
      'share_fields',
      'portrait_update'
    ],
    visualSchema: {
      subject: topicCard.subject || visualTemplate.subject || 'general',
      lens: visualTemplate.conceptLens || topicCard.conceptGap || outline.issue || 'first_step',
      primitives,
      primitiveRenderContract,
      renderContractReady: primitiveRenderContract.length === primitives.length,
      noFullSolution: true,
      noRawQuestionExport: true
    },
    releaseGates: [
      'child_can_say_first_step_in_own_words',
      'wrong_cause_named',
      'next_day_revisit_locked',
      'day7_variant_first_step_evidence'
    ],
    reportRule: '报告只能说方法候选和下一步证据，不说天赋定论、排名、完整答案或永久画像。',
    shareRule: SAFE_SHARE_BOUNDARY
  };
}

function buildThreeMinuteMiniLesson(input = {}) {
  const outline = input.outline || buildOutline(input);
  const visualTemplate = pickMiniLessonVisualTemplate({
    subject: input.subject,
    taskType: outline.taskType,
    sourceText: input.sourceText,
    firstStep: outline.firstStep,
    wrongCause: outline.issue
  });
  const topicCard = pickMiniLessonTopicCard({
    subject: input.subject,
    taskType: outline.taskType,
    sourceText: input.sourceText,
    firstStep: outline.firstStep,
    wrongCause: outline.issue
  }, visualTemplate);
  const trigger = buildMiniLessonTrigger(input);
  const aiTeacherLine = safeText(
    input.aiTeacherLine,
    `先不讲完整解法，只看「${visualTemplate.conceptLens}」：${outline.firstStep}`,
    120
  );
  const aiClassmateMisconception = safeText(
    input.aiClassmateMisconception,
    `我可能会急着算答案，但其实还没说清：${outline.issue}`,
    120
  );
  const boardFrames = buildMiniLessonBoardFrames(visualTemplate, topicCard, outline);
  const recoveryBranches = buildMiniLessonRecoveryBranches(visualTemplate, topicCard, outline);
  const executionContract = buildMiniLessonExecutionContract(visualTemplate, topicCard, outline);
  const primitiveRenderContract = executionContract.visualSchema.primitiveRenderContract || [];
  const modeRouter = buildPrivateTutorModeRouter(input, { trigger });
  const renderGate = {
    id: 'mini_lesson_render_gate',
    canRender: trigger.shouldTrigger === true && modeRouter.nextMode === 'three_minute_mini_lesson',
    routerMode: modeRouter.nextMode,
    blockedWhen: ['parent_handoff', 'socratic_private_tutor', 'game_recall'],
    requiredMode: 'three_minute_mini_lesson',
    localCodeOwns: ['panel_visibility', 'review_seed_release', 'exit_gate_actions']
  };
  return {
    id: 'three_minute_mini_lesson',
    title: '3 分钟小讲堂',
    positioning: '只在苏格拉底点拨连续卡住时补位；不是 AI 课堂平台，不生成完整课程。',
    trigger,
    modeRouter,
    renderGate,
    conceptGap: visualTemplate.conceptLens,
    topicCard,
    topicTrack: {
      id: topicCard.id,
      subject: topicCard.subject,
      label: topicCard.label,
      conceptGap: topicCard.conceptGap,
      firstBoard: topicCard.firstBoard,
      localGate: topicCard.localGate,
      clusterId: topicCard.clusterId,
      distractorType: topicCard.distractorType,
      nearTransferType: topicCard.nearTransferType,
      exitEvidence: topicCard.exitEvidence,
      sourcePolicy: 'local_rewrite_from_public_pattern_no_raw_question'
    },
    blackboard: {
      title: '第一步小黑板',
      boardMove: topicCard.firstBoard || visualTemplate.boardMove,
      layers: (visualTemplate.boardLayers || []).concat([topicCard.firstBoard]).filter(Boolean).slice(0, 4),
      firstStep: outline.firstStep,
      frames: boardFrames,
      primitiveRenderContract,
      renderPrompt: '按帧画：圈题目问什么 -> 找一个已知条件 -> 只说第一步动作',
      noFullSolution: true
    },
    executionContract,
    recoveryBranches,
    roles: [
      { id: 'socratic_teacher', label: '苏格拉底老师', line: aiTeacherLine, aiUse: '把本地第一步改写成孩子听得懂的一句话' },
      { id: 'misconception_classmate', label: '误区同学', line: aiClassmateMisconception, aiUse: '暴露常见误区，促使孩子辨析' },
      { id: 'parent_observer', label: '家长观察者', line: outline.parentCheck, aiUse: '把检查句改写成低压话术' }
    ],
    misconception: visualTemplate.misconception || '',
    checkQuestion: topicCard.checkPrompt || visualTemplate.checkQuestion || '',
    parentLine: topicCard.parentObserve || visualTemplate.parentLine || outline.parentCheck,
    nearTransfer: {
      prompt: topicCard.nextDayCard || visualTemplate.nearTransfer,
      gate: '只检查第一步和错因，不检查最终答案。'
    },
    topicPractice: {
      prompt: topicCard.nextDayCard || visualTemplate.nearTransfer,
      checkPrompt: topicCard.checkPrompt || visualTemplate.checkQuestion,
      localGate: topicCard.localGate || 'child_can_say_first_step',
      rewardPolicy: 'only_reward_first_step_wrong_cause_and_revisit_not_speed_or_final_answer'
    },
    teacherSchoolBridge: {
      teacherObserve: `请老师只观察：孩子是否能完成「${topicCard.localGate || '第一步'}」这一项，不把单次表现当作天赋结论。`,
      parentObserve: topicCard.parentObserve || visualTemplate.parentLine || outline.parentCheck,
      blockedClaims: ['天赋定论', '排名', '分数预测', '完整答案外传']
    },
    minutePlan: [
      { minute: 1, action: boardFrames[0] ? boardFrames[0].draw : '圈题目问什么', evidence: boardFrames[0] ? boardFrames[0].evidence : 'child_reads_task' },
      { minute: 2, action: boardFrames[1] ? boardFrames[1].draw : '画第一步入口', evidence: boardFrames[1] ? boardFrames[1].evidence : 'board_entry_not_full_solution' },
      { minute: 3, action: boardFrames[2] ? boardFrames[2].draw : (visualTemplate.checkQuestion || '孩子只说第一步'), evidence: boardFrames[2] ? boardFrames[2].evidence : 'child_first_step_or_wrong_cause' }
    ],
    parentCheck: outline.parentCheck,
    nextDayReview: outline.revisit,
    exitGate: {
      passEvidence: 'child_can_say_first_step_in_own_words',
      passRoute: '/pages/review/review?from=mini_lesson_exit',
      failRoute: '/pages/profile/profile?from=mini_lesson_parent_handoff',
      failAction: '降级为家长只问一句和明天回访，不继续加课。'
    },
    localAiBoundary: {
      localCodeOwns: executionContract.localCodeOwns,
      aiBetterFor: executionContract.aiMayRewrite,
      aiMustNotDecide: executionContract.aiMustNotDecide,
      boardFrames
    },
    qualityGate: [
      { id: 'not_default_mode', ok: trigger.shouldTrigger === true || trigger.mode === 'socratic_first' },
      { id: 'no_full_classroom', ok: true },
      { id: 'has_blackboard_first_step', ok: Boolean((topicCard.firstBoard || visualTemplate.boardMove) && outline.firstStep) },
      { id: 'has_topic_card', ok: Boolean(topicCard.id && topicCard.localGate && topicCard.nextDayCard) },
      { id: 'has_misconception_role', ok: true },
      { id: 'has_near_transfer', ok: Boolean(visualTemplate.nearTransfer) },
      { id: 'has_parent_and_review', ok: Boolean(outline.parentCheck && outline.revisit) },
      { id: 'has_recovery_branches', ok: recoveryBranches.length >= 4 && recoveryBranches.every((item) => item.requiredEvidence && item.nextRoute) },
      { id: 'has_execution_contract', ok: executionContract.localCodeOwns.includes('portrait_release_gate') && executionContract.aiMustNotDecide.includes('portrait_update') },
      { id: 'has_private_tutor_router', ok: modeRouter.childSelectableMode === false && modeRouter.blockedModes.includes('full_ai_classroom') && modeRouter.localCodeOwns.includes('mode_route') },
      { id: 'exit_before_reward_or_share', ok: true }
    ],
    shareBoundary: SAFE_SHARE_BOUNDARY
  };
}

function evaluateThreeMinuteMiniLesson(miniLesson = {}) {
  const localOwns = miniLesson.localAiBoundary && Array.isArray(miniLesson.localAiBoundary.localCodeOwns)
    ? miniLesson.localAiBoundary.localCodeOwns
    : [];
  const aiMustNotDecide = miniLesson.localAiBoundary && Array.isArray(miniLesson.localAiBoundary.aiMustNotDecide)
    ? miniLesson.localAiBoundary.aiMustNotDecide
    : [];
  const gates = Array.isArray(miniLesson.qualityGate) ? miniLesson.qualityGate : [];
  return {
    ok: Boolean(
      miniLesson.id === 'three_minute_mini_lesson'
      && miniLesson.trigger
      && miniLesson.trigger.blockedMode === 'full_ai_classroom'
      && miniLesson.blackboard
      && miniLesson.blackboard.noFullSolution === true
      && miniLesson.topicCard
      && miniLesson.topicCard.clusterId
      && miniLesson.topicCard.distractorType
      && Array.isArray(miniLesson.topicCard.exitEvidence)
      && miniLesson.topicCard.exitEvidence.length >= 4
      && miniLesson.topicPractice
      && miniLesson.teacherSchoolBridge
      && miniLesson.nearTransfer
      && miniLesson.exitGate
      && miniLesson.modeRouter
      && miniLesson.modeRouter.childSelectableMode === false
      && Array.isArray(miniLesson.modeRouter.blockedModes)
      && miniLesson.modeRouter.blockedModes.includes('free_classroom_mode_picker')
      && localOwns.includes('trigger')
      && localOwns.includes('exit_gate')
      && aiMustNotDecide.includes('final_answer')
      && aiMustNotDecide.includes('talent_label')
      && gates.every((item) => item.ok === true)
    ),
    gateCount: gates.length,
    triggerMode: miniLesson.trigger ? miniLesson.trigger.mode : 'missing',
    conceptGap: miniLesson.conceptGap || '',
    topicCardId: miniLesson.topicCard ? miniLesson.topicCard.id : '',
    topicSubject: miniLesson.topicCard ? miniLesson.topicCard.subject : '',
    topicClusterId: miniLesson.topicCard ? miniLesson.topicCard.clusterId : '',
    topicDistractorType: miniLesson.topicCard ? miniLesson.topicCard.distractorType : '',
    blockedMode: miniLesson.trigger ? miniLesson.trigger.blockedMode : '',
    routerMode: miniLesson.modeRouter ? miniLesson.modeRouter.nextMode : 'missing'
  };
}

function buildEvidenceThread(input = {}) {
  const miniLesson = input.miniLesson || {};
  const topicCard = input.topicCard || miniLesson.topicCard || {};
  const outline = input.outline || {};
  const taskType = input.taskType || outline.taskType || topicCard.id || '';
  const subject = input.subject || topicCard.subject || miniLesson.topicSubject || '';
  const firstStep = input.firstStep || outline.firstStep || (miniLesson.blackboard && miniLesson.blackboard.firstStep) || '';
  const wrongCause = input.wrongCause || outline.issue || miniLesson.conceptGap || '';
  const parentCheck = input.parentCheck || outline.parentCheck || miniLesson.parentLine || '';
  const day7Gate = input.day7Gate || 'day7_variant_first_step_evidence';
  return {
    id: input.id || `evidence_thread_${topicCard.id || taskType || 'first_step'}`,
    sourceSchemaId: input.sourceSchemaId || topicCard.id || 'local_homework_task',
    flowTraceId: input.flowTraceId || '',
    taskType,
    subject,
    topicCardId: topicCard.id || input.topicCardId || '',
    topicLabel: topicCard.label || input.topicLabel || '',
    firstStep,
    wrongCause,
    parentCheck,
    nextDayReview: input.nextDayReview || outline.revisit || (miniLesson.nearTransfer && miniLesson.nearTransfer.prompt) || '',
    day7Gate,
    releaseGates: ['child_can_say_first_step', 'wrong_cause_named', 'next_day_revisit_locked', day7Gate],
    routes: {
      tutor: '/pages/tutor/tutor',
      review: '/pages/review/review',
      arcade: '/pages/arcade/arcade',
      profile: '/pages/profile/profile'
    },
    localCodeOwns: ['sourceSchemaId', 'taskType', 'topicCardId', 'releaseGates', 'shareFields', 'rewardRelease'],
    aiMayRewrite: ['teacherLine', 'classmateMisconception', 'parentReadableSummary'],
    aiMustNotOwn: ['final_answer', 'mastery_claim', 'talent_label', 'score', 'ranking'],
    shareSafeFields: ['topicCardId', 'firstStep', 'wrongCause', 'parentCheck', 'nextDayReview'],
    blockedFields: ['original_question', 'photo', 'full_answer', 'full_solution', 'full_dialogue', 'score', 'ranking', 'talent_label'].concat(IDENTITY_CONTACT_BLOCKED_FIELDS)
  };
}

function buildOpenMaicInspiredTaskPlan(input = {}) {
  const outline = buildOutline(input);
  const scenes = buildScenes(outline);
  const eventFlow = buildEventFlow(outline, scenes);
  const qualityGate = buildQualityGate(outline, scenes);
  const miniLesson = buildThreeMinuteMiniLesson(Object.assign({}, input, { outline }));
  const miniLessonAudit = evaluateThreeMinuteMiniLesson(miniLesson);
  const evidenceThread = buildEvidenceThread(Object.assign({}, input, {
    outline,
    miniLesson,
    topicCard: miniLesson.topicCard
  }));
  return {
    id: 'openmaic_inspired_homework_task_plan',
    title: '今晚任务单',
    sourcePolicy: OPENMAIC_REFERENCE_POLICY,
    outline,
    scenes,
    eventFlow,
    localAiBoundary: buildLocalAiBoundary(),
    qualityGate,
    miniLesson,
    miniLessonAudit,
    evidenceThread,
    publicK12ResourceDecisions: PUBLIC_K12_RESOURCE_DECISIONS,
    reportLine: qualityGate.reportLine,
    shareBoundary: SAFE_SHARE_BOUNDARY,
    commercialDecision: '借鉴 OpenMAIC 的课堂流水线，不做 OpenMAIC 式完整课堂；把能力沉淀在家庭作业闭环、证据账本和复访里。'
  };
}

function evaluateOpenMaicInspiredTaskPlan(plan = {}) {
  const forbidden = plan.sourcePolicy && Array.isArray(plan.sourcePolicy.forbiddenUses)
    ? plan.sourcePolicy.forbiddenUses
    : [];
  const localOwns = plan.localAiBoundary && Array.isArray(plan.localAiBoundary.localCodeOwns)
    ? plan.localAiBoundary.localCodeOwns
    : [];
  const aiMustNotDecide = plan.localAiBoundary && Array.isArray(plan.localAiBoundary.aiMustNotDecide)
    ? plan.localAiBoundary.aiMustNotDecide
    : [];
  const gates = plan.qualityGate && Array.isArray(plan.qualityGate.gates) ? plan.qualityGate.gates : [];
  return {
    ok: Boolean(
      plan.outline
      && Array.isArray(plan.scenes)
      && plan.scenes.length >= 5
      && Array.isArray(plan.eventFlow)
      && plan.eventFlow.length === plan.scenes.length
      && forbidden.includes('copy_openmaic_code')
      && localOwns.includes('reward_release')
      && localOwns.includes('share_privacy_fields')
      && aiMustNotDecide.includes('final_answer')
      && aiMustNotDecide.includes('talent_label')
      && plan.miniLessonAudit
      && plan.miniLessonAudit.ok === true
      && gates.every((item) => item.ok === true)
    ),
    gateCount: gates.length,
    sceneCount: Array.isArray(plan.scenes) ? plan.scenes.length : 0,
    eventCount: Array.isArray(plan.eventFlow) ? plan.eventFlow.length : 0,
    miniLessonGateCount: plan.miniLessonAudit ? plan.miniLessonAudit.gateCount : 0,
    miniLessonTriggerMode: plan.miniLessonAudit ? plan.miniLessonAudit.triggerMode : 'missing',
    blockedFields: aiMustNotDecide,
    sourcePolicy: plan.sourcePolicy ? plan.sourcePolicy.decision : 'missing'
  };
}

function buildOpenMaicInspiredDecisionBridge(plan = {}, reportSummary = {}, reviewSummary = {}, gameEvidence = {}) {
  const outline = plan.outline || {};
  const miniLesson = plan.miniLesson || buildThreeMinuteMiniLesson({ outline });
  const evidenceThread = plan.evidenceThread || buildEvidenceThread({
    outline,
    miniLesson,
    topicCard: miniLesson.topicCard,
    flowTraceId: reportSummary.flowTraceId || reviewSummary.flowTraceId || gameEvidence.flowTraceId || ''
  });
  const reportLine = safeText(
    reportSummary.familyDecisionHomepageHeadline || reportSummary.reportEvidenceTopLine || plan.reportLine,
    '今晚先说第一步，再看错因和明天回访。',
    120
  );
  const nextAction = safeText(
    reportSummary.familyDecisionHomepageNextLocalAction || reviewSummary.nextStep || outline.firstStep,
    outline.firstStep || '先说第一步。',
    120
  );
  const shareBoundary = safeText(
    reportSummary.familyDecisionHomepageShareBoundary || plan.shareBoundary,
    SAFE_SHARE_BOUNDARY,
    120
  );
  const gameLine = safeText(
    gameEvidence.shareLine || gameEvidence.summary || '回忆卡、轻练习和复访放行后再给奖励。',
    '回忆卡、轻练习和复访放行后再给奖励。',
    120
  );
  const evidenceList = [
    outline.firstStep,
    outline.parentCheck,
    outline.revisit,
    miniLesson.conceptGap,
    `质量门${plan.qualityGate && Array.isArray(plan.qualityGate.gates) ? plan.qualityGate.gates.length : 0}项`
  ].filter(Boolean);
  const sourceUseDecision = buildSourceUseDecision({
    sourceType: plan.sourcePolicy ? plan.sourcePolicy.sourceName : '',
    sourceSchemaId: miniLesson.topicCard ? miniLesson.topicCard.id : ''
  });
  const activeRecallRevisitLadder = [
    {
      id: 'tonight_90s_recall',
      label: '今晚 90 秒主动回忆',
      action: miniLesson.topicPractice && miniLesson.topicPractice.checkPrompt
        ? miniLesson.topicPractice.checkPrompt
        : miniLesson.checkQuestion || outline.parentCheck,
      localGate: miniLesson.topicPractice && miniLesson.topicPractice.localGate
        ? miniLesson.topicPractice.localGate
        : 'child_can_say_first_step_in_own_words',
      rewardPolicy: '只奖励第一步、错因复述和回访完成，不奖励速度、排名或最终答案'
    },
    {
      id: 'tomorrow_near_transfer',
      label: '明天换材料回访',
      action: miniLesson.topicPractice && miniLesson.topicPractice.prompt
        ? miniLesson.topicPractice.prompt
        : outline.revisit,
      localGate: 'same_wrong_cause_new_surface',
      rewardPolicy: '只看同错因能不能迁移到新材料'
    },
    {
      id: 'day7_variant',
      label: '第 7 天小变式',
      action: '换题型外壳，只复查概念缺口、第一步入口和家长检查句',
      localGate: 'day7_variant_first_step_evidence',
      rewardPolicy: '连续证据足够才进入画像，不因单次表现下结论'
    }
  ];
  return {
    id: 'openmaic_inspired_decision_bridge',
    title: '家庭决策桥',
    headline: reportLine,
    nextAction,
    shareBoundary,
    gameLine,
    evidenceList,
    reportDecisionLine: `${reportLine}｜${nextAction}`,
    reportDecisionCard: [
      `今晚先做：${nextAction}`,
      `小讲堂触发：${miniLesson.trigger && miniLesson.trigger.reason ? miniLesson.trigger.reason : '只有卡住时才补位'}`,
      `小黑板：${miniLesson.blackboard && miniLesson.blackboard.boardMove ? miniLesson.blackboard.boardMove : '只画第一步入口'}`,
      `退出门：${miniLesson.exitGate && miniLesson.exitGate.passEvidence ? miniLesson.exitGate.passEvidence : '孩子能说第一步'}`,
      `今晚不做：完整答案 / 原题外传 / 单次上传就下结论`,
      `依据：${reportLine}`,
      `回访：${outline.revisit || '明天复查第一步'}`
    ],
    miniLesson,
    evidenceThread,
    sourceUseDecision,
    miniLessonReport: {
      title: '3 分钟小讲堂决策卡',
      triggerLine: miniLesson.trigger ? miniLesson.trigger.reason : '',
      conceptGap: miniLesson.conceptGap || '',
      topicLabel: miniLesson.topicCard ? miniLesson.topicCard.label : '',
      topicLocalGate: miniLesson.topicCard ? miniLesson.topicCard.localGate : '',
      topicPractice: miniLesson.topicPractice || null,
      modeRouter: miniLesson.modeRouter || null,
      activeRecallRevisitLadder,
      blackboardLine: miniLesson.blackboard ? miniLesson.blackboard.boardMove : '',
      blackboardFrames: miniLesson.blackboard && Array.isArray(miniLesson.blackboard.frames) ? miniLesson.blackboard.frames : [],
      blackboardRenderPrompt: miniLesson.blackboard ? miniLesson.blackboard.renderPrompt : '',
      misconceptionLine: miniLesson.misconception || '',
      checkQuestion: miniLesson.checkQuestion || '',
      parentLine: miniLesson.parentLine || miniLesson.parentCheck || '',
      nextDayReview: miniLesson.nextDayReview || outline.revisit || '',
      exitGate: miniLesson.exitGate ? miniLesson.exitGate.passEvidence : '',
      teacherSchoolBridge: miniLesson.teacherSchoolBridge || null,
      sourceUseDecision,
      evidenceThread,
      boundary: miniLesson.positioning || '不是 AI 课堂平台，只是家庭作业第一步补位。'
    },
    homeSchoolMiniLessonPacket: {
      allowedFields: ['concept_gap', 'first_step_board_move', 'parent_check', 'next_day_revisit'],
      blockedFields: OPENMAIC_SAFE_BLOCKED_FIELDS.slice(),
      teacherLine: `可请老师观察：孩子是否能说出 ${miniLesson.conceptGap || '第一步入口'}，而不是只看最终答案。`,
      topicLabel: miniLesson.topicCard ? miniLesson.topicCard.label : '',
      topicLocalGate: miniLesson.topicCard ? miniLesson.topicCard.localGate : '',
      teacherObserve: miniLesson.teacherSchoolBridge ? miniLesson.teacherSchoolBridge.teacherObserve : '',
      modeRouter: miniLesson.modeRouter || null,
      activeRecallRevisitLadder,
      blackboardFrames: miniLesson.blackboard && Array.isArray(miniLesson.blackboard.frames) ? miniLesson.blackboard.frames : [],
      sourceUseDecision,
      evidenceThread,
      parentLine: miniLesson.parentLine || outline.parentCheck || '',
      evidenceRule: '只带概念缺口、第一步动作、家长检查句和次日回访，不带原题、答案、分数或完整对话。'
    },
    gameReturnEvidence: {
      status: 'openmaic_inspired_revisit_gate',
      summary: gameLine,
      nextDayReplay: outline.revisit || '',
      miniLessonExitGate: miniLesson.exitGate ? miniLesson.exitGate.passEvidence : '',
      activeRecallRevisitLadder,
      blackboardFrames: miniLesson.blackboard && Array.isArray(miniLesson.blackboard.frames) ? miniLesson.blackboard.frames : [],
      sourceUseDecision,
      evidenceThread,
      rewardGate: '只奖励第一步、错因修复和回访完成',
      blockedFields: ['final_answer', 'ranking', 'score', 'original_question', 'full_dialogue'].concat(IDENTITY_CONTACT_BLOCKED_FIELDS)
    },
    shareRelayPayload: {
      title: '今晚任务单',
      subtitle: reportLine,
      path: '/pages/profile/profile?from=openmaic_inspired_bridge',
      shareBoundary,
      blockedFields: ['original_question', 'full_answer', 'full_dialogue', 'ranking', 'score'].concat(IDENTITY_CONTACT_BLOCKED_FIELDS),
      nextAction,
      miniLessonConceptGap: miniLesson.conceptGap || '',
      miniLessonTopicLabel: miniLesson.topicCard ? miniLesson.topicCard.label : '',
      miniLessonTopicGate: miniLesson.topicCard ? miniLesson.topicCard.localGate : '',
      miniLessonExitGate: miniLesson.exitGate ? miniLesson.exitGate.passEvidence : '',
      activeRecallRevisitLadder,
      sourceUseDecision,
      evidenceThread,
      evidenceList
    },
    localAiBoundary: plan.localAiBoundary || buildLocalAiBoundary(),
    qualityGate: plan.qualityGate || buildQualityGate(outline, plan.scenes || [])
  };
}

module.exports = {
  SAFE_SHARE_BOUNDARY,
  IDENTITY_CONTACT_BLOCKED_FIELDS,
  OPENMAIC_SAFE_BLOCKED_FIELDS,
  OPENMAIC_REFERENCE_POLICY,
  PUBLIC_K12_RESOURCE_DECISIONS,
  MINI_LESSON_VISUAL_TEMPLATES,
  MINI_LESSON_VISUAL_PRIMITIVE_RENDER_CONTRACT,
  MINI_LESSON_TOPIC_CARDS,
  buildMiniLessonVisualPrimitiveContract,
  buildOpenMaicInspiredTaskPlan,
  evaluateOpenMaicInspiredTaskPlan,
  buildMiniLessonTrigger,
  buildPrivateTutorModeRouter,
  buildThreeMinuteMiniLesson,
  evaluateThreeMinuteMiniLesson,
  buildEvidenceThread,
  buildSourceUseDecision,
  buildOpenMaicInspiredDecisionBridge
};
