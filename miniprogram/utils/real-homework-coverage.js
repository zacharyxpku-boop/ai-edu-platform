let REAL_HOMEWORK_PRESSURE_SAMPLES = [];
let REAL_HOMEWORK_PRESSURE_FIXTURE_LOADED = false;
try {
  REAL_HOMEWORK_PRESSURE_SAMPLES = require('../../scripts/fixtures/real-homework-pressure-samples.cjs').REAL_HOMEWORK_PRESSURE_SAMPLES || [];
  REAL_HOMEWORK_PRESSURE_FIXTURE_LOADED = Array.isArray(REAL_HOMEWORK_PRESSURE_SAMPLES) && REAL_HOMEWORK_PRESSURE_SAMPLES.length > 0;
} catch (error) {
  try {
    REAL_HOMEWORK_PRESSURE_SAMPLES = require('./scripts/fixtures/real-homework-pressure-samples.cjs').REAL_HOMEWORK_PRESSURE_SAMPLES || [];
    REAL_HOMEWORK_PRESSURE_FIXTURE_LOADED = Array.isArray(REAL_HOMEWORK_PRESSURE_SAMPLES) && REAL_HOMEWORK_PRESSURE_SAMPLES.length > 0;
  } catch (nestedError) {
    REAL_HOMEWORK_PRESSURE_SAMPLES = [];
    REAL_HOMEWORK_PRESSURE_FIXTURE_LOADED = false;
  }
}

function displayLabel(value = '') {
  const labels = {
    math_word_problem: '数学应用/建模',
    equation_setup: '方程/不等式建模',
    physics_diagram: '物理图解',
    chemistry_experiment: '化学实验/变化',
    english_sentence: '英语句法/上下文',
    reading_question: '阅读证据',
    biology_process: '生物过程',
    geography_map: '地理图示',
    writing_process: '写作过程'
  };
  return labels[value] || value || '未命名';
}

function countRowsFromSamples(samples = [], field = 'subject', fallbackRows = []) {
  if (!Array.isArray(samples) || !samples.length) return fallbackRows;
  const counts = samples.reduce((acc, sample) => {
    const key = sample && sample[field] ? sample[field] : 'unknown';
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.keys(counts).map((key) => ({
    id: key,
    label: displayLabel(key),
    count: counts[key],
    nextGap: `继续补 ${displayLabel(key)} 的公开题型改写、第一步、小黑板和回访样本。`,
    firstStep: `先识别 ${displayLabel(key)} 的题型入口，再记录第一步、错因和回访。`
  }));
}

const SUBJECT_COUNTS = [
  { id: 'math', label: '数学', count: 79, nextGap: '比例、百分数、比例尺、几何角、函数图像、二次函数顶点、利润折扣方程、全等证明、相似面积比、单位量比较、加权平均、统计抽样、概率、不放回样本空间、移项符号、分段收费、年龄同步时间点继续补跨学科词面误判样本。' },
  { id: 'physics', label: '物理', count: 61, nextGap: '受力、光路、折射法线、电路、串并联电流、浮力密度、压强面积、电路故障、欧姆定律变量控制、杠杆力臂、电功率、热效率、热传递、状态变化和图像题继续补真实卡点。' },
  { id: 'chemistry', label: '化学', count: 63, nextGap: '实验现象、气体验证、溶液质量分数、金属活动性、守恒、微粒观、酸碱指示剂、pH 加液方向、变量控制、开放体系、粗盐提纯、反应速率、溶解度曲线、过滤操作、离子共存和气体检验继续拆错因。' },
  { id: 'english', label: '英语', count: 64, nextGap: '语法信号、现在完成时、比较级、被动语态、介词范围、主谓一致、定语从句、非谓语目的、状语从句 unless、代词指代、完形上下文、转折信号、否定推断、标题题和逻辑连词继续扩样。' },
  { id: 'biology', label: '生物', count: 61, nextGap: '显微镜高低倍、遗传显隐性、生态系统成分、呼吸作用、光合作用变量、人体双循环、血糖调节、反射弧、蒸腾作用、生态角色、能量流动和物质循环继续验证小黑板边界。' },
  { id: 'geography', label: '地理', count: 63, nextGap: '经纬网、等高线河流流向、气候图、气候类型、交通/农业/工业区位、纬度气温、地球自转时差、南北半球季节、季风成因、板块边界、人口迁移继续验证空间和区位误判。' },
  { id: 'chinese', label: '语文', count: 73, nextGap: '阅读概括、记叙文标题线索、议论文论据作用、说明方法作用、词语语境义、古诗意象、修辞赏析、说明语言、说明顺序、文言虚词、句式转换、写作起步、段落中心、关键瞬间细节、选材、语段衔接、结尾照应、病句修改继续压测。' }
];

const TYPE_COUNTS = [
  { id: 'math_word_problem', label: '数学应用/建模', count: 59, firstStep: '先翻译数量关系、比例尺、图形关系、变化基准、统计总量、加权人数、抽样代表性、概率分母、不放回样本空间、比例份数、隐藏单位、单位量、函数坐标、二次函数顶点、全等对应条件或相似维度。' },
  { id: 'equation_setup', label: '方程/不等式建模', count: 20, firstStep: '先设未知数、写等量或不等量关系，或拆利润折扣、浓度、分段收费边界、不等式负数变号规则、移项符号、年龄同步时间点。' },
  { id: 'physics_diagram', label: '物理图解', count: 61, firstStep: '先定对象、方向、单位、路径、串并联分支、力臂、受力面积、电表位置、故障位置、控制变量、法线、功率时间、热量方向、热效率输入输出、浮力决定量、状态变化或决定量。' },
  { id: 'chemistry_experiment', label: '化学实验/变化', count: 63, firstStep: '先列反应物、现象、体系边界、微粒解释、守恒关系、唯一变量、酸碱性质、金属活动性、溶液总质量、pH 起点方向、过滤/提纯条件、同一温度溶解度、离子共存排查和气体检验试剂。' },
  { id: 'english_sentence', label: '英语句法/上下文', count: 50, firstStep: '先找时态、持续时间信号、真正主语、比较、被动、介词范围、先行词、从句成分、非谓语目的、unless 逻辑、否定题干、代词指代或上下文信号。' },
  { id: 'reading_question', label: '阅读证据', count: 63, firstStep: '先判断题目类型，再回文定位证据、标题线索、议论文观点、说明方法作用、意象、词语语境义、修辞本体喻体、说明语言、文言功能、说明顺序、标题中心或推断行为。' },
  { id: 'biology_process', label: '生物过程', count: 61, firstStep: '先分结构、功能、方向、变量、能量流动、物质循环、生态角色、调节路径、显微镜操作、显隐性基因、表现型基因型、光合呼吸条件、人体循环路径、蒸腾路径、生态成分、过程条件或循环路径。' },
  { id: 'geography_map', label: '地理图示', count: 63, firstStep: '先看图例、方向、经纬、纬度热量、半球季节、地球自转方向、海拔、等高线形态、河流高低流向、太阳高度、气候证据、农业/工业区位条件、水汽来源、板块边界、人口迁移推拉力或成因链。' },
  { id: 'writing_process', label: '写作过程', count: 24, firstStep: '先写一句朴素事实、段落中心、一个关键瞬间、一个动作语言心理细节、结尾照应、语段顺序、修改成分残缺或选一个核心材料，不追求完整成文。' }
];

const TASK_TYPE_ALIAS_MAP = {
  reading_inference: 'reading_question',
  argument_reading: 'reading_question',
  english_grammar: 'english_sentence',
  dictation_sentence: 'english_sentence',
  biology_concept: 'biology_process',
  biology_ecology_chain: 'biology_process',
  geography_spatial: 'geography_map',
  geography_region_analysis: 'geography_map',
  physics_graph: 'physics_diagram',
  physics_energy: 'physics_diagram',
  chemistry_equation: 'chemistry_experiment',
  chemistry_reaction: 'chemistry_experiment',
  data_table_reasoning: 'math_word_problem'
};

function normalizeTaskType(taskType = '') {
  const raw = String(taskType || '').trim();
  const lower = raw.toLowerCase();
  return TASK_TYPE_ALIAS_MAP[lower] || lower || raw;
}

const SAMPLE_CLUSTERS = [
  {
    id: 'percent_ratio_inequality',
    label: '比例/百分数/不等式',
    subject: '数学',
    count: 5,
    pressure: '孩子常把折扣当具体金额、把比例当相乘、把不等式当方程、把连续百分数直接相加。',
    firstStep: '先翻译含义和基准：八折是 80%，第二次变化看新的基准，除以负数要变号。',
    boardMove: '小黑板只写关系翻译和基准变化，不直接算答案。',
    parentCheck: '家长只问：这句话到底表示什么关系？第二步的基准是谁？',
    revisit: '明天换数字，只检查关系翻译和基准判断是否稳定。'
  },
  {
    id: 'function_geometry_graph',
    label: '函数图像/几何关系',
    subject: '数学',
    count: 4,
    pressure: '孩子只看终点高低、不看斜率；几何题直接算数，不先认角关系。',
    firstStep: '先比较单位变化量，或先标对顶角、邻补角、平行线角关系。',
    boardMove: '小黑板只画小三角形或角关系标签，不写最终角度。',
    parentCheck: '家长只问：你先看的是什么关系，而不是先算哪个数？',
    revisit: '明天换图像或角的位置，只复述入口关系。'
  },
  {
    id: 'physics_graph_force_electric',
    label: '物理图像/受力/电路/浮力',
    subject: '物理',
    count: 5,
    pressure: '孩子容易看终点不看斜率、看压力不看面积、看亮暗不看电路结构、看物体不看液体。',
    firstStep: '先圈对象、单位、横纵轴、电流路径、液体密度或排开体积。',
    boardMove: '小黑板只画变量关系、路径或决定量，不写最终数值。',
    parentCheck: '家长只问：你先比较哪一个量？路径有没有分叉？决定量是哪两个？',
    revisit: '明天换图像、电路或液体，仍先复述判断入口。'
  },
  {
    id: 'chem_solution_reaction',
    label: '化学现象/溶液/守恒/酸碱图像',
    subject: '化学',
    count: 5,
    pressure: '孩子会背现象但不连物质变化，把水当分母，忽略密闭体系，或不看 pH 起点。',
    firstStep: '先列反应前后、溶质溶剂、体系边界、图像起点和现象证据。',
    boardMove: '小黑板只画“物质 -> 现象 -> 证据”和“起点/方向/经过 7”。',
    parentCheck: '家长只问：现象对应哪种物质变化？有没有物质跑出体系？',
    revisit: '明天换一种盐、容器或酸碱方向，仍先找体系和证据。'
  },
  {
    id: 'language_evidence_start',
    label: '阅读证据/文言语境/写作过程',
    subject: '语文/英语',
    count: 12,
    pressure: '孩子凭感觉选阅读题、按现代词义理解文言、作文想一次写完整，或写作没有中心句、细节和单句修改入口。',
    firstStep: '阅读先找证据句；文言先放回句子；写作先写一句事实、一个中心句或一个动作细节。',
    boardMove: '小黑板只画“题型 -> 证据”“原词 -> 语境”“中心句 -> 例子”或“动作/语言/神态”。',
    parentCheck: '家长只问：原文哪一句支持你？这个意思放回句子通不通？这一段只说明哪一个意思？',
    revisit: '明天换短文、词语或作文题，只检查证据定位、段落中心和一个可见细节。'
  },
  {
    id: 'english_signal_context',
    label: '英语语法信号/完形上下文',
    subject: '英语',
    count: 4,
    pressure: '孩子只看空格所在句，漏掉 than、be done、yesterday、前后文线索。',
    firstStep: '先圈时间词、比较词、承受者、前后句线索，再决定形式。',
    boardMove: '小黑板只写“信号词 -> 结构”或“前句线索 -> 空格 -> 后句验证”。',
    parentCheck: '家长只问：这个形式由哪个词或哪一句支持？',
    revisit: '明天换一个信号词，仍先圈证据再填。'
  },
  {
    id: 'life_geo_spatial',
    label: '生物/地理方向与图示误判',
    subject: '生物/地理',
    count: 7,
    pressure: '孩子按肉眼直觉移动显微镜、混淆经纬线、看地图上下不看海拔、只看最高温不看降水。',
    firstStep: '先判断方向规则、能量流动、显隐性、纬度经度、海拔或峰值月份。',
    boardMove: '小黑板只画方向箭头、规则标签和高低/峰值标记。',
    parentCheck: '家长只问：这个方向规则或图示规则是什么？',
    revisit: '明天换方位、地图、食物链或气候图，只复述规则再判断。'
  }
];

const FALLBACK_PRESSURE_SAMPLE_ATLAS = [
  {
    id: 'runtime_math_word_problem_quantity_relation',
    subject: '数学',
    taskType: 'math_word_problem',
    stem: '应用题先判断总量、已知量、变化基准，再决定列式入口。',
    expectedFirstStep: '先圈出总量、已知量和要求量，说明它们之间是什么关系。',
    expectedWrongCause: '数量关系没有说清就急着算。',
    expectedBoardMove: '小黑板只画总量-部分量-要求量关系，不写最终答案。',
    parentCheck: '家长只问：这三个量分别是谁？先求哪一个关系？',
    nearTransfer: '明天换数字和情境，只复述数量关系入口。'
  },
  {
    id: 'runtime_equation_setup_unknown_relation',
    subject: '数学',
    taskType: 'equation_setup',
    stem: '方程题先设未知数，再写等量或不等量关系。',
    expectedFirstStep: '先设未知数，并用一句话写清等量关系。',
    expectedWrongCause: '未知数和等量关系没有对应。',
    expectedBoardMove: '小黑板只写设 x 和等量关系，不解方程。',
    parentCheck: '家长只问：x 表示谁？等号两边表示同一件事吗？',
    nearTransfer: '明天换条件，只检查设元和等量关系。'
  },
  {
    id: 'runtime_physics_diagram_decision_quantity',
    subject: '物理',
    taskType: 'physics_diagram',
    stem: '物理图示题先定对象、方向、单位和决定量。',
    expectedFirstStep: '先圈对象，再标方向、单位和决定量。',
    expectedWrongCause: '只看现象，没有先定决定量。',
    expectedBoardMove: '小黑板只画对象和决定量箭头，不写最终数值。',
    parentCheck: '家长只问：你先比较哪一个量？方向和单位定了吗？',
    nearTransfer: '明天换图，仍先复述对象、方向和决定量。'
  },
  {
    id: 'runtime_chemistry_experiment_evidence_chain',
    subject: '化学',
    taskType: 'chemistry_experiment',
    stem: '化学实验题先连物质、现象、证据和体系边界。',
    expectedFirstStep: '先列反应前后物质和观察到的现象证据。',
    expectedWrongCause: '会背现象，但没有连到物质变化和体系边界。',
    expectedBoardMove: '小黑板只画物质 -> 现象 -> 证据，不写完整方程式答案。',
    parentCheck: '家长只问：这个现象对应哪种物质变化？有没有物质跑出体系？',
    nearTransfer: '明天换一种试剂，只找体系和证据。'
  },
  {
    id: 'runtime_english_sentence_signal_word',
    subject: '英语',
    taskType: 'english_sentence',
    stem: '英语句法题先找信号词、主语、时间和上下文线索。',
    expectedFirstStep: '先圈时间词、真正主语和前后文信号。',
    expectedWrongCause: '只看空格所在句，没有找支撑信号。',
    expectedBoardMove: '小黑板只写信号词 -> 结构，不直接填答案。',
    parentCheck: '家长只问：这个形式由哪个词或哪一句支持？',
    nearTransfer: '明天换一个信号词，仍先圈证据再填。'
  },
  {
    id: 'runtime_reading_question_evidence_sentence',
    subject: '语文',
    taskType: 'reading_question',
    stem: '阅读题先判断题型，再回原文找证据句。',
    expectedFirstStep: '先判断题型，并定位一处原文证据。',
    expectedWrongCause: '凭感觉回答，没有回文找证据。',
    expectedBoardMove: '小黑板只画题型 -> 证据句 -> 作用，不写完整答案。',
    parentCheck: '家长只问：原文哪一句支持你？',
    nearTransfer: '明天换短文，只检查证据定位。'
  },
  {
    id: 'runtime_writing_process_one_visible_detail',
    subject: '语文',
    taskType: 'writing_process',
    stem: '写作题先写一个事实、中心句或可见细节。',
    expectedFirstStep: '先写一句事实或一个可见动作细节。',
    expectedWrongCause: '想一次写完整文章，导致没有可修改入口。',
    expectedBoardMove: '小黑板只写中心句 -> 例子或动作/语言/神态。',
    parentCheck: '家长只问：这一段只说明哪一个意思？有没有一个看得见的细节？',
    nearTransfer: '明天换题，只补一个中心句和一个细节。'
  },
  {
    id: 'runtime_biology_process_four_slots',
    subject: '生物',
    taskType: 'biology_process',
    stem: '生物过程题先拆结构、条件、过程和结果。',
    expectedFirstStep: '先分清结构、条件、过程和结果四格。',
    expectedWrongCause: '把结构、功能、条件和结果混在一起。',
    expectedBoardMove: '小黑板只画四格过程箭头，不写完整结论。',
    parentCheck: '家长只问：这是结构、条件、过程还是结果？',
    nearTransfer: '明天换一个过程，仍先填四格。'
  },
  {
    id: 'runtime_geography_map_rule_first',
    subject: '地理',
    taskType: 'geography_map',
    stem: '地理图示题先看图例、方向、经纬度和空间规则。',
    expectedFirstStep: '先看图例、方向和经纬度，再判断空间关系。',
    expectedWrongCause: '只看地图上下左右，没有先定空间规则。',
    expectedBoardMove: '小黑板只画方向箭头、图例和高低/纬度标记。',
    parentCheck: '家长只问：这个方向规则或图示规则是什么？',
    nearTransfer: '明天换一张图，先复述规则再判断。'
  }
];

function getRealHomeworkPressureSamples(options = {}) {
  const taskType = normalizeTaskType(options.taskType || '');
  const subject = String(options.subject || '').trim();
  const source = Array.isArray(REAL_HOMEWORK_PRESSURE_SAMPLES) && REAL_HOMEWORK_PRESSURE_SAMPLES.length
    ? REAL_HOMEWORK_PRESSURE_SAMPLES
    : FALLBACK_PRESSURE_SAMPLE_ATLAS;
  if (!taskType && !subject) return source;
  const matched = source.filter((sample) => {
    const taskMatched = !taskType || normalizeTaskType(sample.taskType || '') === taskType;
    const subjectMatched = !subject || sample.subject === subject;
    return taskMatched && subjectMatched;
  });
  return matched;
}

const PUBLIC_K12_SOURCE_LEDGER = [
  {
    id: 'moe_curriculum_standard',
    label: '义务教育课程方案与课程标准',
    sourceType: 'official_public_standard',
    useLevel: 'high_confidence',
    productUse: ['课程骨架', '能力标签', '题型方向', '错因模型'],
    localRuleUse: ['学科分流', '任务类型识别', '第一步入口', '报告能力维度'],
    aiUse: ['把本地规则生成的第一步改写成孩子听得懂的追问'],
    blockedUse: ['直接复制教材正文', '宣称覆盖全教材原题', '生成标准答案库'],
    miniappSurface: ['/pages/tutor/tutor', '/pages/profile/profile'],
    evidenceRequired: ['subject_lane', 'capability_tag', 'first_step_rule', 'no_answer_bank_boundary']
  },
  {
    id: 'smartedu_basic_homework',
    label: '国家中小学智慧教育平台基础性作业方向',
    sourceType: 'official_public_homework_direction',
    useLevel: 'high_confidence',
    productUse: ['作业压力样本', '回访题型', '家长检查话术', '减负边界'],
    localRuleUse: ['真实作业压测样本', '负样本拦截', '回访间隔', '家长侧只看行动建议'],
    aiUse: ['根据错因生成不同语气的苏格拉底追问'],
    blockedUse: ['批量搬运原题', '输出完整题解', '伪装成拍照搜题'],
    miniappSurface: ['/pages/home/home', '/pages/review/review', '/pages/arcade/arcade'],
    evidenceRequired: ['sample_rewrite', 'parent_check', 'revisit_plan', 'shortcut_block']
  },
  {
    id: 'public_exam_archetype',
    label: '公开中考/学业水平考试常见题型',
    sourceType: 'public_exam_archetype',
    useLevel: 'medium_confidence',
    productUse: ['题型簇', '变式迁移', '小黑板图解动作', '跨周趋势'],
    localRuleUse: ['题型路由', '小黑板第一笔', '变式解锁门槛', '错因复现'],
    aiUse: ['解释同一错因在不同题面里的表现'],
    blockedUse: ['原题答案索引', '押题承诺', '考试分数预测'],
    miniappSurface: ['/pages/tutor/tutor', '/pages/radar/radar', '/pages/profile/profile'],
    evidenceRequired: ['question_type_cluster', 'visual_board_move', 'variant_gate', 'exam_score_boundary']
  },
  {
    id: 'family_homework_observation',
    label: '家庭晚间作业真实观察',
    sourceType: 'first_party_observation',
    useLevel: 'highest_confidence_after_consent',
    productUse: ['今晚决策', '长期画像', '家校协同摘要', '分享回流'],
    localRuleUse: ['隐私字段裁剪', '分享可见字段', '家校摘要字段', '奖励发放门槛'],
    aiUse: ['把证据解释成家长能执行的一句话'],
    blockedUse: ['展示完整对话', '展示原题照片', '展示排名分数', '未确认就给诊断标签'],
    miniappSurface: ['/pages/profile/profile', '/pages/home/home'],
    evidenceRequired: ['guardian_safe_field', 'visible_share_field', 'home_school_digest', 'confidence_gate']
  }
];

const PUBLIC_K12_USE_POLICY = {
  id: 'public_k12_use_policy',
  title: '公开 K12 资料使用边界',
  principle: '公开资料只沉淀为题型、能力、错因、第一步、小黑板动作和回访规则；不做答案库，不搬运原题，不承诺全科自动板书。',
  localCodeOwns: [
    '学科与题型路由',
    '错因分类',
    '第一步小黑板动作',
    '回访间隔',
    'XP 和变式解锁',
    '报告释放门槛',
    '分享隐私边界'
  ],
  aiOwns: [
    '苏格拉底追问语气',
    '同一第一步的多种讲法',
    '家长报告解释',
    '孩子卡住后的鼓励与降阶提示'
  ],
  aiBlocked: [
    '直接给最终答案',
    '决定是否分享隐私字段',
    '决定奖励和解锁',
    '宣称拍照识别或全科动态板书',
    '替代老师或家长判断'
  ],
  releaseGate: [
    '每个资料来源必须有 productUse',
    '每个资料来源必须有 blockedUse',
    '每个资料来源必须落到至少一个小程序页面',
    '每个资料来源必须说明哪些归本地规则、哪些归 AI 表达'
  ]
};

const PUBLIC_K12_ASSET_PIPELINE = [
  {
    id: 'curriculum_standard_to_capability_spine',
    sourceFamily: '课程标准/教学目标',
    intakeFields: ['学段', '学科能力词', '核心概念', '过程要求'],
    directUse: ['学科导航骨架', '能力账本维度', '课程单元命名'],
    normalizeAsLocalCode: ['subject_lane', 'capability_axis', 'mastery_gate', 'report_dimension'],
    aiExpressionUse: ['把能力词解释成孩子听得懂的一句追问'],
    discardFields: ['标准正文大段复制', '教材版本专属原文', '标准答案表述'],
    miniappLanding: ['/pages/tutor/tutor', '/pages/profile/profile'],
    acceptanceGate: ['has_subject_lane', 'has_capability_axis', 'no_copied_standard_text'],
    owner: 'local_rule'
  },
  {
    id: 'smartedu_homework_to_pressure_sample',
    sourceFamily: '基础性作业/课堂练习风格',
    intakeFields: ['任务类型', '常见卡点', '第一步入口', '家长检查句'],
    directUse: ['真实作业压力样本', '错因候选', '回访窗口'],
    normalizeAsLocalCode: ['task_type', 'wrong_cause_signal', 'first_step_rule', 'revisit_window'],
    aiExpressionUse: ['把同一错因换成不责备的苏格拉底追问'],
    discardFields: ['原题全文搬运', '完整答案', '题目图片'],
    miniappLanding: ['/pages/home/home', '/pages/tutor/tutor', '/pages/review/review'],
    acceptanceGate: ['sample_rewritten', 'answer_blocked', 'parent_check_present'],
    owner: 'local_rule_plus_ai_wording'
  },
  {
    id: 'public_exam_to_variant_ladder',
    sourceFamily: '公开考试题型/学业水平题型',
    intakeFields: ['题型簇', '干扰项结构', '迁移变量', '图示动作'],
    directUse: ['变式阶梯', '迁移压测', '小黑板第一笔'],
    normalizeAsLocalCode: ['question_type_cluster', 'variant_unlock_gate', 'board_move', 'transfer_ladder'],
    aiExpressionUse: ['解释同一错因为什么会在新题面复发'],
    discardFields: ['押题话术', '分数预测', '原题答案索引'],
    miniappLanding: ['/pages/arcade/arcade', '/pages/radar/radar', '/pages/profile/profile'],
    acceptanceGate: ['variant_gate_local', 'no_exam_score_claim', 'board_move_first_step_only'],
    owner: 'local_rule'
  },
  {
    id: 'family_input_to_evidence_ledger',
    sourceFamily: '家庭一方输入',
    intakeFields: ['孩子第一步原话', '家长观察', '卡住点摘要', '回访结果'],
    directUse: ['今晚决策', '长期证据账本', '家校协同摘要', '分享回流'],
    normalizeAsLocalCode: ['privacy_trim', 'confidence_threshold', 'safe_share_fields', 'home_school_digest'],
    aiExpressionUse: ['把证据翻译成家长今晚能做的一句话'],
    discardFields: ['完整对话公开', '原题照片公开', '学校班级', '分数排名'],
    miniappLanding: ['/pages/home/home', '/pages/profile/profile'],
    acceptanceGate: ['guardian_safe_field', 'confidence_gate', 'blocked_private_fields'],
    owner: 'local_rule_plus_ai_wording'
  },
  {
    id: 'competitor_mechanic_to_local_loop',
    sourceFamily: 'Gizmo/Khanmigo/千问等公开机制观察',
    intakeFields: ['记忆循环', '教师/家长工具', '视觉解释模式', '分享动机'],
    directUse: ['产品机制假设', '本地 release gate', '能力成熟度队列'],
    normalizeAsLocalCode: ['spaced_recall_policy', 'parent_decision_gate', 'visual_boundary', 'share_return_contract'],
    aiExpressionUse: ['把机制包装成中文家庭场景下的轻提示'],
    discardFields: ['竞品品牌承诺', '全科动态板书承诺', '排行榜刺激传播'],
    miniappLanding: ['/pages/arcade/arcade', '/pages/tutor/tutor', '/pages/profile/profile'],
    acceptanceGate: ['local_gate_before_ai', 'no_fake_competitor_claim', 'family_scenario_fit'],
    owner: 'local_rule'
  },
  {
    id: 'classroom_wrong_cause_to_home_school_packet',
    sourceFamily: '课堂/作业错因观察',
    intakeFields: ['重复错因', '第一次卡住位置', '迁移失败点', '老师可观察问题'],
    directUse: ['家校沟通包', '跨周趋势', '过度诊断拦截'],
    normalizeAsLocalCode: ['recurrence_count', 'teacher_question', 'overdiagnosis_lock', 'day7_transfer_check'],
    aiExpressionUse: ['把沟通摘要写成不指责孩子的短句'],
    discardFields: ['人格判断', '长期能力标签', '同学比较', '老师重点盯防话术'],
    miniappLanding: ['/pages/profile/profile', '/pages/review/review'],
    acceptanceGate: ['three_evidence_points', 'no_personality_label', 'teacher_safe_fields_only'],
    owner: 'local_rule_plus_ai_wording'
  }
];

const PUBLIC_K12_CANDIDATE_POOL = [
  {
    id: 'moe_2022_math_quantity_relation',
    sourceFamily: '课程标准/教学目标',
    qualityTier: 'A',
    usableAs: ['能力轴', '题型簇', '报告维度'],
    localCodeFit: ['math_word_problem', 'equation_setup', 'mastery_gate'],
    aiFit: ['把数量关系入口改写成追问'],
    rejectIf: ['出现教材整段原文', '出现标准答案', '只有知识点没有任务动作'],
    sampleSeed: '分数、百分数、比例、方程先找“谁和谁的关系”。',
    miniappLanding: ['/pages/tutor/tutor', '/pages/profile/profile'],
    nextAction: '继续拆成数量关系、方程建模、函数图像三组压力样本。'
  },
  {
    id: 'smartedu_daily_homework_pressure',
    sourceFamily: '基础性作业/课堂练习风格',
    qualityTier: 'A',
    usableAs: ['真实作业压力样本', '家长检查句', '回访卡'],
    localCodeFit: ['wrong_cause_signal', 'first_step_rule', 'revisit_window'],
    aiFit: ['换一种不责备的提示语气'],
    rejectIf: ['需要搬运原题全文', '需要输出完整题解', '题干含学生隐私'],
    sampleSeed: '把日常作业题转写成“孩子卡在哪个第一步”。',
    miniappLanding: ['/pages/home/home', '/pages/review/review', '/pages/arcade/arcade'],
    nextAction: '优先补语数英物化生地每天作业最常见卡点。'
  },
  {
    id: 'public_exam_archetype_transfer',
    sourceFamily: '公开考试题型/学业水平题型',
    qualityTier: 'B',
    usableAs: ['变式迁移', '干扰项压力测试', '小黑板第一笔'],
    localCodeFit: ['variant_unlock_gate', 'transfer_ladder', 'board_move'],
    aiFit: ['解释为什么新题面还是同一错因'],
    rejectIf: ['押题承诺', '分数预测', '原题答案索引'],
    sampleSeed: '只抽题型结构和干扰项，不抽原题答案。',
    miniappLanding: ['/pages/tutor/tutor', '/pages/arcade/arcade', '/pages/radar/radar'],
    nextAction: '补“同错因换题面”的迁移压测，而不是补标准答案。'
  },
  {
    id: 'family_first_party_recurrence',
    sourceFamily: '家庭一方输入',
    qualityTier: 'A+',
    usableAs: ['长期证据账本', '跨周趋势', '家校摘要'],
    localCodeFit: ['confidence_threshold', 'privacy_trim', 'overdiagnosis_lock'],
    aiFit: ['把证据翻译成家长能执行的一句话'],
    rejectIf: ['完整对话公开', '原题照片公开', '分数排名公开'],
    sampleSeed: '孩子连续两天卡在同一错因，才进入跨周趋势候选。',
    miniappLanding: ['/pages/profile/profile', '/pages/home/home'],
    nextAction: '优先积累第一步原话、错因复述、明天回访、第 7 天迁移。'
  },
  {
    id: 'qwen_visual_blackboard_observation',
    sourceFamily: '竞品机制观察',
    qualityTier: 'B',
    usableAs: ['视觉解释模式', '小黑板边界', '用户期待校准'],
    localCodeFit: ['first_step_blackboard', 'visual_boundary', 'exit_criteria'],
    aiFit: ['解释为什么先画这一笔'],
    rejectIf: ['承诺全科动态板书', '假装拍题识别', '输出完整板书答案'],
    sampleSeed: '借鉴“画着讲”的期待，但只落成第一步小黑板。',
    miniappLanding: ['/pages/tutor/tutor', '/pages/profile/profile'],
    nextAction: '每个题型只补第一笔图解和退出条件。'
  },
  {
    id: 'gizmo_recall_mechanic_observation',
    sourceFamily: '竞品机制观察',
    qualityTier: 'B',
    usableAs: ['高频记忆循环', '主动回忆', '复习召回'],
    localCodeFit: ['spaced_recall_policy', 'xp_hold_rule', 'leech_rule'],
    aiFit: ['把复习提醒写得不枯燥'],
    rejectIf: ['排行榜刺激', '分数攀比', 'AI 直接发奖励'],
    sampleSeed: '借鉴高频回忆机制，但 XP 和解锁必须本地规则决定。',
    miniappLanding: ['/pages/arcade/arcade', '/pages/review/review'],
    nextAction: '继续压每日 90 秒微回忆和错因复现。'
  },
  {
    id: 'teacher_wrong_cause_language',
    sourceFamily: '课堂/作业错因观察',
    qualityTier: 'A',
    usableAs: ['家校沟通包', '老师可观察问题', '过度诊断拦截'],
    localCodeFit: ['teacher_safe_fields', 'recurrence_count', 'day7_transfer_check'],
    aiFit: ['把沟通摘要改写成不指责孩子'],
    rejectIf: ['人格判断', '长期能力标签', '老师重点盯防', '同学比较'],
    sampleSeed: '把“孩子不认真”改写成“卡在审题、第一步、错因复现还是迁移”。',
    miniappLanding: ['/pages/profile/profile', '/pages/review/review'],
    nextAction: '把家校摘要固定成问题清单，不做诊断结论。'
  }
];

const PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER = [
  {
    id: 'smartedu_official_resource',
    label: '国家中小学智慧教育平台',
    sourceType: 'official_public_resource',
    sourceUrl: 'https://basic.smartedu.cn/',
    licenseSignal: 'official_public_portal_check_terms_before_copy',
    commercialDecision: '只抽象成题型/错因/减负边界，不复制原文、不宣称官方合作',
    directUse: ['课程主题', '作业风格', '课堂活动方向', '减负边界'],
    localizeAsCode: ['subject_lane', 'task_type', 'wrong_cause_seed', 'parent_check_line'],
    aiBetterFor: ['把课堂语言改写成孩子第一步追问'],
    mustNotUse: ['搬运原题全文', '输出完整答案', '宣称官方合作或官方题库'],
    miniappLanding: ['/pages/home/home', '/pages/tutor/tutor', '/pages/profile/profile'],
    acceptanceGate: ['source_boundary_logged', 'sample_rewritten', 'no_answer_bank']
  },
  {
    id: 'moe_2022_curriculum_standard',
    label: '教育部 2022 义务教育课标',
    sourceType: 'official_standard',
    sourceUrl: 'http://www.moe.gov.cn/',
    licenseSignal: 'official_standard_reference_not_content_bank',
    commercialDecision: '课程标准只做能力轴和报告维度，不复制课标正文，掌握度由本地证据门槛决定',
    directUse: ['学段能力框架', '学科核心概念', '学业质量方向'],
    localizeAsCode: ['capability_axis', 'course_unit_spine', 'mastery_gate', 'report_dimension'],
    aiBetterFor: ['把能力目标翻译成家长和孩子能听懂的话'],
    mustNotUse: ['大段复制标准正文', '把课标当题库', '让 AI 判定掌握等级'],
    miniappLanding: ['/pages/module/module', '/pages/profile/profile'],
    acceptanceGate: ['capability_tag_exists', 'local_mastery_gate', 'parent_readable_line']
  },
  {
    id: 'phet_simulation_oer',
    label: 'PhET 互动仿真',
    sourceType: 'open_education_resource',
    sourceUrl: 'https://phet.colorado.edu/',
    licenseSignal: 'PhET license allows educational reuse, but runtime embedding must be checked per asset',
    commercialDecision: '借鉴变量控制和可视化第一步，不嵌入未适配仿真、不承诺全科动态板书',
    directUse: ['物理/化学/生物/数学可视化机制参考', '变量控制活动结构', '互动小黑板灵感'],
    localizeAsCode: ['visual_board_layer', 'variable_control_prompt', 'exit_criteria', 'no_full_solution_boundary'],
    aiBetterFor: ['解释为什么先看这个变量或先画这一笔'],
    mustNotUse: ['直接嵌入未适配仿真当作小程序能力', '承诺全科动态板书', '让 AI 生成实验结论'],
    miniappLanding: ['/pages/tutor/tutor', '/pages/arcade/arcade'],
    acceptanceGate: ['first_step_visual_only', 'variable_named', 'answer_boundary_visible']
  },
  {
    id: 'ck12_flexbook_practice',
    label: 'CK-12 FlexBook / Practice',
    sourceType: 'open_k12_stem_resource',
    sourceUrl: 'https://www.ck12.org/',
    licenseSignal: 'CK-12 FlexBook is open K12 material; check current CK-12 curriculum license before commercial reuse',
    commercialDecision: '借鉴概念层级、自适应练习和标签体系，题目/答案不直接导入',
    directUse: ['STEM 概念层级参考', '自适应练习机制参考', '题型标签方向'],
    localizeAsCode: ['question_type_card', 'adaptive_recall_policy', 'mastery_threshold', 'leech_rule'],
    aiBetterFor: ['把概念解释成中文家庭作业场景下的一句话'],
    mustNotUse: ['复制练习题和答案', '把外部自适应分数当本地画像', '用英文内容直接前台展示'],
    miniappLanding: ['/pages/arcade/arcade', '/pages/review/review', '/pages/profile/profile'],
    acceptanceGate: ['localized_task_type', 'xp_local_rule', 'no_external_score_import']
  },
  {
    id: 'openstax_high_school_reference',
    label: 'OpenStax 高中/基础 STEM 开放教材',
    sourceType: 'open_textbook_reference',
    sourceUrl: 'https://openstax.org/',
    licenseSignal: 'OpenStax books use Creative Commons licenses; verify attribution and noncommercial/sharealike constraints per book',
    commercialDecision: '借鉴概念解释结构和术语层级，改写为中文第一步小黑板，不搬运段落',
    directUse: ['概念解释结构', '术语层级', '章节脉络参考'],
    localizeAsCode: ['concept_ladder', 'glossary_guardrail', 'course_unit_backlog'],
    aiBetterFor: ['把概念解释改写成中文小黑板旁白'],
    mustNotUse: ['直接搬运教材段落', '复制习题答案', '把大学教材难度下放给小初学生'],
    miniappLanding: ['/pages/module/module', '/pages/tutor/tutor'],
    acceptanceGate: ['age_band_adapted', 'no_copied_paragraph', 'first_step_only']
  },
  {
    id: 'geogebra_classroom_activity',
    label: 'GeoGebra 课堂活动',
    sourceType: 'open_math_visual_activity',
    sourceUrl: 'https://www.geogebra.org/',
    licenseSignal: 'community materials may have different licenses; verify each activity before reuse',
    commercialDecision: '只借鉴几何/函数的可视化操作结构，不复制活动、不嵌入外部交互、不宣称官方合作',
    directUse: ['几何拖拽观察结构', '函数图像变量变化', '坐标/角度可视化动作'],
    localizeAsCode: ['geometry_board_move', 'function_variable_prompt', 'visual_exit_gate', 'drag_observation_rule'],
    aiBetterFor: ['把拖拽观察改写成孩子能复述的第一步问题'],
    mustNotUse: ['复制活动文件', '直接嵌入未授权交互', '把可视化观察写成完整答案'],
    miniappLanding: ['/pages/tutor/tutor', '/pages/arcade/arcade', '/pages/profile/profile'],
    acceptanceGate: ['visual_action_rewritten', 'no_external_embed', 'first_step_observation_only']
  },
  {
    id: 'libretexts_stem_reference',
    label: 'LibreTexts STEM 开放教材',
    sourceType: 'open_textbook_reference',
    sourceUrl: 'https://libretexts.org/',
    licenseSignal: 'LibreTexts content commonly uses Creative Commons licenses; attribution and book-level terms must be checked',
    commercialDecision: '借鉴概念层级和术语解释路径，不搬运段落、不直接导入题目答案、不把高阶内容下放为小初结论',
    directUse: ['概念层级', '术语关系', '实验/过程解释结构'],
    localizeAsCode: ['concept_prerequisite_ladder', 'glossary_axis', 'process_board_move', 'age_band_gate'],
    aiBetterFor: ['把术语关系翻译成中文家庭作业里的小黑板旁白'],
    mustNotUse: ['复制教材段落', '复制习题答案', '忽略年龄段直接前台展示'],
    miniappLanding: ['/pages/module/module', '/pages/tutor/tutor', '/pages/profile/profile'],
    acceptanceGate: ['age_band_checked', 'no_copied_text', 'concept_ladder_local']
  },
  {
    id: 'khan_academy_learning_design',
    label: 'Khan Academy 学习设计公开观察',
    sourceType: 'public_learning_design_reference',
    sourceUrl: 'https://www.khanacademy.org/',
    licenseSignal: 'Khan Academy content and platform features are not a free content bank; use only public design observation unless terms allow reuse',
    commercialDecision: '只借鉴 mastery、提示层级和教师/家长工具思路，不复制课程内容、不搬运练习、不宣称 Khanmigo 能力',
    directUse: ['掌握门槛设计', '提示层级', '教师/家长视角结构'],
    localizeAsCode: ['mastery_gate', 'hint_ladder', 'parent_teacher_safe_digest', 'overdiagnosis_lock'],
    aiBetterFor: ['把提示层级解释成不直接给答案的中文追问'],
    mustNotUse: ['复制课程视频/练习', '冒充 Khanmigo', '把外部掌握度当本地画像'],
    miniappLanding: ['/pages/tutor/tutor', '/pages/profile/profile', '/pages/review/review'],
    acceptanceGate: ['local_mastery_evidence', 'no_content_copy', 'no_brand_claim']
  },
  {
    id: 'oer_commons_cc_resource_pool',
    label: 'OER Commons 可筛选开放资源池',
    sourceType: 'open_resource_directory',
    sourceUrl: 'https://www.oercommons.org/',
    licenseSignal: 'resources carry item-level usage rights such as public domain, CC BY, CC BY-SA, CC BY-NC; check each item before adaptation',
    commercialDecision: '只使用明确可商用或公版的结构信号；不复制未核验资源、不直接导入题目答案、不使用 NC 资源做商业内置内容',
    directUse: ['授权筛选入口', '学科资源目录', '活动类型参考'],
    localizeAsCode: ['source_license_registry', 'reuse_level', 'attribution_required', 'adapted_task_template'],
    aiBetterFor: ['把已授权结构改写成中文第一步追问和家长提示'],
    mustNotUse: ['忽略单条资源授权', '复制题目和答案', '把 NC 资源放进商业内置题库'],
    miniappLanding: ['/pages/upload/upload', '/pages/tutor/tutor', '/pages/profile/profile'],
    acceptanceGate: ['license_checked', 'reuse_level_not_copied_original', 'attribution_recorded']
  },
  {
    id: 'public_curriculum_standards_crosswalk',
    label: '公开课程标准能力动词交叉表',
    sourceType: 'public_curriculum_standard_reference',
    sourceUrl: 'https://www.thecorestandards.org/',
    licenseSignal: 'public standards are structure references; always check jurisdiction and copyright notices before copying wording',
    commercialDecision: '只抽取能力动词和知识层级做本地课程骨架，不复制标准原文、不宣称覆盖官方课程或考试',
    directUse: ['能力动词', '学段层级', '知识点先后关系'],
    localizeAsCode: ['skill_verb', 'grade_band', 'curriculum_node', 'prerequisite_ladder'],
    aiBetterFor: ['把能力动词翻译成孩子能执行的一句话'],
    mustNotUse: ['复制标准措辞', '宣称官方课程覆盖', '把标准当测评结论'],
    miniappLanding: ['/pages/module/module', '/pages/review/review', '/pages/profile/profile'],
    acceptanceGate: ['structure_only', 'localized_wording', 'no_official_coverage_claim']
  },
  {
    id: 'illustrative_math_problem_based_structure',
    label: 'Illustrative Mathematics 问题式数学结构',
    sourceType: 'open_math_curriculum_structure',
    sourceUrl: 'https://illustrativemathematics.org/math-curriculum/',
    licenseSignal: 'IM v.360 is CC BY-NC; older/free OER lines can differ, so commercial reuse must be checked per version',
    commercialDecision: '只借问题式课堂结构、预期误区和家庭提示形态；不搬运任务、题目、教师讲稿或认证品牌权益。',
    directUse: ['问题式单元结构', '预期误区类型', '课堂综合讨论形态', '家庭提示结构'],
    localizeAsCode: ['problem_based_unit_shape', 'anticipated_misconception_tag', 'family_prompt_contract', 'no_content_copy_gate'],
    aiBetterFor: ['把问题式探究过程改写成孩子能说出口的第一步追问'],
    mustNotUse: ['复制 IM 任务文本', '使用 NC 内容做商业内置题库', '宣称 IM Certified 或官方合作'],
    miniappLanding: ['/pages/module/module', '/pages/tutor/tutor', '/pages/profile/profile'],
    acceptanceGate: ['license_checked', 'structure_only', 'no_certification_claim'],
    licenseCheckedAt: '2026-05-19',
    reuseLevel: 'structure_only',
    attributionRequired: true,
    derivedArtifact: 'problem_based_first_step_card'
  },
  {
    id: 'openscied_science_inquiry_structure',
    label: 'OpenSciEd 科学探究结构',
    sourceType: 'open_science_curriculum_structure',
    sourceUrl: 'https://openscied.org/',
    licenseSignal: 'OpenSciEd materials require attribution and license checks by grade band/unit before reuse',
    commercialDecision: '只借现象驱动、证据链和模型修订结构；不复制课程包、实验单、图片或品牌素材。',
    directUse: ['现象驱动入口', '证据链顺序', '模型修订节奏', '科学解释句式'],
    localizeAsCode: ['phenomenon_first_step', 'evidence_chain_board', 'model_revision_revisit', 'science_claim_evidence_reasoning_gate'],
    aiBetterFor: ['把科学解释改写成不泄答案的追问和家长复盘句'],
    mustNotUse: ['复制单元材料', '复制实验图片/讲义', '宣称覆盖 OpenSciEd 官方课程'],
    miniappLanding: ['/pages/tutor/tutor', '/pages/diagnosis/diagnosis', '/pages/profile/profile'],
    acceptanceGate: ['phenomenon_localized', 'no_lab_sheet_copy', 'claim_evidence_reasoning_only'],
    licenseCheckedAt: '2026-05-19',
    reuseLevel: 'structure_only',
    attributionRequired: true,
    derivedArtifact: 'science_evidence_blackboard_card'
  },
  {
    id: 'openup_math_problem_routine',
    label: 'Open Up Resources 6-8 Math 问题式流程',
    sourceType: 'open_math_routine_reference',
    sourceUrl: 'https://www.openupresources.org/math-curriculum/6-8-math/',
    licenseSignal: 'current 6-8 Math editions include CC BY-NC terms and exceptions; assessments and brand assets are not reusable without permission',
    commercialDecision: '只借 warm-up/activities/cool-down 的学习节奏和家长可理解结构；不直接导入教材、评测、品牌或图标。',
    directUse: ['warm-up 节奏', '活动到总结结构', '家长材料形态', '学生支持类型'],
    localizeAsCode: ['daily_warmup_recall', 'cooldown_exit_ticket', 'parent_readable_math_routine', 'assessment_copy_block'],
    aiBetterFor: ['把活动总结改写成今晚 90 秒回忆提示'],
    mustNotUse: ['复制课程材料', '复制评测题', '使用 Open Up/IM 品牌资产'],
    miniappLanding: ['/pages/arcade/arcade', '/pages/review/review', '/pages/profile/profile'],
    acceptanceGate: ['routine_only', 'assessment_excluded', 'brand_assets_blocked'],
    licenseCheckedAt: '2026-05-19',
    reuseLevel: 'routine_only',
    attributionRequired: true,
    derivedArtifact: 'daily_warmup_cooldown_loop'
  }
];

const PUBLIC_K12_USE_WORKBENCH = [
  {
    id: 'curriculum_standard_spine',
    label: '课程标准',
    directUse: ['学科能力框架', '年级段目标', '核心素养方向'],
    localizeAsCode: ['学科路由', '能力标签', '报告维度', '掌握门槛'],
    aiBetterFor: ['把能力标签改写成孩子听得懂的一句话', '把家长行动建议说得更柔和'],
    mustNotUse: ['复制课程标准正文当内容库', '宣称覆盖全教材原题', '让 AI 决定掌握等级'],
    productSurface: ['/pages/tutor/tutor', '/pages/profile/profile'],
    evidenceGate: ['subject_route_exists', 'capability_tag_exists', 'local_mastery_gate'],
    productDecision: '直接用框架，不直接用原文；本地代码管结构，AI 只管表达。'
  },
  {
    id: 'smartedu_basic_homework_pattern',
    label: '基础性作业',
    directUse: ['题型方向', '作业压力场景', '减负边界'],
    localizeAsCode: ['压力样本', '错因模型', '回访窗口', '家长检查句'],
    aiBetterFor: ['同一错因的不同追问语气', '孩子卡住时的降阶提示'],
    mustNotUse: ['批量搬运原题', '输出完整题解', '伪装成拍照搜题'],
    productSurface: ['/pages/home/home', '/pages/tutor/tutor', '/pages/review/review'],
    evidenceGate: ['sample_rewritten', 'wrong_cause_specific', 'no_answer_bank'],
    productDecision: '抽象成题型和错因，不做原题答案库。'
  },
  {
    id: 'public_exam_archetype',
    label: '公开考试题型',
    directUse: ['题型簇', '变式方向', '压力测试口径'],
    localizeAsCode: ['题型路由', '变式解锁', '小黑板第一笔', '跨周趋势'],
    aiBetterFor: ['解释同一错因在不同题面里的表现'],
    mustNotUse: ['押题承诺', '原题答案索引', '考试分数预测'],
    productSurface: ['/pages/tutor/tutor', '/pages/radar/radar', '/pages/profile/profile'],
    evidenceGate: ['question_type_cluster', 'variant_gate', 'exam_boundary_visible'],
    productDecision: '用来压测迁移能力，不用来做押题或答案搜索。'
  },
  {
    id: 'family_first_party_homework',
    label: '家庭真实输入',
    directUse: ['孩子原话', '今晚卡点', '家长观察', '回访结果'],
    localizeAsCode: ['隐私裁剪', '分享字段白名单', '画像置信度', '奖励发放门槛'],
    aiBetterFor: ['把证据翻译成家长可执行的一句话', '把复盘语气改得不责备'],
    mustNotUse: ['公开完整对话', '公开原题照片', '公开排名分数', '无证据贴诊断标签'],
    productSurface: ['/pages/profile/profile', '/pages/home/home'],
    evidenceGate: ['guardian_safe_field', 'confidence_gate', 'share_blocklist'],
    productDecision: '这是最有价值的一方数据，但必须先过隐私和置信度门槛。'
  },
  {
    id: 'socratic_ai_layer',
    label: '苏格拉底 AI 表达层',
    directUse: ['追问语气', '同义改写', '鼓励与降阶表达'],
    localizeAsCode: ['追问轴选择', '禁止直接答案', '失败兜底', '停止条件'],
    aiBetterFor: ['根据孩子原话换一种问法', '把硬规则变成自然对话'],
    mustNotUse: ['让 AI 决定是否给答案', '让 AI 决定奖励', '让 AI 判断隐私字段', '让 AI 生成标准答案'],
    productSurface: ['/pages/tutor/tutor'],
    evidenceGate: ['axis_local', 'three_round_no_answer', 'fallback_micro_choice'],
    productDecision: 'AI 适合“怎么说”，不适合“问什么、能不能放行”。'
  },
  {
    id: 'visual_blackboard_layer',
    label: '小黑板图解层',
    directUse: ['第一笔图解动作', '图示边界', '退出条件'],
    localizeAsCode: ['板书层级', '禁止写最终答案', '按题型选图示动作'],
    aiBetterFor: ['解释为什么先画这一笔', '把板书动作翻译成儿童语言'],
    mustNotUse: ['承诺全科动态板书', '冒充拍照识别', '自动生成完整解题过程'],
    productSurface: ['/pages/tutor/tutor', '/pages/profile/profile'],
    evidenceGate: ['board_move_present', 'answer_boundary_visible', 'exit_criteria_present'],
    productDecision: '先做可信第一步小黑板，不做四不像全科板书。'
  }
];

const PUBLIC_K12_ANTI_FAKE_THICKNESS_GATES = [
  {
    id: 'source_to_sample_gate',
    productRisk: '把公开资料直接堆成“题库很多”的假厚度。',
    localCodeMustOwn: ['来源分级', '样本改写', '题型归一', '答案泄漏拦截'],
    aiCanHelp: ['把第一步改写成孩子能接住的追问'],
    proofRequired: ['source_id_present', 'sample_specific_first_step', 'no_original_answer'],
    rejectIf: ['原题全文进入前台', '出现标准答案索引', '没有错因却进入报告']
  },
  {
    id: 'socratic_axis_gate',
    productRisk: '苏格拉底看起来会聊，但问法没有命中题型和错因。',
    localCodeMustOwn: ['追问轴', '停止条件', '失败降阶', '禁止直接答案'],
    aiCanHelp: ['同一追问换语气', '孩子二次卡住后的鼓励表达'],
    proofRequired: ['task_type_axis_selected', 'three_round_no_answer', 'fallback_micro_choice'],
    rejectIf: ['AI 决定能否给答案', '连续追问仍不落到第一步', '把讲解写成完整题解']
  },
  {
    id: 'visual_blackboard_gate',
    productRisk: '借鉴千问板书后变成假全科动态板书承诺。',
    localCodeMustOwn: ['题型到板书动作映射', '第一笔图解', '退出条件', '答案边界'],
    aiCanHelp: ['解释为什么先画这一笔'],
    proofRequired: ['board_move_present', 'first_step_only', 'exit_criteria_present'],
    rejectIf: ['承诺拍照识题', '自动生成完整板书答案', '没有图示边界']
  },
  {
    id: 'memory_game_gate',
    productRisk: '学 Gizmo 的高频记忆，但只做积分装饰，没有真实复习价值。',
    localCodeMustOwn: ['回访窗口', 'XP 发放', '变式解锁', '连续失败降阶'],
    aiCanHelp: ['把复习提醒写得不枯燥'],
    proofRequired: ['wrong_cause_reappears', 'day7_variant_gate', 'xp_not_awarded_by_ai'],
    rejectIf: ['只发 XP 不要求证据', '没有明天/第7天回访', '用排名刺激传播']
  },
  {
    id: 'report_portrait_gate',
    productRisk: '报告看起来专业，但证据不足就给长期画像。',
    localCodeMustOwn: ['证据计数', '跨周趋势', '置信度门槛', '家校字段白名单'],
    aiCanHelp: ['把已释放证据翻译成家长/老师能执行的一句话'],
    proofRequired: ['evidence_count_met', 'cross_week_signal', 'safe_handoff_fields_only'],
    rejectIf: ['一题就贴长期标签', '公开完整对话', '公开分数排名']
  },
  {
    id: 'share_growth_gate',
    productRisk: '为了裂变牺牲隐私，晒原题、答案、排名。',
    localCodeMustOwn: ['可见字段白名单', '禁传字段黑名单', '接收者自带材料', '回流参数'],
    aiCanHelp: ['分享卡标题和温和鼓励'],
    proofRequired: ['blocked_original_question', 'blocked_score_rank', 'receiver_own_material'],
    rejectIf: ['原题照片外传', '完整答案外传', '排名/正确率刺激转发']
  }
];

const PUBLIC_K12_IMPLEMENTATION_PLAYBOOK = [
  {
    id: 'direct_use',
    label: '可以直接用',
    useFor: ['学科分类', '能力标签', '公开来源分级', '减负与隐私边界'],
    mustStayLocal: ['来源白名单', '页面落点', '禁用字段'],
    aiRole: '不需要 AI 决策，只能做中文解释。',
    miniappLanding: ['/pages/tutor/tutor', '/pages/profile/profile']
  },
  {
    id: 'local_code_better',
    label: '本地代码更好',
    useFor: ['题型路由', '错因命中', '第一步小黑板', '回访间隔', 'XP 与解锁', '报告释放', '分享字段'],
    mustStayLocal: ['release gate', 'privacy gate', 'reward gate', 'mastery gate'],
    aiRole: 'AI 不参与放行，只改写已确定内容。',
    miniappLanding: ['/pages/home/home', '/pages/review/review', '/pages/arcade/arcade']
  },
  {
    id: 'ai_better',
    label: 'AI 更好',
    useFor: ['苏格拉底追问语气', '同一第一步的多种说法', '家长报告解释', '降阶鼓励'],
    mustStayLocal: ['追问轴', '直接答案拦截', '失败兜底'],
    aiRole: 'AI 只负责“怎么说”，不负责“问什么、能否通过”。',
    miniappLanding: ['/pages/tutor/tutor', '/pages/profile/profile']
  },
  {
    id: 'must_reject',
    label: '必须拒绝',
    useFor: ['原题全文搬运', '标准答案库', '拍照搜题承诺', '全科动态板书承诺', '分数排名传播'],
    mustStayLocal: ['negative_sample_block', 'copy_boundary_check', 'share_blocklist'],
    aiRole: 'AI 也不能生成或包装这些承诺。',
    miniappLanding: ['/pages/legal/legal', '/pages/home/home']
  }
];

function buildK12PublicResourceTriageBoard(options = {}) {
  const resources = options.resources || PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER;
  const playbook = options.playbook || PUBLIC_K12_IMPLEMENTATION_PLAYBOOK;
  const lanes = [
    {
      id: 'direct_use',
      label: '直接可用',
      owner: 'local_rule',
      use: ['学科分类', '能力标签', '来源分级', '减负与隐私边界'],
      gate: ['source_url_present', 'license_signal_visible', 'no_content_copy']
    },
    {
      id: 'local_code_better',
      label: '本地代码更好',
      owner: 'local_rule',
      use: ['题型路由', '错因命中', '第一步小黑板', '回访间隔', 'XP 解锁', '报告放行', '分享字段'],
      gate: ['deterministic_gate', 'privacy_blocklist', 'sample_specific_output']
    },
    {
      id: 'ai_better',
      label: 'AI 只管表达',
      owner: 'ai_wording_only',
      use: ['苏格拉底追问语气', '同一第一步的多种说法', '家长报告解释', '降阶鼓励'],
      gate: ['axis_already_selected', 'no_final_answer', 'local_release_gate_passed']
    },
    {
      id: 'must_reject',
      label: '必须拒绝',
      owner: 'local_blocklist',
      use: ['原题全文搬运', '标准答案库', '拍照搜题承诺', '全科动态板书承诺', '分数排名传播'],
      gate: ['negative_sample_block', 'share_blocklist', 'no_fake_partner_claim']
    }
  ];
  const resourceCards = resources.map((item, index) => ({
    id: `triage_${item.id || index}`,
    sourceId: item.id,
    label: item.label,
    sourceUrl: item.sourceUrl,
    licenseSignal: item.licenseSignal,
    decision: item.commercialDecision,
    directUse: item.directUse,
    localCodeUse: item.localizeAsCode,
    aiUse: item.aiBetterFor,
    rejectedUse: item.mustNotUse,
    miniappLanding: item.miniappLanding,
    route: (item.miniappLanding && item.miniappLanding[0]) || '/pages/profile/profile',
    readiness: item.sourceUrl && item.licenseSignal && item.commercialDecision ? 'source_triaged' : 'needs_source_check',
    localRule: '本地代码决定题型、错因、小黑板、回访、奖励、报告放行和分享字段。',
    aiRule: 'AI 只把已经确定的提示改写成更自然的中文，不决定答案、掌握度、排行或隐私字段。',
    blockedRule: '不复制原文、不导入答案、不嵌入未授权交互、不宣称外部合作或全科动态板书能力。'
  }));
  const sourceBackedChallengeSeeds = resourceCards.map((item, index) => ({
    id: `oer_triage_challenge_${item.sourceId || index}`,
    title: `${item.label} · 第一步挑战`,
    prompt: `借这个来源的结构，用孩子自己的作业材料说第一步。`,
    localCodeUse: item.localCodeUse && item.localCodeUse[0],
    aiUse: item.aiUse && item.aiUse[0],
    blockedUse: item.rejectedUse && item.rejectedUse[0],
    route: '/pages/arcade/arcade?from=oer_triage',
    acceptanceGate: ['receiver_own_material', 'first_step_only', 'no_original_answer', 'next_day_revisit']
  }));
  return {
    id: 'k12_public_resource_triage_board',
    title: '公开资料使用决策板',
    summary: `已把 ${resources.length} 类公开/OER 资料拆成直接可用、本地代码更好、AI 只管表达、必须拒绝四类。`,
    resourceCount: resources.length,
    playbookCount: playbook.length,
    lanes,
    resourceCards,
    sourceBackedChallengeSeeds,
    localCodeWins: ['routing', 'wrong_cause', 'blackboard', 'review_cadence', 'xp_unlock', 'report_release', 'share_fields'],
    aiWins: ['tone', 'socratic_wording', 'parent_explanation', 'encouragement'],
    mustReject: ['copied_question', 'full_answer_bank', 'photo_search_claim', 'score_ranking_growth', 'fake_partner_claim'],
    reportLine: `公开资料不直接变题库；先进入本地规则，再产出第一步、小黑板、回访、游戏和安全分享。`,
    marginalRule: '如果新资料不能增加真实样本、题型簇、错因命中或回访证据，就停止扩表，转向真实家庭压测。'
  };
}

function buildK12LocalAiImplementationRunway(options = {}) {
  const resources = options.resources || PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER;
  const moduleRows = [
    {
      id: 'content_scale',
      label: '7科内容规模',
      gap: '把公开/OER/一方资料沉淀为题型、错因、第一步和回访，不复制原题答案。',
      localCodeOwns: ['source_registry_gate', 'grade_chapter_route', 'question_type_axis', 'sample_specific_first_step', 'answer_boundary'],
      aiBetterFor: ['把已通过边界的第一步改写成儿童能听懂的一句话', '把家长摘要写得更低压'],
      miniappLanding: ['/pages/module/module', '/pages/tutor/tutor', '/pages/profile/profile'],
      acceptanceGate: ['source_url_present', 'license_signal_visible', 'no_original_text', 'no_full_answer', 'sample_specific_output']
    },
    {
      id: 'socratic_depth',
      label: '苏格拉底点拨质量',
      gap: 'AI适合问法和解释，但追问轴、停止条件、答案边界必须本地决定。',
      localCodeOwns: ['question_axis_route', 'hint_level', 'stop_rule', 'answer_request_block', 'parent_handoff_gate'],
      aiBetterFor: ['追问措辞', '误区同学一句话', '孩子卡住时的鼓励语'],
      miniappLanding: ['/pages/tutor/tutor', '/pages/review/review'],
      acceptanceGate: ['no_final_answer', 'three_round_limit', 'child_first_step_required', 'parent_handoff_after_stuck']
    },
    {
      id: 'mini_lesson_visual_board',
      label: '3分钟小讲堂/小黑板',
      gap: '只在连续卡住后补一个概念缺口，不开放课堂模式选择。',
      localCodeOwns: ['mini_lesson_trigger', 'render_gate', 'visual_primitive_contract', 'exit_ticket_gate', 'review_seed_release'],
      aiBetterFor: ['AI老师讲一句', 'AI同学暴露一个常见误区', '同一小黑板动作的口语化解释'],
      miniappLanding: ['/pages/tutor/tutor', '/pages/profile/profile'],
      acceptanceGate: ['router_mode_three_minute_only', 'no_full_classroom', 'no_full_solution_board', 'child_exit_ticket_before_game']
    },
    {
      id: 'active_recall_game',
      label: 'Gizmo式主动回忆游戏',
      gap: '借鉴flashcards/quizzes/spaced repetition/active recall，但奖励只绑真实回忆证据。',
      localCodeOwns: ['real_recall_source_gate', 'spaced_interval', 'xp_unlock', 'leech_card_rule', 'share_safe_payload'],
      aiBetterFor: ['同一错因的轻量变式提示', '失败后的鼓励反馈', '不泄答案的提示语'],
      miniappLanding: ['/pages/arcade/arcade', '/pages/review/review'],
      acceptanceGate: ['real_recall_source', 'answer_hidden_before_self_grade', 'no_ranking_pk', 'next_day_revisit_scheduled']
    },
    {
      id: 'family_decision_report',
      label: '家长家庭决策书',
      gap: '上传测评/错题/老师反馈后输出方法候选和下一证据，不贴天赋标签。',
      localCodeOwns: ['source_type_classification', 'method_candidate_only', 'evidence_weight', 'portrait_release_gate', 'safe_share_fields'],
      aiBetterFor: ['家长摘要', '家校沟通措辞', '学习方法候选的温和解释'],
      miniappLanding: ['/pages/upload/upload', '/pages/profile/profile'],
      acceptanceGate: ['talent_label_blocked', 'wrong_question_required_for_practice', 'day7_transfer_before_portrait', 'no_score_ranking']
    },
    {
      id: 'community_share',
      label: '社区化分享/同卡点接力',
      gap: '分享错因和第一步，不分享原题、答案、完整对话、分数排名。',
      localCodeOwns: ['relay_payload_schema', 'blocked_fields', 'receiver_own_material_gate', 'completion_evidence_contract'],
      aiBetterFor: ['分享文案', '接收者提示语', '完成后的家长友好总结'],
      miniappLanding: ['/pages/profile/profile', '/pages/home/home'],
      acceptanceGate: ['no_original_question', 'no_answer_key', 'receiver_first_step_required', 'safe_fields_only']
    },
    {
      id: 'partner_upload_solution',
      label: '合作方测评报告复合方案',
      gap: '测评报告只做学习方法候选，必须和真实作业、错题、回访证据复合。',
      localCodeOwns: ['upload_source_gate', 'talent_method_candidate', 'wrong_paper_evidence_required', 'service_pathway_route', 'partner_boundary'],
      aiBetterFor: ['把报告语言转成家长能理解的行动建议', '把方法候选解释成今晚怎么陪'],
      miniappLanding: ['/pages/upload/upload', '/pages/profile/profile', '/pages/tutor/tutor'],
      acceptanceGate: ['no_fixed_talent_type', 'no_guaranteed_improvement', 'real_wrong_question_before_game', 'private_report_only']
    }
  ];
  const resourceCoverage = resources.map((item) => ({
    id: `runway_${item.id}`,
    sourceId: item.id,
    label: item.label,
    reuseLevel: item.reuseLevel || 'structure_or_reference_only',
    localCodeFit: item.localizeAsCode || [],
    aiFit: item.aiBetterFor || [],
    blockedUse: item.mustNotUse || [],
    targetModules: moduleRows
      .filter((row) => (item.miniappLanding || []).some((route) => row.miniappLanding.includes(route)))
      .map((row) => row.id),
    acceptanceGate: item.acceptanceGate || []
  }));
  return {
    id: 'k12_local_ai_implementation_runway',
    title: 'K12公开资料到家庭私教的本地/AI分工路线图',
    positioning: '借鉴公开资料和OpenMAIC/Gizmo/Khanmigo式机制，但落地为家庭晚间作业苏格拉底私教补位工具。',
    moduleRows,
    resourceCoverage,
    moduleCount: moduleRows.length,
    resourceCount: resources.length,
    localCodeWins: moduleRows.flatMap((row) => row.localCodeOwns),
    aiWins: moduleRows.flatMap((row) => row.aiBetterFor),
    blockedClaims: ['full_ai_classroom', 'copied_question_bank', 'photo_search_answer', 'talent_label', 'score_ranking', 'guaranteed_improvement'],
    stopRule: '新增资料如果不能提高题型命中、错因复现、小黑板第一步、回访证据或家长决策质量，就停止扩表，转向真实家庭试用样本。',
    nextBuildOrder: [
      '先补本地题型/错因/第一步样本',
      '再补苏格拉底和小讲堂触发评估',
      '再补主动回忆游戏回流',
      '最后补家长报告和分享增长'
    ]
  };
}

function buildPressureSampleFailureTypeAudit(options = {}) {
  const samples = options.samples || getRealHomeworkPressureSamples();
  const visualTokens = ['画', '圈', '标', '线', '图', '表', '箭头', '坐标', '模型', '流程', '分成', '对照', '列'];
  const genericTokens = ['认真审题', '先读题', '仔细看题', '先理解题意', '按步骤做', '找关键词'];
  const riskRows = [
    { id: 'source_missing', label: '来源缺失', count: 0, localFix: '补 sourceId/sourceType，再进入压力库。' },
    { id: 'first_step_generic', label: '第一步泛化', count: 0, localFix: '用本地题型路由生成样本专属第一步。' },
    { id: 'wrong_cause_generic', label: '错因泛化', count: 0, localFix: '错因必须绑定题型和孩子卡住位置。' },
    { id: 'board_not_visual', label: '小黑板不够可视化', count: 0, localFix: '补画、圈、标、线段、表格、箭头等第一笔动作。' },
    { id: 'parent_check_weak', label: '家长检查不可执行', count: 0, localFix: '改成家长今晚能问的一句话。' },
    { id: 'transfer_missing', label: '迁移回访缺失', count: 0, localFix: '补同错因小变式和明日回访窗口。' }
  ];
  const riskMap = riskRows.reduce((acc, row) => {
    acc[row.id] = row;
    return acc;
  }, {});
  const subjectMap = {};
  const weakSamples = [];
  samples.forEach((sample) => {
    const risks = [];
    const firstStep = String(sample.expectedFirstStep || '');
    const wrongCause = String(sample.expectedWrongCause || '');
    const boardMove = String(sample.expectedBoardMove || '');
    const parentCheck = String(sample.parentCheck || '');
    const nearTransfer = String(sample.nearTransfer || '');
    if (!sample.sourceId || !sample.sourceType) risks.push('source_missing');
    if (firstStep.length < 12 || genericTokens.some((token) => firstStep.includes(token))) risks.push('first_step_generic');
    if (wrongCause.length < 10 || genericTokens.some((token) => wrongCause.includes(token))) risks.push('wrong_cause_generic');
    if (!visualTokens.some((token) => boardMove.includes(token))) risks.push('board_not_visual');
    if (parentCheck.length < 12 || !/[？?]|你|先|哪|为什么|怎么/.test(parentCheck)) risks.push('parent_check_weak');
    if (nearTransfer.length < 12 || genericTokens.some((token) => nearTransfer.includes(token))) risks.push('transfer_missing');
    const subject = sample.subject || '未标注';
    if (!subjectMap[subject]) {
      subjectMap[subject] = { id: subject, label: subject, total: 0, weak: 0, topRisk: '' };
    }
    subjectMap[subject].total += 1;
    if (risks.length) {
      subjectMap[subject].weak += 1;
      risks.forEach((risk) => {
        if (riskMap[risk]) riskMap[risk].count += 1;
      });
      weakSamples.push({
        id: sample.id,
        subject,
        taskType: sample.taskType,
        stem: sample.stem,
        risks,
        firstStep,
        wrongCause,
        boardMove,
        repairRoute: '/pages/tutor/tutor?from=pressure_failure_audit',
        localFix: risks.map((risk) => riskMap[risk] && riskMap[risk].localFix).filter(Boolean).join(' / ')
      });
    }
  });
  const subjectRows = Object.keys(subjectMap).map((key) => {
    const row = subjectMap[key];
    const subjectWeak = weakSamples.filter((item) => item.subject === key);
    const topRisk = subjectWeak.length
      ? subjectWeak.reduce((acc, item) => {
        item.risks.forEach((risk) => { acc[risk] = (acc[risk] || 0) + 1; });
        return acc;
      }, {})
      : {};
    const topRiskId = Object.keys(topRisk).sort((a, b) => topRisk[b] - topRisk[a])[0] || 'none';
    return Object.assign({}, row, {
      weakRate: row.total ? Math.round(row.weak / row.total * 100) : 0,
      topRisk: topRiskId,
      nextAction: topRiskId === 'none' ? '继续收真实家庭样本。' : (riskMap[topRiskId] && riskMap[topRiskId].localFix) || '补样本证据。'
    });
  });
  const topRiskRows = riskRows
    .slice()
    .sort((a, b) => b.count - a.count)
    .filter((item) => item.count > 0);
  const weakRate = samples.length ? Math.round(weakSamples.length / samples.length * 100) : 0;
  return {
    id: 'pressure_sample_failure_type_audit',
    title: '压力样本反向抽检',
    totalSamples: samples.length,
    weakSampleCount: weakSamples.length,
    weakRate,
    status: weakSamples.length === 0 ? 'green' : weakRate <= 8 ? 'watch' : 'repair_first',
    summary: weakSamples.length
      ? `发现 ${weakSamples.length}/${samples.length} 条样本需要复核，先修本地题型、错因、小黑板、家长检查和回访，不继续堆资料。`
      : `已反向抽检 ${samples.length} 条压力样本，暂未发现来源、第一步、错因、小黑板、家长检查和迁移回访的结构性待查项。`,
    topRiskRows,
    subjectRows,
    weakSamples: weakSamples.slice(0, 12),
    localRuleLine: '本地代码负责反向抽检、风险归因和修复优先级；AI 只能改写已经通过本地门槛的追问表达。',
    stopRule: '若连续两轮待查项为 0 且没有新增真实家庭失败样本，停止静态加厚，转向真机和家庭试用。',
    nextAction: weakSamples.length
      ? '先修 topRiskRows 的本地规则，再把弱样本回灌到苏格拉底、报告、游戏和分享。'
      : '进入真实家庭试用回收，把新失败样本追加到压力库。'
  };
}

const K12_PUBLIC_IMPLEMENTATION_DECISION_MATRIX = [
  {
    id: 'homework_archetype_pressure',
    productQuestion: '公开作业/考试题型能不能直接用来扩题库？',
    decision: '只转写为压力样本和题型簇，不搬原题、不做答案库。',
    localCodeBetter: ['题型识别', '错因命中', '第一步小黑板', '回访窗口', '负样本拦截'],
    aiBetter: ['把同一个第一步改写成更像老师的追问', '孩子二次卡住后的降阶语气'],
    evidenceGate: ['sample_specific_first_step', 'sample_specific_wrong_cause', 'no_final_answer_leak']
  },
  {
    id: 'socratic_dialogue',
    productQuestion: '苏格拉底问答应该本地写死还是调用 AI？',
    decision: '本地代码决定问什么轴，AI 只负责怎么说。',
    localCodeBetter: ['追问轴选择', '不直接给答案', '失败降阶', '停止条件', '安全边界'],
    aiBetter: ['同义追问', '鼓励语气', '根据孩子原话换一种解释'],
    evidenceGate: ['axis_selected_by_task_type', 'three_round_no_answer', 'fallback_micro_choice']
  },
  {
    id: 'visual_blackboard',
    productQuestion: '要不要做千问式全科动态板书？',
    decision: '先做可信第一步小黑板，不承诺全科动态板书。',
    localCodeBetter: ['板书层级', '第一笔图解动作', '禁写最终答案', '图示退出条件'],
    aiBetter: ['把板书步骤解释成孩子听得懂的话'],
    evidenceGate: ['board_move_present', 'answer_boundary_visible', 'exit_criteria_present']
  },
  {
    id: 'parent_report_portrait',
    productQuestion: '家长报告用 AI 直接判断孩子画像吗？',
    decision: '本地证据门槛决定能不能写画像，AI 只做解释。',
    localCodeBetter: ['证据字段裁剪', '跨周趋势', '家校摘要', '画像置信度', '行动释放门槛'],
    aiBetter: ['把证据翻译成家长今晚能做的一句话'],
    evidenceGate: ['evidence_count', 'cross_week_signal', 'home_school_safe_fields']
  },
  {
    id: 'community_share',
    productQuestion: '分享要不要展示分数、排名、原题来刺激转发？',
    decision: '不展示分数排名和原题，用安全接力挑战承接自然传播。',
    localCodeBetter: ['可见字段', '禁传字段', '回流参数', '接收者自己的材料', '传播门槛'],
    aiBetter: ['分享卡一句话标题和温和鼓励'],
    evidenceGate: ['blocked_original_question', 'blocked_score_rank', 'receiver_own_material']
  },
  {
    id: 'gizmo_memory_loop',
    productQuestion: 'Gizmo 式高频记忆循环由谁决策？',
    decision: '本地规则决定回访窗口、错因重现、XP 和解锁；AI 只负责把复习提示说得不枯燥。',
    localCodeBetter: ['间隔复习窗口', '错因重现', '变式解锁门槛', 'XP 发放', '连续失败降阶'],
    aiBetter: ['复习提醒文案', '孩子畏难时的鼓励语气', '同一错因的一句话解释'],
    evidenceGate: ['wrong_cause_reappears', 'variant_gate_passed', 'xp_not_awarded_by_ai']
  },
  {
    id: 'question_bank_course_system',
    productQuestion: '题库/课程体系能否直接由 AI 生成？',
    decision: '题型、能力、错因、进阶和掌握门槛由本地规则与稳定资产决定；AI 只生成可替换表达。',
    localCodeBetter: ['学科节点', '题型卡', '错因模型', '进阶门槛', '掌握释放'],
    aiBetter: ['同一题型讲法改写', '年级化表达', '家长版解释'],
    evidenceGate: ['course_unit_card_exists', 'wrong_cause_model_exists', 'mastery_gate_local']
  },
  {
    id: 'intake_import_public_material',
    productQuestion: '公开资料和家长输入哪些能直接用？',
    decision: '只接收用户主动输入的作业摘要、卡点和错因说法；公开资料只抽象题型，不作为原题和答案来源。',
    localCodeBetter: ['输入字段裁剪', '敏感信息过滤', '题型归一', '来源记录', '失败输入回退'],
    aiBetter: ['口语化作业改写成任务摘要', '生成首个追问'],
    evidenceGate: ['user_supplied_summary', 'source_boundary_logged', 'no_photo_recognition_claim']
  },
  {
    id: 'longitudinal_portrait_home_school',
    productQuestion: '长期画像和家校协同能否由 AI 直接判断？',
    decision: '本地证据和置信度门槛先判断可不可以写；AI 只把已释放证据改写成家长/老师可看的短摘要。',
    localCodeBetter: ['跨周趋势', '证据积累', '置信度门槛', '家校字段白名单', '不分享字段黑名单'],
    aiBetter: ['家长版一句话', '老师版观察摘要', '不责备孩子的表达'],
    evidenceGate: ['confidence_threshold_met', 'safe_handoff_fields_only', 'no_score_rank_raw_dialogue']
  }

];

const QUESTION_TYPE_CLUSTER_RUNWAY = [
  {
    id: 'math_quantity_relation_cluster',
    subject: '数学',
    taskType: 'math_word_problem',
    sourceIds: ['moe_curriculum_standard', 'smartedu_basic_homework', 'public_exam_archetype'],
    pressureFamily: '分数、百分数、比例、行程、几何关系、统计图表',
    firstStepRule: '先把题目翻译成“谁和谁的关系”，只圈单位量、基准量、总量或图形关系。',
    wrongCauseSignals: ['把部分量当总量', '连续变化基准没换', '图形关系没标就计算'],
    boardMove: '小黑板只画线段、表格或角关系第一笔，不写最终算式和答案。',
    socraticProbe: '你先说这句话表示哪个量是整体，哪个量是其中一份？',
    reportSignal: '报告记录“数量关系入口是否说清”，不记录原题答案。',
    memoryCadence: '今晚 1 张同型卡，明天 1 张换数字卡，第 7 天 1 张换情境卡。',
    shareHook: '分享给家长只显示“孩子能不能先说整体和部分”，不显示题目和答案。',
    localGates: ['quantity_anchor_detected', 'no_final_answer', 'variant_ready']
  },
  {
    id: 'equation_model_cluster',
    subject: '数学',
    taskType: 'equation_setup',
    sourceIds: ['smartedu_basic_homework', 'public_exam_archetype'],
    pressureFamily: '方程、不等式、浓度、分段收费、年龄、利润、追及相遇',
    firstStepRule: '先设未知数，再写等量或不等量关系；不先心算结果。',
    wrongCauseSignals: ['x 代表谁不清楚', '等量关系少一边', '不等式方向变化漏掉'],
    boardMove: '小黑板只写“设 x = 谁”和一条关系线。',
    socraticProbe: '你设的 x 是哪个人、哪一段、还是哪个总量？',
    reportSignal: '报告记录“能否先设清未知数”。',
    memoryCadence: '连续两天只练设元和关系式，正确后才放开计算。',
    shareHook: '分享卡只问“x 代表谁”，适合家长一眼检查。',
    localGates: ['unknown_named', 'relation_written', 'calculation_locked_until_relation']
  },
  {
    id: 'physics_visual_model_cluster',
    subject: '物理',
    taskType: 'physics_diagram',
    sourceIds: ['moe_curriculum_standard', 'public_exam_archetype'],
    pressureFamily: '受力、光路、电路、压强、浮力、功率、图像',
    firstStepRule: '先定研究对象、方向、路径、单位和决定量，再画第一根箭头或第一条路径。',
    wrongCauseSignals: ['没定研究对象', '把亮暗当电路结构', '只看终点不看斜率'],
    boardMove: '小黑板只画对象框、箭头、电流路径或坐标斜率，不直接代公式。',
    socraticProbe: '这题先研究哪个物体或哪一段电路？方向从哪里到哪里？',
    reportSignal: '报告记录“物理图解入口是否明确”。',
    memoryCadence: '今晚补一张图解入口卡，明天换图不换方法，第 7 天混入公式题。',
    shareHook: '分享只显示“先画对象/路径/方向”，不显示原题图。',
    localGates: ['object_or_path_named', 'first_arrow_drawn', 'formula_delayed']
  },
  {
    id: 'chem_evidence_chain_cluster',
    subject: '化学',
    taskType: 'chemistry_experiment',
    sourceIds: ['moe_curriculum_standard', 'smartedu_basic_homework', 'public_exam_archetype'],
    pressureFamily: '实验现象、气体验证、溶液、守恒、酸碱、过滤、离子检验、曲线',
    firstStepRule: '先列反应前后物质、现象证据和体系边界，再判断变化方向。',
    wrongCauseSignals: ['只背现象不连物质', '体系边界没定', '曲线起点和方向没看'],
    boardMove: '小黑板只画“物质 -> 现象 -> 证据”和体系边界。',
    socraticProbe: '这个现象对应哪一种物质变化？有没有物质跑出体系？',
    reportSignal: '报告记录“证据链是否闭合”。',
    memoryCadence: '今晚 1 张现象证据卡，明天换试剂，第 7 天换曲线或装置。',
    shareHook: '分享只显示“孩子能否说出现象对应的证据链”。',
    localGates: ['substance_before_after', 'evidence_named', 'system_boundary_checked']
  },
  {
    id: 'english_signal_context_cluster',
    subject: '英语',
    taskType: 'english_sentence',
    sourceIds: ['moe_curriculum_standard', 'smartedu_basic_homework'],
    pressureFamily: '时态、比较、被动、从句、非谓语、完形上下文、逻辑连词',
    firstStepRule: '先圈时间词、连接词、先行词、承受者或前后文信号，再决定形式。',
    wrongCauseSignals: ['只看空格所在句', '信号词漏看', '凭语感选形式'],
    boardMove: '小黑板只写“信号词 -> 结构 -> 验证句”。',
    socraticProbe: '这个形式由哪个词、哪个从句或哪一句支持？',
    reportSignal: '报告记录“证据词是否先于答案出现”。',
    memoryCadence: '今晚练 3 个信号词，明天换语境，第 7 天混合时态和从句。',
    shareHook: '分享只显示“孩子能否先圈信号词”。',
    localGates: ['signal_word_found', 'structure_named', 'answer_form_delayed']
  },
  {
    id: 'reading_evidence_cluster',
    subject: '语文/英语',
    taskType: 'reading_question',
    sourceIds: ['moe_curriculum_standard', 'smartedu_basic_homework', 'public_exam_archetype'],
    pressureFamily: '概括、原因、指代、标题、说明方法、诗歌意象、语言效果、推断',
    firstStepRule: '先判断题型，再回原文定位证据句；不凭印象选答案。',
    wrongCauseSignals: ['复述情节代替回答', '离开原文凭感觉', '题型没判就答'],
    boardMove: '小黑板只画“题型 -> 证据句 -> 一句话结论”。',
    socraticProbe: '你选的这一句在原文哪一行能找到证据？',
    reportSignal: '报告记录“是否能把答案挂回证据”。',
    memoryCadence: '今晚 1 篇短文只练定位，明天换题型，第 7 天混合概括和推断。',
    shareHook: '分享只显示“孩子能否指出证据句”。',
    localGates: ['question_type_named', 'evidence_sentence_found', 'impression_answer_blocked']
  },
  {
    id: 'writing_process_cluster',
    subject: '语文',
    taskType: 'writing_process',
    sourceIds: ['moe_curriculum_standard', 'smartedu_basic_homework'],
    pressureFamily: '中心句、选材、细节、结尾照应、病句修改、片段扩写',
    firstStepRule: '先写一句事实、一个中心句或一个可见细节，不要求一次成文。',
    wrongCauseSignals: ['想一次写完整', '没有中心句', '只有评价没有细节'],
    boardMove: '小黑板只写“中心句 -> 例子 -> 可见细节”。',
    socraticProbe: '这一段只想说明哪一个意思？能不能先写一个看得见的动作？',
    reportSignal: '报告记录“是否从一小句启动”。',
    memoryCadence: '今晚 1 句启动，明天 3 句成段，第 7 天做一次改写。',
    shareHook: '分享只显示“孩子能否从一句具体事实开始”。',
    localGates: ['one_sentence_started', 'center_line_present', 'detail_visible']
  },
  {
    id: 'biology_process_cluster',
    subject: '生物',
    taskType: 'biology_process',
    sourceIds: ['moe_curriculum_standard', 'public_exam_archetype'],
    pressureFamily: '显微镜、光合呼吸、遗传、生态系统、人体循环、反射、能量流动',
    firstStepRule: '先分结构、功能、方向、变量、能量或调节路径。',
    wrongCauseSignals: ['结构和功能混在一起', '方向判断反了', '变量没分清'],
    boardMove: '小黑板只画“结构/条件 -> 过程 -> 结果”。',
    socraticProbe: '这是结构、功能、条件还是结果？箭头往哪里走？',
    reportSignal: '报告记录“过程箭头是否稳定”。',
    memoryCadence: '今晚 1 张过程箭头卡，明天换系统，第 7 天混入实验变量。',
    shareHook: '分享只显示“孩子能否说清过程方向”。',
    localGates: ['structure_function_split', 'direction_arrow_named', 'variable_checked']
  },
  {
    id: 'geography_spatial_cluster',
    subject: '地理',
    taskType: 'geography_map',
    sourceIds: ['moe_curriculum_standard', 'smartedu_basic_homework', 'public_exam_archetype'],
    pressureFamily: '经纬网、等高线、气候图、地球运动、河流、区位、季风',
    firstStepRule: '先看图例、方向、经纬、海拔、峰值月份、区位条件或成因链。',
    wrongCauseSignals: ['只看地图上下', '自转公转混淆', '只看温度不看降水'],
    boardMove: '小黑板只画方向箭头、峰值标记或成因链第一段。',
    socraticProbe: '这个判断先看图例、方向、月份，还是成因链？',
    reportSignal: '报告记录“空间规则是否先于结论”。',
    memoryCadence: '今晚 1 张图例卡，明天换图，第 7 天混合气候和区位。',
    shareHook: '分享只显示“孩子能否先说读图规则”。',
    localGates: ['map_rule_named', 'direction_or_legend_checked', 'cause_chain_started']
  }
];

const PUBLIC_K12_HOMEWORK_INTAKE_QUEUE = [
  {
    id: 'smartedu_math_ratio_percent',
    sourceId: 'smartedu_official_resource',
    sourceUrl: 'https://basic.smartedu.cn/',
    subject: '数学',
    taskType: 'math_word_problem',
    observedHomeworkShape: '分数、百分数、比例、比例尺和单位量作业常把“谁是整体”藏在题干里。',
    localPressureTransform: '转成基准量/单位量/总量第一步样本，不搬原题数字和答案。',
    socraticProbe: '这句话里谁是整体，谁是其中一份？',
    reportUse: '报告只写“基准量是否先说清”。',
    gameUse: '90 秒只练找整体和部分，不计排名。',
    shareHook: '分享成“整体是谁”挑战。',
    proofRequired: ['source_id', 'rewritten_stem', 'first_step_only', 'no_answer'],
    blockedUse: ['original_problem', 'final_answer', 'score_prediction']
  },
  {
    id: 'moe_math_equation_model',
    sourceId: 'moe_2022_curriculum_standard',
    sourceUrl: 'http://www.moe.gov.cn/',
    subject: '数学',
    taskType: 'equation_setup',
    observedHomeworkShape: '方程、不等式、分段收费、利润折扣题先考建模，不应先算。',
    localPressureTransform: '转成设元和关系式门槛，计算在第一步稳定后再开放。',
    socraticProbe: '你设的 x 代表谁？等号两边是不是同一件事？',
    reportUse: '报告记录“设元是否稳定”。',
    gameUse: '先做 3 张设元卡，再解锁计算卡。',
    shareHook: '分享成“x 代表谁”挑战。',
    proofRequired: ['unknown_named', 'relation_written', 'calculation_delayed'],
    blockedUse: ['copied_standard_text', 'full_solution', 'answer_bank']
  },
  {
    id: 'phet_physics_circuit_path',
    sourceId: 'phet_simulation_oer',
    sourceUrl: 'https://phet.colorado.edu/',
    subject: '物理',
    taskType: 'physics_diagram',
    observedHomeworkShape: '电路、光路、力学图像题需要先画路径/方向/对象。',
    localPressureTransform: '转成本地小黑板第一根箭头和路径卡，不嵌入外部仿真。',
    socraticProbe: '电流从哪里出发，在哪里分叉？',
    reportUse: '报告只写“路径是否先于公式”。',
    gameUse: '路径卡连续两次稳定后才放公式卡。',
    shareHook: '分享成“先画路径”挑战。',
    proofRequired: ['object_or_path_named', 'first_arrow_drawn', 'formula_delayed'],
    blockedUse: ['external_sim_embed', 'full_board_solution', 'final_answer']
  },
  {
    id: 'geogebra_geometry_function_visual',
    sourceId: 'geogebra_classroom_activity',
    sourceUrl: 'https://www.geogebra.org/',
    subject: '数学',
    taskType: 'math_word_problem',
    observedHomeworkShape: '几何角关系、函数图像和坐标题适合先看可视化关系。',
    localPressureTransform: '转成角关系/斜率/变量变化第一笔，不复制活动。',
    socraticProbe: '这张图先看角关系、坐标变化，还是函数斜率？',
    reportUse: '报告记录“图像规则是否先于计算”。',
    gameUse: '拖拽观察改成本地“说规则”卡。',
    shareHook: '分享成“先说图像规则”挑战。',
    proofRequired: ['visual_rule_named', 'no_external_embed', 'first_step_only'],
    blockedUse: ['activity_copy', 'unauthorized_embed', 'complete_solution']
  },
  {
    id: 'smartedu_chinese_reading_evidence',
    sourceId: 'smartedu_official_resource',
    sourceUrl: 'https://basic.smartedu.cn/',
    subject: '语文',
    taskType: 'reading_question',
    observedHomeworkShape: '阅读概括、标题作用、词语语境义和说明方法常卡在证据定位。',
    localPressureTransform: '转成题型 -> 证据句 -> 一句话结论的本地卡。',
    socraticProbe: '原文哪一句支持你的答案？',
    reportUse: '报告只写“是否能回到证据句”。',
    gameUse: '只练定位证据，不展示原文全文。',
    shareHook: '分享成“证据句挑战”。',
    proofRequired: ['question_type_named', 'evidence_sentence_found', 'impression_answer_blocked'],
    blockedUse: ['full_passage_copy', 'standard_answer', 'teacher_comment']
  },
  {
    id: 'moe_chinese_writing_process',
    sourceId: 'moe_2022_curriculum_standard',
    sourceUrl: 'http://www.moe.gov.cn/',
    subject: '语文',
    taskType: 'writing_process',
    observedHomeworkShape: '作文、片段扩写、病句修改应先从一句事实/中心句/可见细节启动。',
    localPressureTransform: '转成一句启动、三句成段、第 7 天改写的过程卡。',
    socraticProbe: '这一段只想说明哪一个意思？能不能先写一个看得见的动作？',
    reportUse: '报告记录“能否从一小句启动”。',
    gameUse: '写作不刷题，只做一句启动和改写回访。',
    shareHook: '分享成“一句话启动”挑战。',
    proofRequired: ['one_sentence_started', 'center_line_present', 'detail_visible'],
    blockedUse: ['essay_ghostwriting', 'copied_model_essay', 'score_promise']
  },
  {
    id: 'smartedu_english_signal_context',
    sourceId: 'smartedu_official_resource',
    sourceUrl: 'https://basic.smartedu.cn/',
    subject: '英语',
    taskType: 'english_sentence',
    observedHomeworkShape: '时态、比较、被动、从句、完形上下文都需要先圈信号词。',
    localPressureTransform: '转成信号词 -> 结构 -> 验证句三段卡。',
    socraticProbe: '哪个词或哪一句支持这个形式？',
    reportUse: '报告只写“证据词是否先于答案”。',
    gameUse: '3 张信号词卡稳定后再混合句型。',
    shareHook: '分享成“先圈信号词”挑战。',
    proofRequired: ['signal_word_found', 'structure_named', 'answer_form_delayed'],
    blockedUse: ['full_homework_sentence_public', 'translation_answer', 'grammar_answer_bank']
  },
  {
    id: 'khan_hint_ladder_english',
    sourceId: 'khan_academy_learning_design',
    sourceUrl: 'https://www.khanacademy.org/',
    subject: '英语',
    taskType: 'english_sentence',
    observedHomeworkShape: '语言题更适合提示层级，而不是一次性给规则和答案。',
    localPressureTransform: '本地决定提示层级和停止条件，AI 只把追问改写成中文儿童语气。',
    socraticProbe: '先找证据词；如果还卡住，只给二选一微提示。',
    reportUse: '报告记录提示层级是否减少。',
    gameUse: '连续两次少提示才给 XP。',
    shareHook: '分享成“少提示挑战”。',
    proofRequired: ['hint_level_local', 'no_direct_answer', 'xp_not_by_ai'],
    blockedUse: ['khan_content_copy', 'khanmigo_claim', 'external_mastery_import']
  },
  {
    id: 'phet_chem_variable_evidence',
    sourceId: 'phet_simulation_oer',
    sourceUrl: 'https://phet.colorado.edu/',
    subject: '化学',
    taskType: 'chemistry_experiment',
    observedHomeworkShape: '溶液、酸碱、速率、气体验证常卡在变量、现象和体系边界。',
    localPressureTransform: '转成物质 -> 现象 -> 证据 -> 体系边界卡，不生成实验结论。',
    socraticProbe: '现象对应哪种物质变化？有没有物质跑出体系？',
    reportUse: '报告记录“证据链是否闭合”。',
    gameUse: '先定唯一变量，再做小变式。',
    shareHook: '分享成“证据链挑战”。',
    proofRequired: ['substance_before_after', 'evidence_named', 'system_boundary_checked'],
    blockedUse: ['lab_conclusion_by_ai', 'unsafe_experiment_instruction', 'full_solution']
  },
  {
    id: 'openstax_chem_concept_ladder',
    sourceId: 'openstax_high_school_reference',
    sourceUrl: 'https://openstax.org/',
    subject: '化学',
    taskType: 'chemistry_experiment',
    observedHomeworkShape: '微粒观、守恒、溶解度和酸碱概念需要概念前置阶梯。',
    localPressureTransform: '转成概念前置检查和年龄段降阶卡，不搬教材段落。',
    socraticProbe: '这一步是在看微粒、质量守恒，还是溶液中的量？',
    reportUse: '报告记录“前置概念是否缺口”。',
    gameUse: '前置概念未过不放综合题。',
    shareHook: '分享成“先分概念层级”挑战。',
    proofRequired: ['age_band_checked', 'concept_ladder_local', 'no_copied_text'],
    blockedUse: ['copied_paragraph', 'textbook_exercise_answer', 'over_grade_content']
  },
  {
    id: 'libretexts_biology_process',
    sourceId: 'libretexts_stem_reference',
    sourceUrl: 'https://libretexts.org/',
    subject: '生物',
    taskType: 'biology_process',
    observedHomeworkShape: '光合呼吸、遗传、生态系统、人体循环需要结构/条件/过程/结果分格。',
    localPressureTransform: '转成本地四格过程箭头，不搬教材解释。',
    socraticProbe: '这是结构、条件、过程还是结果？箭头往哪里走？',
    reportUse: '报告记录“过程箭头是否稳定”。',
    gameUse: '四格说清后才解锁混合系统题。',
    shareHook: '分享成“四格过程挑战”。',
    proofRequired: ['structure_function_split', 'direction_arrow_named', 'variable_checked'],
    blockedUse: ['copied_textbook_paragraph', 'exercise_answer', 'medical_advice']
  },
  {
    id: 'ck12_biology_adaptive_recall',
    sourceId: 'ck12_flexbook_practice',
    sourceUrl: 'https://www.ck12.org/',
    subject: '生物',
    taskType: 'biology_process',
    observedHomeworkShape: '生物概念常需要自适应复习，但不能导入外部分数。',
    localPressureTransform: '转成本地 leech rule、回访窗口和变式解锁。',
    socraticProbe: '这次错因是结构、功能、条件还是结果混了？',
    reportUse: '报告记录错因复现，不导入外部分数。',
    gameUse: '连续错同一轴则降阶，不靠题量发 XP。',
    shareHook: '分享成“错因复现挑战”。',
    proofRequired: ['wrong_cause_reappears', 'local_recall_policy', 'no_external_score_import'],
    blockedUse: ['external_score_import', 'copied_question', 'ranking_share']
  },
  {
    id: 'smartedu_geography_map_rule',
    sourceId: 'smartedu_official_resource',
    sourceUrl: 'https://basic.smartedu.cn/',
    subject: '地理',
    taskType: 'geography_map',
    observedHomeworkShape: '经纬网、等高线、气候图、区位题先读图例、方向、月份和成因链。',
    localPressureTransform: '转成读图规则和成因链第一段，不搬地图原图。',
    socraticProbe: '这张图先看图例、方向、月份，还是成因链？',
    reportUse: '报告记录“空间规则是否先于结论”。',
    gameUse: '读图规则稳定后再换图迁移。',
    shareHook: '分享成“读图规则挑战”。',
    proofRequired: ['map_rule_named', 'direction_or_legend_checked', 'cause_chain_started'],
    blockedUse: ['map_image_copy', 'full_answer', 'school_location']
  },
  {
    id: 'openstax_geo_science_concept',
    sourceId: 'openstax_high_school_reference',
    sourceUrl: 'https://openstax.org/',
    subject: '地理',
    taskType: 'geography_map',
    observedHomeworkShape: '地球运动、气候、板块和水循环适合概念链和图示链。',
    localPressureTransform: '转成概念链第一段和图示方向卡，按小初年龄降阶。',
    socraticProbe: '这个结论先来自方向、位置，还是成因链？',
    reportUse: '报告记录概念链是否断在第一段。',
    gameUse: '图示方向卡和成因链卡交替回访。',
    shareHook: '分享成“成因链第一段”挑战。',
    proofRequired: ['age_band_checked', 'cause_chain_started', 'first_step_only'],
    blockedUse: ['copied_paragraph', 'over_grade_content', 'complete_solution']
  },
  {
    id: 'oer_math_data_table_model',
    sourceId: 'openup_illustrative_math_structure',
    sourceUrl: 'https://www.openupresources.org/',
    subject: '数学',
    taskType: 'data_table_reasoning',
    observedHomeworkShape: '统计表、折线图和平均数作业容易直接算，没先说清横轴、纵轴、单位和比较对象。',
    localPressureTransform: '转成本地表格读法第一步卡：先说对象、单位、变化方向，不复制公开题目或答案。',
    socraticProbe: '这张表先看对象、单位，还是变化方向？你第一句准备说什么？',
    reportUse: '报告只记录“表格规则是否先于计算”，不写分数或排名。',
    gameUse: '本地 90 秒只练对象/单位/趋势三张卡，不导入原题。',
    shareHook: '分享成“先读表格三件事”挑战。',
    proofRequired: ['axis_or_unit_named', 'trend_named', 'no_original_table'],
    blockedUse: ['original_problem', 'full_answer', 'ranking_share']
  },
  {
    id: 'oer_chinese_argument_evidence',
    sourceId: 'moe_2022_curriculum_standard',
    sourceUrl: 'http://www.moe.gov.cn/',
    subject: '语文',
    taskType: 'argument_reading',
    observedHomeworkShape: '议论文阅读常把论点、论据、论证方法混在一起，孩子会背术语但不会定位证据。',
    localPressureTransform: '转成本地论点-论据-方法三格卡，只练定位关系，不搬原文段落。',
    socraticProbe: '这句话是在提观点、给证据，还是说明怎么证明？',
    reportUse: '报告写“论点和论据是否能对应”，不贴阅读能力标签。',
    gameUse: '本地错因卡只练一条论据对应一个观点，不刷整篇阅读。',
    shareHook: '分享成“观点和证据配对”挑战。',
    proofRequired: ['claim_named', 'evidence_linked', 'no_full_passage'],
    blockedUse: ['full_passage_copy', 'standard_answer', 'ranking_share']
  },
  {
    id: 'oer_english_listening_dictation_signal',
    sourceId: 'common_core_language_anchor',
    sourceUrl: 'https://www.thecorestandards.org/',
    subject: '英语',
    taskType: 'dictation_sentence',
    observedHomeworkShape: '听写和句子默写常卡在音节、词形变化和句子骨架，家长容易直接报答案。',
    localPressureTransform: '转成本地音节-词形-句子骨架检查卡，只练孩子自己复述，不公开完整句子。',
    socraticProbe: '这个词先拆音节、看词形变化，还是放回句子骨架？',
    reportUse: '报告记录“听写错误属于音节、词形还是句架”，不承诺提分。',
    gameUse: '本地回忆卡只练一个信号词和一个句架，不做排名。',
    shareHook: '分享成“少提示听写”挑战。',
    proofRequired: ['sound_or_form_named', 'sentence_frame_named', 'no_full_sentence_public'],
    blockedUse: ['full_homework_sentence_public', 'translation_answer', 'ranking_share']
  },
  {
    id: 'oer_physics_graph_motion',
    sourceId: 'phet_simulation_oer',
    sourceUrl: 'https://phet.colorado.edu/',
    subject: '物理',
    taskType: 'physics_graph',
    observedHomeworkShape: '运动图像、v-t 图和 s-t 图容易先套公式，没先读轴、斜率和面积含义。',
    localPressureTransform: '转成本地图像读轴第一步卡，不嵌入外部仿真，不复制原题图。',
    socraticProbe: '横轴、纵轴各表示什么？这段线先看斜率还是面积？',
    reportUse: '报告记录“读轴是否先于公式”，不写掌握结论。',
    gameUse: '本地小黑板只画轴和一段趋势，再锁定明天回访。',
    shareHook: '分享成“先读轴再公式”挑战。',
    proofRequired: ['axis_named', 'slope_or_area_named', 'formula_delayed'],
    blockedUse: ['external_sim_embed', 'full_answer', 'ranking_share']
  },
  {
    id: 'oer_physics_energy_transfer',
    sourceId: 'openstax_high_school_reference',
    sourceUrl: 'https://openstax.org/',
    subject: '物理',
    taskType: 'physics_energy',
    observedHomeworkShape: '功、能量、热量和机械效率题容易先套公式，没先说清能量从哪里来、到哪里去、损失在哪里。',
    localPressureTransform: '转成本地能量去向第一步卡，不复制原题和完整解法。',
    socraticProbe: '能量从谁转给谁？中间有没有损失或做功对象？',
    reportUse: '报告记录“能量去向是否先于公式”，不写分数预测。',
    gameUse: '本地只练一条能量箭头和一个损失点，不按速度奖励。',
    shareHook: '分享成“先画能量箭头”挑战。',
    proofRequired: ['energy_source_named', 'transfer_direction_named', 'formula_delayed'],
    blockedUse: ['copied_problem', 'full_answer', 'ranking_share']
  },
  {
    id: 'oer_chem_equation_conservation',
    sourceId: 'openstax_high_school_reference',
    sourceUrl: 'https://openstax.org/',
    subject: '化学',
    taskType: 'chemistry_equation',
    observedHomeworkShape: '化学方程式配平容易机械凑系数，没先确认反应物、生成物和守恒对象。',
    localPressureTransform: '转成本地反应前后守恒检查卡，不搬教材例题或完整答案。',
    socraticProbe: '反应前后哪些原子必须守恒？你先数哪一种？',
    reportUse: '报告记录“守恒对象是否先说清”，不做自动判分。',
    gameUse: '本地 90 秒只练先数一种原子，再决定是否继续。',
    shareHook: '分享成“先找守恒对象”挑战。',
    proofRequired: ['reactant_product_named', 'one_atom_counted', 'no_answer_key'],
    blockedUse: ['textbook_exercise_answer', 'full_answer', 'ranking_share']
  },
  {
    id: 'oer_biology_ecology_evidence_chain',
    sourceId: 'ck12_flexbook_practice',
    sourceUrl: 'https://www.ck12.org/',
    subject: '生物',
    taskType: 'biology_ecology_chain',
    observedHomeworkShape: '生态系统、食物链和能量流动作业容易背结论，没先说清对象、方向和证据。',
    localPressureTransform: '转成本地对象-方向-证据链卡，不复制题库和答案。',
    socraticProbe: '能量或物质从谁到谁？中间证据是什么？',
    reportUse: '报告记录“方向箭头是否稳定”，不写长期天赋或能力定性。',
    gameUse: '本地回忆只练一条箭头和一个证据点，不按速度奖励。',
    shareHook: '分享成“方向箭头挑战”。',
    proofRequired: ['object_named', 'direction_arrow_named', 'evidence_named'],
    blockedUse: ['copied_question', 'full_answer', 'ranking_share']
  },
  {
    id: 'oer_geography_population_region',
    sourceId: 'smartedu_official_resource',
    sourceUrl: 'https://basic.smartedu.cn/',
    subject: '地理',
    taskType: 'geography_region_analysis',
    observedHomeworkShape: '人口、产业、交通和区域差异题容易直接背结论，没先分位置、条件和因果链。',
    localPressureTransform: '转成本地区域三问卡：在哪、有什么条件、导致什么结果，不展示原图或原题。',
    socraticProbe: '这个区域先看位置、自然条件，还是人文条件？',
    reportUse: '报告记录“区域分析三问是否成型”，不写学校或班级比较。',
    gameUse: '本地小卡只练位置-条件-结果一条链，再做第 7 天迁移。',
    shareHook: '分享成“区域三问”挑战。',
    proofRequired: ['location_named', 'condition_named', 'cause_effect_started'],
    blockedUse: ['map_image_copy', 'full_answer', 'ranking_share']
  }
];

const LONGITUDINAL_PRESSURE_SCENARIO_LEDGER = [
  {
    id: 'math_ratio_recurrence',
    subject: '数学',
    taskType: 'math_word_problem',
    recurringWrongCause: '连续百分数和比例题反复换错基准量',
    evidenceWindow: ['今晚第一步', '明天同错因回访', '第 7 天近迁移'],
    localReleaseGate: '同错因少于 2 次稳定复述前，只释放基准量复习动作，不释放掌握结论。',
    reportDecision: '写“本周先稳定基准量是谁”，不写“已掌握比例应用题”。',
    parentHandoff: '家长只问：这次百分数变化的基准量是谁？',
    shareBoundary: '分享只显示“基准量挑战第 2 天”，不显示原题、答案或作答结果。'
  },
  {
    id: 'physics_circuit_recurrence',
    subject: '物理',
    taskType: 'physics_diagram',
    recurringWrongCause: '串并联电流路径和电表位置反复混淆',
    evidenceWindow: ['今晚第一根箭头', '明天路径回忆', '第 7 天换电路图'],
    localReleaseGate: '未先画路径和电表位置前，只释放路径卡，不释放电学图像稳定结论。',
    reportDecision: '写“先画路径再判断电表”，不写“电学已经掌握”。',
    parentHandoff: '家长只问：电流从哪里出发，在哪里分叉？',
    shareBoundary: '分享只显示“先画路径挑战”，不显示电路原图或完整解法。'
  },
  {
    id: 'chinese_evidence_recurrence',
    subject: '语文',
    taskType: 'reading_question',
    recurringWrongCause: '阅读题凭印象作答，没有回原文定位证据句',
    evidenceWindow: ['今晚证据句', '明天题型回忆', '第 7 天换文本迁移'],
    localReleaseGate: '未连续给出证据句前，只释放定位动作，不做长期阅读画像判断。',
    reportDecision: '写“先指出证据句”，不写“阅读理解长期薄弱”。',
    parentHandoff: '家长只问：原文哪一句支持你的答案？',
    shareBoundary: '分享只显示“证据句挑战”，不带原文全文、答案或老师点评。'
  },
  {
    id: 'chem_system_boundary_recurrence',
    subject: '化学',
    taskType: 'chemistry_experiment',
    recurringWrongCause: '溶液和气体实验反复漏看体系边界',
    evidenceWindow: ['今晚体系边界', '明天证据链', '第 7 天换试剂'],
    localReleaseGate: '体系边界和证据链未闭合前，只释放小黑板，不写实验掌握。',
    reportDecision: '写“先定体系边界”，不写“化学实验已掌握”。',
    parentHandoff: '家长只问：反应前后哪些物质还在体系里？',
    shareBoundary: '分享只显示“体系边界挑战”，不显示实验原题答案。'
  },
  {
    id: 'geo_map_rule_recurrence',
    subject: '地理',
    taskType: 'geography_map',
    recurringWrongCause: '气候图和等高线题反复先看结论，不先读图例规则',
    evidenceWindow: ['今晚读图规则', '明天坐标/图例回忆', '第 7 天换图迁移'],
    localReleaseGate: '未先说图例、方向、月份或成因链前，不写空间思维长期标签。',
    reportDecision: '写“先说读图规则”，不写“空间思维长期落后”。',
    parentHandoff: '家长只问：这张图先看图例、方向还是月份？',
    shareBoundary: '分享只显示“读图规则挑战”，不显示学校班级和作答结果。'
  },
  {
    id: 'english_signal_recurrence',
    subject: '英语',
    taskType: 'english_sentence',
    recurringWrongCause: '时态和从句题反复不先圈信号词',
    evidenceWindow: ['今晚信号词', '明天上下文回忆', '第 7 天混合句型'],
    localReleaseGate: '答案前未出现信号词和上下文证据前，不释放语法系统掌握。',
    reportDecision: '写“先圈信号词和证据句”，不写“语法已系统掌握”。',
    parentHandoff: '家长只问：哪个词或哪句话支持这个形式？',
    shareBoundary: '分享只显示“信号词挑战”，不显示完整作业句子。'
  },
  {
    id: 'biology_process_recurrence',
    subject: '生物',
    taskType: 'biology_process',
    recurringWrongCause: '过程题反复把结构、功能、条件和结果混在一起',
    evidenceWindow: ['今晚过程箭头', '明天结构功能拆分', '第 7 天换系统'],
    localReleaseGate: '未能拆出结构、条件、过程和结果前，不写生物过程已掌握。',
    reportDecision: '写“先分四格”，不写“理解力差”或“已掌握”。',
    parentHandoff: '家长只问：这是结构、条件、过程还是结果？',
    shareBoundary: '分享只显示“四格过程挑战”，不显示原题图。'
  }
];

function validatePublicK12AssetBoundary(asset = {}) {
  const forbiddenFields = [
    'original_problem',
    'original_question',
    'standard_answer',
    'full_answer',
    'full_solution',
    'answer_key',
    'score_prediction',
    'ranking'
  ];
  const text = JSON.stringify(asset || {});
  const blockedUse = Array.isArray(asset.blockedUse) ? asset.blockedUse : [];
  const evidence = Array.isArray(asset.proofRequired)
    ? asset.proofRequired
    : Array.isArray(asset.evidenceRequired)
      ? asset.evidenceRequired
      : [];
  const hasTransform = !!(asset.localPressureTransform || asset.localTransform || asset.transformMode);
  const noForbiddenField = forbiddenFields.every((field) => !Object.prototype.hasOwnProperty.call(asset, field));
  const noAnswerBankClaim = !/标准答案库|原题答案库|拍照搜题|押题|排名预测/.test(text);
  const boundaryReady = !!asset.sourceId
    && hasTransform
    && evidence.length >= 3
    && blockedUse.length >= 2
    && noForbiddenField
    && noAnswerBankClaim;
  return {
    id: asset.id || 'public_k12_asset',
    sourceId: asset.sourceId || '',
    boundaryReady,
    localRuleDecision: true,
    aiUse: 'AI 只改写追问、家长解释和小黑板旁白，不决定来源可用性、奖励、放行或分享字段。',
    required: ['sourceId', 'localPressureTransform', 'proofRequired', 'blockedUse', 'no_forbidden_fields'],
    forbiddenFields,
    missing: [
      asset.sourceId ? '' : 'sourceId',
      hasTransform ? '' : 'localPressureTransform',
      evidence.length >= 3 ? '' : 'proofRequired>=3',
      blockedUse.length >= 2 ? '' : 'blockedUse>=2',
      noForbiddenField ? '' : 'forbidden_field_present',
      noAnswerBankClaim ? '' : 'answer_bank_claim'
    ].filter(Boolean)
  };
}

function buildPublicK12AssetBoundaryAudit(options = {}) {
  const assets = Array.isArray(options.assets) ? options.assets : PUBLIC_K12_HOMEWORK_INTAKE_QUEUE;
  const rows = assets.map(validatePublicK12AssetBoundary);
  const readyCount = rows.filter((item) => item.boundaryReady).length;
  return {
    id: 'public_k12_asset_boundary_audit',
    title: '公开 K12 资料使用边界审计',
    readyCount,
    totalCount: rows.length,
    ok: rows.length > 0 && readyCount === rows.length,
    rows,
    localDecisionLine: '本地代码决定来源、字段、放行和分享；AI 只做中文表达和追问语气。',
    antiFakeThicknessLine: '公开资料必须先改写为第一步/错因/回访挑战，禁止原题、标准答案、排名预测和拍照搜题承诺。'
  };
}

function buildPublicK12IntakeChallengeDeckLegacy(options = {}) {
  const limit = Number(options.limit || PUBLIC_K12_HOMEWORK_INTAKE_QUEUE.length);
  return PUBLIC_K12_HOMEWORK_INTAKE_QUEUE.slice(0, limit).map((item, index) => ({
    id: `public_k12_intake_${item.id || index + 1}`,
    sourceId: item.sourceId,
    sourceUrl: item.sourceUrl,
    subject: item.subject,
    taskType: item.taskType,
    title: `${item.subject} · ${displayLabel(item.taskType)} · 90秒第一步挑战`,
    prompt: item.observedHomeworkShape,
    firstStepPrompt: item.socraticProbe,
    localTransform: item.localPressureTransform,
    reportUse: item.reportUse,
    gameUse: item.gameUse,
    shareHook: item.shareHook,
    observableFirstMove: item.socraticProbe,
    microRubric: [
      '孩子先说第一步',
      '能命名一个错因',
      '约定明天回访，不看完整答案'
    ],
    fallbackIfNoChildInput: '如果孩子说不出第一步，只给 A/B 二选一提示，不进入完整讲解。',
    receiverMustUseOwnMaterial: true,
    shareSafeFields: ['subject', 'taskType', 'firstStepPrompt', 'shareHook', 'nextDayRevisit'],
    route: `/pages/arcade/arcade?from=public_k12_intake&task_type=${encodeURIComponent(item.taskType)}`,
    answerBoundary: '只练第一步、错因和回访，不展示原题、答案、分数或排名。',
    evidenceRequired: item.proofRequired,
    blockedUse: item.blockedUse,
    releaseGate: [
      'receiver_uses_own_material',
      'first_step_spoken_before_answer',
      'parent_check_present',
      'next_day_revisit_scheduled'
    ],
    localOwner: 'local_rule',
    aiOwner: 'ai_wording_only'
  }));
}

function buildPublicK12IntakeChallengeDeck(options = {}) {
  const limit = Number(options.limit || PUBLIC_K12_HOMEWORK_INTAKE_QUEUE.length);
  const blockedFields = [
    'source_original_text',
    'original_question',
    'original_answer',
    'original_photo',
    'full_solution',
    'full_dialogue',
    'score',
    'ranking',
    'private_comment'
  ];
  const shareSafeFields = [
    'deck_id',
    'source_id',
    'subject',
    'task_type',
    'observable_first_move',
    'fallback_if_no_child_input',
    'receiver_must_use_own_material',
    'next_route'
  ];
  const localCodeOwns = [
    'source_route',
    'task_type_route',
    'observable_first_move_gate',
    'fallback_gate',
    'review_card_material_policy',
    'share_safe_fields',
    'blocked_fields',
    'xp_and_unlock_gate'
  ];
  const aiBetterFor = [
    'socratic_prompt_wording',
    'parent_friendly_explanation',
    'encouraging_hint_variants'
  ];
  const aiMustNotOwn = [
    'final_answer',
    'source_rights_decision',
    'receiver_material_decision',
    'share_release_decision',
    'score_or_ranking_claim',
    'mastery_claim_without_revisit'
  ];
  return PUBLIC_K12_HOMEWORK_INTAKE_QUEUE.slice(0, limit).map((item, index) => {
    const cardId = `public_k12_intake_${item.id || index + 1}`;
    const taskType = item.taskType || 'unknown';
    const route = `/pages/tutor/tutor?from=public_k12_intake&task_type=${encodeURIComponent(taskType)}&challenge_id=${encodeURIComponent(cardId)}&subject=${encodeURIComponent(item.subject || '')}`;
    const arcadeRoute = `/pages/arcade/arcade?from=public_k12_intake&task_type=${encodeURIComponent(taskType)}&challenge_id=${encodeURIComponent(cardId)}`;
    const reviewRoute = `/pages/review/review?from=public_k12_intake&task_type=${encodeURIComponent(taskType)}&challenge_id=${encodeURIComponent(cardId)}`;
    const observableFirstMove = item.socraticProbe || item.localPressureTransform || item.observedHomeworkShape;
    const fallbackIfNoChildInput = 'Offer only an A/B first-step hint, then ask the child to use their own homework material; do not explain the full solution.';
    return {
      id: cardId,
      sourceId: item.sourceId,
      sourceUrl: item.sourceUrl,
      subject: item.subject,
      taskType,
      title: `${item.subject} - ${displayLabel(taskType)} - 90s first-move challenge`,
      prompt: item.observedHomeworkShape,
      firstStepPrompt: observableFirstMove,
      localTransform: item.localPressureTransform,
      reportUse: item.reportUse,
      gameUse: item.gameUse,
      shareHook: item.shareHook,
      observableFirstMove,
      microRubric: [
        'child_names_first_move_before_answer',
        'child_names_one_wrong_cause',
        'next_day_revisit_locked_without_full_solution'
      ],
      fallbackIfNoChildInput,
      receiverMustUseOwnMaterial: true,
      shareSafeFields: shareSafeFields.slice(),
      blockedFields: blockedFields.slice(),
      route,
      arcadeRoute,
      reviewRoute,
      nextPracticePlan: {
        appRoute: reviewRoute,
        arcadeRoute,
        wrongCauseBucket: taskType,
        wrongCauseLabel: item.localPressureTransform,
        checkpoint: observableFirstMove,
        parentPrompt: item.shareHook,
        nextPracticeText: item.gameUse,
        receiverMustUseOwnMaterial: true,
        blockedFields: blockedFields.slice()
      },
      reviewCard: {
        id: `${cardId}_review`,
        type: 'public_k12_homework_intake',
        sourceChallengeId: cardId,
        route: reviewRoute,
        arcadeRoute,
        prompt: item.observedHomeworkShape,
        answer: observableFirstMove,
        blockedFields: blockedFields.slice()
      },
      answerBoundary: 'Practice only first move, wrong cause, and revisit. Do not show source question, full answer, score, ranking, photo, or full dialogue. 不展示原题',
      evidenceRequired: item.proofRequired,
      blockedUse: item.blockedUse,
      releaseGate: [
        'receiver_uses_own_material',
        'observable_first_move_before_answer',
        'fallback_does_not_give_solution',
        'parent_check_present',
        'next_day_revisit_scheduled',
        'share_payload_uses_allowlist'
      ],
      localCodeOwns: localCodeOwns.slice(),
      aiBetterFor: aiBetterFor.slice(),
      aiMustNotOwn: aiMustNotOwn.slice(),
      localOwner: 'local_rule',
      aiOwner: 'ai_wording_only'
    };
  });
}

const UNIFIED_K12_SOURCE_BLOCKLIST = [
  'source_original_text',
  'source_question',
  'source_answer',
  'source_image',
  'full_solution',
  'answer_key',
  'official_partnership_claim',
  'photo_search_claim'
];

const UNIFIED_K12_ALLOWED_DERIVED_ARTIFACTS = [
  'capability_axis',
  'first_step_card',
  'wrong_cause_card',
  'visual_board_move',
  'next_day_revisit',
  'parent_check_line',
  'share_safe_prompt'
];

function normalizeUnifiedK12SourceRegistryEntry(entry = {}, index = 0, defaults = {}) {
  const sourceRegistryId = entry.sourceRegistryId || entry.id || `k12_source_${index + 1}`;
  const mustNotSurface = Array.from(new Set([]
    .concat(UNIFIED_K12_SOURCE_BLOCKLIST)
    .concat(entry.mustNotSurface || entry.mustNotUse || defaults.mustNotSurface || [])));
  const allowedDerivedArtifacts = Array.from(new Set([]
    .concat(entry.allowedDerivedArtifacts || defaults.allowedDerivedArtifacts || UNIFIED_K12_ALLOWED_DERIVED_ARTIFACTS)
    .filter((item) => item !== 'full_solution' && item !== 'answer_key')));
  return {
    sourceRegistryId,
    label: entry.label || sourceRegistryId,
    sourceKind: entry.sourceKind || entry.sourceType || defaults.sourceKind || 'public_k12_structure',
    sourceUrl: entry.sourceUrl || defaults.sourceUrl || '',
    licenseSignal: entry.licenseSignal || defaults.licenseSignal || 'license_check_required_before_distribution',
    licenseCheckedAt: entry.licenseCheckedAt || defaults.licenseCheckedAt || '2026-05-20',
    releaseDecision: entry.releaseDecision || defaults.releaseDecision || 'allow_structure_only_no_source_content',
    reuseScope: entry.reuseScope || entry.reuseLevel || defaults.reuseScope || 'structure_only',
    distributionPolicy: entry.distributionPolicy || defaults.distributionPolicy || 'derived_cards_only_no_original_content',
    commercialDecision: entry.commercialDecision || defaults.commercialDecision || 'Use only as structure and teaching-design reference; do not redistribute original content or answers.',
    allowedDerivedArtifacts,
    mustNotSurface,
    aiBetterFor: entry.aiBetterFor || entry.aiFit || defaults.aiBetterFor || ['socratic_wording', 'parent_friendly_explanation'],
    localCodeFit: entry.localCodeFit || entry.localizeAsCode || defaults.localCodeFit || ['release_gate', 'answer_boundary', 'review_interval', 'share_blocklist'],
    answerVisibility: entry.answerVisibility || defaults.answerVisibility || 'first_step_only_no_full_answer',
    attributionRequired: entry.attributionRequired !== undefined ? !!entry.attributionRequired : true,
    userRightsRequired: entry.userRightsRequired !== undefined ? !!entry.userRightsRequired : false,
    originalTextIncluded: false,
    fakeCapabilityBlocked: true
  };
}

function buildUnifiedK12SourceRegistry(options = {}) {
  const oerRows = (options.resources || PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER).map((item, index) => normalizeUnifiedK12SourceRegistryEntry(item, index, {
    sourceKind: 'oer_or_public_reference',
    releaseDecision: 'allow_structure_only_after_license_check',
    reuseScope: item.reuseLevel || 'structure_only',
    distributionPolicy: 'do_not_copy_or_embed_external_content'
  }));
  const structuralRows = [
    {
      sourceRegistryId: 'china_textbook_index_structure',
      label: 'ChinaTextbook structure index',
      sourceKind: 'textbook_structure_index_only',
      sourceUrl: 'src/curriculum/textbook-index.json',
      licenseSignal: 'local_index_metadata_not_distribution_license',
      releaseDecision: 'allow_chapter_structure_only_block_original_text',
      reuseScope: 'chapter_title_and_structure_only',
      distributionPolicy: 'never_ship_pdf_or_extracted_text_to_miniapp',
      commercialDecision: 'Use textbook catalog shape to route grade/chapter capability; do not copy textbook text, images, exercises, or answers.',
      localCodeFit: ['grade_chapter_route', 'capability_axis', 'course_unit_spine', 'source_registry_gate'],
      aiBetterFor: ['rewrite_catalog_hint_into_parent_friendly_prompt']
    },
    {
      sourceRegistryId: 'learning_asset_index_structure',
      label: 'Learning asset chapter index',
      sourceKind: 'chapter_structure_index_only',
      sourceUrl: 'src/curriculum/learning-asset-index.json',
      licenseSignal: 'derived_index_requires_per_asset_license_check',
      releaseDecision: 'allow_summary_structure_only_block_passage_copy',
      reuseScope: 'knowledge_node_and_chapter_summary_only',
      distributionPolicy: 'miniapp_receives_tags_not_original_passages',
      commercialDecision: 'Use chapter-level metadata for coverage planning and prerequisite ladders; do not surface original passages or copied exercises.',
      localCodeFit: ['prerequisite_ladder', 'coverage_gap_queue', 'report_dimension', 'question_type_backlog'],
      aiBetterFor: ['turn_known_prerequisite_into_child_friendly_question']
    },
    {
      sourceRegistryId: 'generated_question_bank_structure',
      label: 'Generated question-bank structure',
      sourceKind: 'generated_structure_human_review_required',
      sourceUrl: 'src/curriculum/seed-questions-generated.json',
      licenseSignal: 'generated_content_needs_review_and_source_boundary',
      releaseDecision: 'allow_reviewed_first_step_only_block_answer_key',
      reuseScope: 'reviewed_pattern_and_first_step_only',
      distributionPolicy: 'answers_remain_hidden_until_local_evidence_gate',
      commercialDecision: 'Generated cards can drive local practice only after review; never present generated answers as official standard answers.',
      localCodeFit: ['human_review_gate', 'first_step_gate', 'near_transfer_gate', 'answer_visibility_gate'],
      aiBetterFor: ['create_alternate_socratic_wording_after_local_gate']
    },
    {
      sourceRegistryId: 'first_party_family_upload',
      label: 'Family uploaded talent report / wrong paper',
      sourceKind: 'first_party_user_provided_material',
      sourceUrl: 'miniapp_upload_input',
      licenseSignal: 'user_provided_for_private_family_report_only',
      releaseDecision: 'allow_private_report_only_no_public_distribution',
      reuseScope: 'private_family_decision_memo',
      distributionPolicy: 'never_share_raw_child_material_or_private_report',
      commercialDecision: 'Use only for the family decision book, talent-learning fit, wrong-cause evidence, and next action; do not train public cards from private uploads.',
      localCodeFit: ['privacy_gate', 'report_release_gate', 'required_next_evidence', 'share_safe_redaction'],
      aiBetterFor: ['parent_friendly_summary_after_redaction'],
      userRightsRequired: true
    }
  ].map((item, index) => normalizeUnifiedK12SourceRegistryEntry(item, oerRows.length + index));
  return oerRows.concat(structuralRows);
}

function buildCurriculumAssetSourceAudit(options = {}) {
  const registry = options.registry || buildUnifiedK12SourceRegistry(options);
  const riskyRows = registry.filter((item) => {
    const blocked = Array.isArray(item.mustNotSurface) ? item.mustNotSurface : [];
    const allowed = Array.isArray(item.allowedDerivedArtifacts) ? item.allowedDerivedArtifacts : [];
    return !item.sourceRegistryId
      || !item.releaseDecision
      || !item.reuseScope
      || !item.distributionPolicy
      || UNIFIED_K12_SOURCE_BLOCKLIST.some((field) => !blocked.includes(field))
      || allowed.includes('full_solution')
      || allowed.includes('answer_key')
      || item.originalTextIncluded !== false;
  });
  const rowsByKind = registry.reduce((acc, item) => {
    const key = item.sourceKind || 'unknown';
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    id: 'curriculum_asset_source_audit',
    ok: riskyRows.length === 0,
    totalRows: registry.length,
    readyCount: registry.length - riskyRows.length,
    riskyRows: riskyRows.map((item) => item.sourceRegistryId),
    rowsByKind,
    blockedFields: UNIFIED_K12_SOURCE_BLOCKLIST,
    requiredFields: ['sourceRegistryId', 'licenseSignal', 'releaseDecision', 'reuseScope', 'distributionPolicy', 'allowedDerivedArtifacts', 'mustNotSurface'],
    releaseLine: `Unified source registry covers ${registry.length} K12/OER/textbook/upload sources with structure-only, no-answer, no-original-content gates.`,
    localCodeOwns: ['source_registry_gate', 'answer_visibility_gate', 'privacy_gate', 'share_safe_redaction', 'release_decision'],
    aiOwns: ['socratic_wording', 'parent_friendly_summary', 'alternate_first_step_phrasing'],
    stopRule: 'If a source cannot prove rights or structure-only reuse, keep it out of public miniapp cards.'
  };
}

function buildK12ContentExpansionQueue(options = {}) {
  const subjectRows = Array.isArray(options.subjectRows) ? options.subjectRows : countRowsFromSamples([], 'subject', SUBJECT_COUNTS);
  const typeRows = Array.isArray(options.typeRows) ? options.typeRows : countRowsFromSamples([], 'taskType', TYPE_COUNTS);
  const typeIds = typeRows.map((item) => item.id).filter(Boolean);
  return subjectRows.map((subject, index) => {
    const sampleCount = Number(subject.count || 0);
    const priority = sampleCount < 50 ? 'P0' : sampleCount < 70 ? 'P1' : 'P2';
    const nextTaskType = typeIds[index % Math.max(typeIds.length, 1)] || 'mixed_homework';
    return {
      id: `content_expansion_${subject.id || index}`,
      subject: subject.id,
      label: subject.label,
      priority,
      currentSampleCount: sampleCount,
      nextTaskType,
      localCodeOwns: ['sample_cleaning', 'question_type_mapping', 'first_step_rule', 'visual_primitive_contract', 'exit_gate', 'share_privacy_fields'],
      aiBetterFor: ['child_friendly_socratic_wording', 'one_sentence_teacher_explanation', 'parent_readable_summary', 'near_transfer_wording'],
      mustNotUseAiFor: ['final_answer', 'score_or_ranking', 'talent_label', 'release_decision', 'raw_public_source_copy'],
      nextLocalDeliverable: 'add five sample-backed mini-lesson topic cards before claiming wider coverage',
      releaseGate: 'each added card must carry first_step, wrong_cause, visual_primitive, parent_check, revisit, blocked_fields'
    };
  });
}

function buildRealHomeworkCoverageMatrix(options = {}) {
  const activeSubject = String(options.subject || '').trim();
  const fixtureLoaded = Boolean(REAL_HOMEWORK_PRESSURE_FIXTURE_LOADED);
  const loadedSampleCount = Array.isArray(REAL_HOMEWORK_PRESSURE_SAMPLES) ? REAL_HOMEWORK_PRESSURE_SAMPLES.length : 0;
  const matrixSamples = fixtureLoaded ? REAL_HOMEWORK_PRESSURE_SAMPLES : [];
  const subjectRows = countRowsFromSamples(matrixSamples, 'subject', SUBJECT_COUNTS);
  const typeRows = countRowsFromSamples(matrixSamples, 'taskType', TYPE_COUNTS);
  const active = subjectRows.find((item) => item.id === activeSubject || item.label === activeSubject) || subjectRows[0] || SUBJECT_COUNTS[0];
  const totalSamples = subjectRows.reduce((sum, item) => sum + item.count, 0);
  const totalTypes = typeRows.length;
  const coverageConfidence = fixtureLoaded ? 'fixture_verified' : 'fallback_static_counts_only';
  const sampleSourceStatus = fixtureLoaded ? 'fixture_loaded' : 'fallback_static_atlas';
  const readinessReason = fixtureLoaded
    ? 'real_homework_pressure_fixture_loaded'
    : 'collect_more_samples_before_claiming_runtime_coverage';
  const publicResourceTriageBoard = buildK12PublicResourceTriageBoard();
  const localAiImplementationRunway = buildK12LocalAiImplementationRunway();
  const pressureFailureTypeAudit = buildPressureSampleFailureTypeAudit();
  const unifiedK12SourceRegistry = buildUnifiedK12SourceRegistry();
  const curriculumAssetSourceAudit = buildCurriculumAssetSourceAudit({ registry: unifiedK12SourceRegistry });
  const contentExpansionQueue = buildK12ContentExpansionQueue({ subjectRows, typeRows });
  return {
    id: 'real_homework_coverage_matrix',
    title: '真实作业压力覆盖矩阵',
    summary: `已把 ${totalSamples} 个小学/初中作业压力样本沉淀为 ${SUBJECT_COUNTS.length} 科、${totalTypes} 类题型资产。`,
    boundary: '样本只用于第一步、错因、小黑板、回访和家长判断；不做拍题答案库，不展示原题答案。',
    sourceLine: '来源按公开课标、国家中小学智慧教育平台作业风格和公开考试常见题型方向转写。',
    activeSubject: active,
    fixtureLoaded,
    sampleSourceStatus,
    loadedSampleCount,
    coverageConfidence,
    readinessReason,
    subjectRows,
    typeRows,
    sampleClusters: SAMPLE_CLUSTERS,
    runtimePressureSampleAtlas: FALLBACK_PRESSURE_SAMPLE_ATLAS,
    questionTypeClusterRunway: QUESTION_TYPE_CLUSTER_RUNWAY,
    publicSourceLedger: PUBLIC_K12_SOURCE_LEDGER,
    publicSourcePolicy: PUBLIC_K12_USE_POLICY,
    publicK12AssetPipeline: PUBLIC_K12_ASSET_PIPELINE,
    publicK12CandidatePool: PUBLIC_K12_CANDIDATE_POOL,
    publicK12OpenSourceResourceLedger: PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER,
    publicK12UseWorkbench: PUBLIC_K12_USE_WORKBENCH,
    publicK12HomeworkIntakeQueue: PUBLIC_K12_HOMEWORK_INTAKE_QUEUE,
    publicK12IntakeChallengeDeck: buildPublicK12IntakeChallengeDeck(),
    publicK12AssetBoundaryAudit: buildPublicK12AssetBoundaryAudit(),
    unifiedK12SourceRegistry,
    curriculumAssetSourceAudit,
    contentExpansionQueue,
    publicResourceTriageBoard,
    localAiImplementationRunway,
    pressureFailureTypeAudit,
    implementationDecisionMatrix: K12_PUBLIC_IMPLEMENTATION_DECISION_MATRIX,
    antiFakeThicknessGates: PUBLIC_K12_ANTI_FAKE_THICKNESS_GATES,
    implementationPlaybook: PUBLIC_K12_IMPLEMENTATION_PLAYBOOK,
    longitudinalPressureScenarioLedger: LONGITUDINAL_PRESSURE_SCENARIO_LEDGER,
    publicWorkbenchLine: `已把 ${PUBLIC_K12_USE_WORKBENCH.length} 类可用资料拆成“可直接用 / 本地代码更好 / AI 更好 / 禁用”四格决策。`,
    publicAssetPipelineLine: `已把 ${PUBLIC_K12_ASSET_PIPELINE.length} 类公开/一方/竞品资料转成采集-本地化-禁用-落地页面流水线。`,
    publicCandidatePoolLine: `已把 ${PUBLIC_K12_CANDIDATE_POOL.length} 条可扩内容候选按 A+/A/B 分级，先过本地化和禁用字段检查再进入样本库。`,
    openSourceResourceLine: `已把 ${PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.length} 类开源/OER/官方公开资料拆成“直接可用、需本地化、AI 可改写、必须禁用”的产品账本。`,
    homeworkIntakeQueueLine: `已把 ${PUBLIC_K12_HOMEWORK_INTAKE_QUEUE.length} 条公开K12作业形态排入采集队列：先改写为本地压力样本，再压测苏格拉底、报告、游戏和分享。`,
    intakeChallengeDeckLine: `已把 ${PUBLIC_K12_HOMEWORK_INTAKE_QUEUE.length} 条采集队列转成可玩挑战卡：接收者必须用自己的材料说第一步，不能复制原题或答案。`,
    publicSourceLine: `已把 ${PUBLIC_K12_SOURCE_LEDGER.length} 类公开/一方资料沉淀为本地规则资产：题型、错因、第一步、小黑板、回访、报告和分享边界。`,
    publicSourceBlockedLine: '禁止把公开资料变成原题答案库、拍照搜题承诺、排名晒分或全科动态板书承诺。',
    antiFakeThicknessLine: `已把 ${PUBLIC_K12_ANTI_FAKE_THICKNESS_GATES.length} 类“看起来厚但实际不准”的风险做成硬门槛：来源、苏格拉底、小黑板、记忆游戏、报告画像和分享增长都必须有证据再放行。`,
    implementationPlaybookLine: `已把公开 K12 资料分成 ${PUBLIC_K12_IMPLEMENTATION_PLAYBOOK.length} 种处理方式：直接用、本地代码更好、AI 更好、必须拒绝。`,
    clusterRunwayLine: `已把 ${QUESTION_TYPE_CLUSTER_RUNWAY.length} 个高频题型簇接成“第一步-错因-小黑板-回访-分享”本地闭环。`,
    longitudinalLine: `已把 ${LONGITUDINAL_PRESSURE_SCENARIO_LEDGER.length} 条跨周复发场景接成本地 release gate：先看复发证据，再决定报告、奖励、分享和家校协同能不能释放。`,
    totalSamples,
    totalSubjects: subjectRows.length,
    totalTypes,
    totalPublicSources: PUBLIC_K12_SOURCE_LEDGER.length,
    totalPublicAssetPipelines: PUBLIC_K12_ASSET_PIPELINE.length,
    totalPublicCandidateAssets: PUBLIC_K12_CANDIDATE_POOL.length,
    totalOpenSourceResources: PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER.length,
    totalLocalAiRunwayModules: localAiImplementationRunway.moduleCount,
    totalLocalAiRunwayResourceCoverage: localAiImplementationRunway.resourceCoverage.length,
    totalUnifiedSourceRegistryRows: unifiedK12SourceRegistry.length,
    totalCurriculumAssetSourceReady: curriculumAssetSourceAudit.readyCount,
    totalContentExpansionQueue: contentExpansionQueue.length,
    totalPressureWeakSamples: pressureFailureTypeAudit.weakSampleCount,
    totalHomeworkIntakeQueue: PUBLIC_K12_HOMEWORK_INTAKE_QUEUE.length,
    totalIntakeChallengeCards: PUBLIC_K12_HOMEWORK_INTAKE_QUEUE.length,
    totalQuestionTypeClusters: QUESTION_TYPE_CLUSTER_RUNWAY.length,
    totalLongitudinalPressureScenarios: LONGITUDINAL_PRESSURE_SCENARIO_LEDGER.length,
    reportLine: `报告可引用 ${totalSamples} 个压力样本的第一步、错因、小黑板和回访动作。`,
    parentLine: `家长侧只看 ${active.label} 当前错因和下一次回访，不看孩子完整对话、分数或排名。`,
    nextExpansionLine: active.nextGap,
    contentExpansionLine: `Content expansion queue keeps ${contentExpansionQueue.length} subject rows under local-code gates before AI wording.`,
    evidenceRequired: [
      'sample_specific_first_step',
      'sample_specific_wrong_cause',
      'visual_board_move',
      'parent_check_line',
      'next_day_revisit',
      'public_source_boundary'
    ]
  };
}

module.exports = {
  SUBJECT_COUNTS,
  TYPE_COUNTS,
  SAMPLE_CLUSTERS,
  FALLBACK_PRESSURE_SAMPLE_ATLAS,
  QUESTION_TYPE_CLUSTER_RUNWAY,
  PUBLIC_K12_SOURCE_LEDGER,
  PUBLIC_K12_USE_POLICY,
  PUBLIC_K12_ASSET_PIPELINE,
  PUBLIC_K12_CANDIDATE_POOL,
  PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER,
  PUBLIC_K12_USE_WORKBENCH,
  PUBLIC_K12_HOMEWORK_INTAKE_QUEUE,
  PUBLIC_K12_ANTI_FAKE_THICKNESS_GATES,
  PUBLIC_K12_IMPLEMENTATION_PLAYBOOK,
  K12_PUBLIC_IMPLEMENTATION_DECISION_MATRIX,
  LONGITUDINAL_PRESSURE_SCENARIO_LEDGER,
  getRealHomeworkPressureSamples,
  buildPublicK12IntakeChallengeDeck,
  buildK12PublicResourceTriageBoard,
  buildK12LocalAiImplementationRunway,
  normalizeUnifiedK12SourceRegistryEntry,
  buildUnifiedK12SourceRegistry,
  buildCurriculumAssetSourceAudit,
  buildPublicK12AssetBoundaryAudit,
  validatePublicK12AssetBoundary,
  buildPressureSampleFailureTypeAudit,
  buildK12ContentExpansionQueue,
  buildRealHomeworkCoverageMatrix
};
