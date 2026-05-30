# RC8 Product Maturity Sprint

> Scope: product maturity decisions only. No UI redesign, no Variant prompts, no mascot assets, no AppID change, no upload, no product-code changes.

## 0. Executive Verdict

原点私教现在是一个**强 MVP**，不是成熟商业产品。

它已经有清楚的产品主线：

> 卡住 -> 看清第一步 -> 专注做一段 -> 明天轻回访 -> 家长 5 秒复盘

RC8 的结论不是继续加功能，而是把产品边界、目标人群、证据逻辑、付费前提和验证路线锁住。现在可以进入 UI/原型表达，但 UI 的任务必须是让这个主线更清楚，而不是把专注舱、回访、成长、家长页、咕点全部设计成同等重量的功能模块。

### Status

PRODUCT_MATURE_ENOUGH_FOR_UI = YES

PRODUCT_MATURE_ENOUGH_FOR_PARENT_CHILD_VALIDATION = YES

PRODUCT_MATURE_ENOUGH_FOR_PAYMENT = NO

PRODUCT_MATURE_ENOUGH_FOR_INVESTOR = NO

PRODUCT_DIFFERENTIATION_CLEAR = YES

PARENT_TRUST_LOGIC_CLEAR = YES

CHILD_ACCEPTANCE_LOGIC_CLEAR = YES

LEARNING_OUTCOME_LOGIC_CLEAR = YES

## 1. Product Maturity Gap Map

### Hard Verdict

当前不成熟的核心原因不是功能少，而是**还没有真实家庭夜晚使用证据**。产品逻辑已经成立，但信任、儿童接受度、学习效果、付费意愿和长期复用都还停留在假设。

| Gap Type | Current Gap | Why It Matters | Can Fix Now Without UI? | Requires Parent-Child Testing? |
| --- | --- | --- | --- | --- |
| Product logic | 第一小步、专注舱、轻回访、家长复盘的故事清楚，但每一步的成功标准还不够硬 | 没有清晰标准，验证时会只看“用户觉得好不好” | Yes: define metrics and evidence names | Yes: test whether families actually follow the route |
| Product logic | 专注舱仍有被理解为番茄钟/氛围工具的风险 | 会稀释“做完第一步”的中心 | Yes: keep positioning and UI hierarchy constraints | Yes: observe child use |
| User trust | 家长需要在 5 秒内确认“这不是拍照搜题” | 如果家长误解为答案工具，信任边界会崩 | Yes: lock wording and objections | Yes: test first-screen comprehension |
| User trust | Profile 对家长有价值，但可能让孩子感觉被汇报 | 儿童拒绝会毁掉日用习惯 | Yes: define child-facing restrictions | Yes: interview children |
| Learning outcome | 目前只能证明行为改变，不能证明提分 | 过早提分承诺会制造合规和信任风险 | Yes: define outcome ladder | Yes: collect 7-night and longer data |
| Monetization | 付费价值还没有被验证 | 过早收费会让产品像课程/服务转化入口 | Yes: create monetization ladder | Yes: WTP interviews and pilot |
| Validation | 目标人群需要更窄 | 人群太宽会导致反馈互相冲突 | Yes: lock first segment | Yes: recruit exact segment |
| Feature hierarchy | 后台功能仍可能被 UI 放大 | 一放大就变成竞品功能拼盘 | Yes: lock non-negotiable principles | Yes: usability test whether users recall one story |

### Product Logic Gaps

1. **成功定义还不够具体。**  
   “看清第一步”必须被定义为：孩子能用自己的话说出“我先看哪里/先做哪一步”，而不是系统生成一段看似正确的建议。

2. **专注舱的胜利条件不能是时长。**  
   胜利条件应是：孩子围绕当前第一步开始做、坐住一段、留下完成或中断证据。时间只是容器。

3. **轻回访必须轻。**  
   它不能发展成错题本、题库、快测或复习系统。当前阶段只服务于“昨天那一步今天还顺吗？”

4. **家长复盘必须短。**  
   Profile 不能变成报告页。家长最需要的是一句 recap 和一句可以问孩子的话。

### User Trust Gaps

1. 家长还没有通过真实体验证明“不给答案反而更有用”。
2. 孩子还没有证明会把咕点当成同伴，而不是父母的监控工具。
3. 三问还没有证明在烦躁场景下不会变成审问。
4. 家长复盘还没有证明能减少冲突，而不是制造新的追问。

### Learning-Outcome Gaps

1. 目前不能声称提分。
2. 目前只能声称帮助家庭把“卡住”变成“可开始的一小步”。
3. 是否改善学习，需要通过先行指标逐层验证。
4. 是否提升成绩，需要更长周期和外部学习数据，不应进入当前营销。

### Monetization Gaps

1. 付费触发点不明确：为少吵架、少依赖答案、孩子能开口、还是专注舱体验付费，需要验证。
2. 付费前必须证明 3 夜、7 夜复用，而不是单夜新鲜感。
3. 场景/音频/IP 不应先卖，否则会把产品拉偏成氛围工具或儿童 IP。
4. 教培转化不能早出现，否则直接破坏“不是来卖课”的信任。

### Validation Gaps

1. 需要看家长是否 5 秒讲得出产品价值。
2. 需要看孩子是否愿意完成三问和进入专注舱。
3. 需要看 7 夜内是否自然复用。
4. 需要看家长是否真的少讲答案、少吵、少追问。
5. 需要看第一小步是否真的能帮助孩子开始，而不是只是好看的文案。

## 2. Competitor Differentiation Sharpening

This section uses category-level benchmark logic only. It does not claim live competitor facts.

| Category | Why Users Might Choose Us Instead | Where We Are Weaker | What We Should Never Compete On | What We Must Own | Wording To Avoid Wrong Expectations |
| --- | --- | --- | --- | --- | --- |
| 作业帮/小猿类 AI 答案工具 | 家长担心孩子抄答案，想要一个不直接给答案的夜间陪伴入口 | 答案速度、题目覆盖、OCR、完整解析 | 不比谁更快出答案 | 不给答案，帮孩子说出第一步 | “不拍照出答案，只陪孩子看清先做哪一步” |
| AI tutor / explanation app | 用户不想进入长对话，只想今晚先动起来 | 学科深度、连续讲解、个性化对话 | 不比谁讲得更全 | 三问收束到一个可开始动作 | “不做长聊天，只把卡住收成一小步” |
| 错题本 | 用户需要的是今晚卡住时能开始，不是长期归档 | 题目管理、错因分类、复习算法 | 不比错题整理深度 | 从当前卡点生成明天轻回访 | “不是错题仓库，是今晚那一步的轻回访” |
| 家长报告产品 | 家长不想看报告墙，只想知道今晚怎么问一句 | 图表、趋势、班级/能力分析 | 不比数据墙 | 家长 5 秒看懂和一句可问的话 | “不是报告，只给今晚一句复盘” |
| 番茄钟/专注工具 | 孩子需要围绕第一步坐住，不是单纯计时 | 氛围资产、声音库、计时精致度 | 不比场景/音乐/专注统计 | 任务绑定的陪学专注 | “不是番茄钟，是陪你把这一步做完” |
| 自习室/打卡产品 | 部分孩子需要陪伴感，但不需要社交压力 | 真实多人房间、排行榜、社群活跃 | 不比热闹和排名 | 安静、本地、低压力陪坐 | “不是冲榜打卡，只是今晚有人陪你坐一会儿” |
| 教培服务入口 | 家长可能后续需要更多帮助，但当前先解决今晚 | 专业师资、课程体系、服务履约 | 不比老师和课程 | 降低晚间冲突的前置辅助 | “不是卖课入口，先让孩子自己说出第一步” |

### Sharper Positioning: 不是 X，而是 Y

1. 不是拍照搜题，而是**不直接给答案的第一步陪伴**。
2. 不是 AI 聊天老师，而是**三问收束今晚卡点的小助手**。
3. 不是错题本，而是**把今晚卡住的地方变成明天能轻轻回看的纸条**。
4. 不是家长报告墙，而是**家长 5 秒能问对一句话**。
5. 不是番茄钟，而是**咕点陪孩子把当前第一小步做完**。
6. 不是自习室冲榜，而是**低压力、可中断、可回来的一小段陪坐**。
7. 不是教培转化页，而是**家庭晚间作业冲突的缓冲器**。

### What We Must Own

> 中国家庭晚间作业卡住时，不给答案、不加压，帮孩子说出第一步、坐住一小段，让家长 5 秒看懂。

## 3. Parent Value Hardening

### What Parent Gets After 1 Night

1. 知道孩子今晚卡在哪里。
2. 看到孩子是否说出了第一步。
3. 知道孩子是否围绕这一步坐了一段时间。
4. 拿到一句低冲突的追问方式。
5. 确认产品没有直接替孩子写答案。

### What Parent Gets After 3 Nights

1. 看见孩子常见的卡住入口：读题、列式、概念、步骤、表达。
2. 看见孩子是否更容易开始。
3. 看见专注舱是否能减少拖延和陪写拉扯。
4. 形成“今晚只推进一小步”的家庭节奏。
5. 判断孩子是否愿意继续让咕点陪。

### What Parent Gets After 7 Nights

1. 一组真实卡点和第一步记录。
2. 孩子开始速度、专注完成率、回访完成率的初步趋势。
3. 家长主观感受：是否少吵、少讲答案、少催。
4. 孩子主观感受：是否更敢说“我卡住了”。
5. 是否值得继续使用或进入付费访谈的判断基础。

### Proof That Would Make Parent Believe It Works

1. 孩子能用自己的话说第一步。
2. 孩子开始时间变短。
3. 孩子在专注舱完成一小段，不只是打开页面。
4. 第二天能回忆昨天那一步。
5. 家长少讲答案，孩子少崩溃。
6. 7 夜内至少 4 夜自然复用。

### What Parent Should See

1. 今晚卡在哪。
2. 孩子先看哪里。
3. 孩子第一步怎么说。
4. 专注做了多久，以及是否完成/中断。
5. 明天轻回访哪一步。
6. 家长今晚只问哪一句。

### What Parent Should Never See Too Early

1. 复杂能力雷达。
2. 排名、PK、冲榜。
3. 付费、服务方案、课程入口。
4. 夸大的提分承诺。
5. 长篇 AI 分析报告。
6. 暗示孩子被监控的行为记录。

### Objection Handling

**这是不是拍照搜题？**  
不是。原点私教不以“出答案”为价值，也不承诺拍照自动解题。它只帮孩子把卡住的地方说清楚，找到今晚先做的一小步。

**会不会让孩子依赖 AI？**  
依赖风险来自 AI 替孩子完成答案。原点私教的边界相反：孩子必须自己说“我卡在哪、先看哪里、第一步怎么说”。AI 只做收束和陪伴。

**真的能帮学习吗？**  
现在可以谨慎说：它帮助孩子从卡住进入开始、帮助家长少用讲答案的方式陪作业。不能声称直接提分。提分需要更长周期数据证明。

**为什么不用作业帮/小猿？**  
如果目标是快速找答案，可以用答案工具。原点私教服务的是另一个场景：家长不想孩子抄答案，希望孩子今晚先自己迈出一步。

**这不就是番茄钟吗？**  
不是。番茄钟只管时间，专注舱绑定“今晚第一步”。咕点陪的是一个具体卡点，不是泛泛计时。

**孩子会不会觉得被监控？**  
产品必须避免这种感觉。孩子侧只看到咕点陪他缩小问题、做完一小步；家长侧只看一句复盘和一句可问的问题，不做审判式报告。

**这个东西未来凭什么收费？**  
只有在证明它能持续减少晚间冲突、缩短开始时间、保护孩子不依赖答案、让家长更轻松陪作业之后，才有资格测试付费。

## 4. Child Acceptance Hardening

### What Makes Child Feel Safe

1. 咕点先承认“卡住正常”，不评价。
2. 每次只要求一个小动作。
3. 不强迫孩子说完整解法。
4. 可以暂停、中断、回来。
5. 家长页不把孩子表现做成审判。
6. 产品不把失败写成失败，只写成“今天停在这里也被看见了”。

### What Makes Child Resist

1. 三问像考试或审问。
2. 专注舱像额外作业。
3. Profile 像把表现交给家长。
4. 成长系统像连续打卡压力。
5. 咕点话太多、太像老师、太像 AI 机器人。
6. 产品把“不会”写成“弱点”。

### How 咕点 Should Behave

| State | 咕点 Role | Rule |
| --- | --- | --- |
| Child stuck | 情绪缓冲 | 先接住卡住，不讲道理 |
| 三问 | 轻轻追问 | 问短句，不像测评 |
| Review | 帮孩子说出第一步 | 让孩子的话成为主角 |
| 专注舱 | 安静陪坐 | 少说，不催，不抢注意力 |
| Interruption | 无责安抚 | 允许停下，记录真实发生 |
| Completion | 记录努力 | 庆祝小步，不夸大 |
| Parent recap | 翻译成一句话 | 帮家长少问、问准 |

### 三问 How To Avoid Interrogation

1. 不叫测评。
2. 不问“为什么不会”。
3. 不评分。
4. 每题能一句话回答。
5. 明确说“问完三句就停”。
6. 答不上来也能继续收束。

### 专注舱 How To Avoid Extra Homework Feeling

1. 主文案永远是“做完这一小步”，不是“完成专注挑战”。
2. 默认时间短，可从 15 分钟开始。
3. 中断不惩罚。
4. 场景和声音只是背景，不是任务。
5. 完成证据强调“坐住这一小步”，不是追求更久。

### Profile How To Avoid Reporting Feeling

1. Child-facing pages 不展示“家长报告”语气。
2. 家长 recap 不评价孩子好坏。
3. 不暴露排名、对比、弱点标签。
4. 家长问题设计为帮助孩子复述，而不是追责。

### Never Show On Child-Facing Pages

1. 能力弱点、排名、PK、冲榜。
2. 家长监督、汇报、报告墙。
3. 付费、课程、服务方案。
4. 直接答案、自动解题、秒解暗示。
5. 复杂数据图表。
6. “你应该”“你必须”“你又没有完成”。

## 5. Learning Outcome Logic Hardening

### Claim Boundary

LEARNING_OUTCOME_CLAIM_ALLOWED = NO for score improvement.

当前可以主张的是**学习行为和家庭陪伴过程改善**，不是成绩提升。

### Leading Indicators

1. First-step articulation rate: 孩子是否能说出第一步。
2. Time-to-start: 从进入产品到开始专注的时间。
3. Focus completion rate: 是否完成一个任务绑定的专注段。
4. Interruption recovery rate: 中断后是否能回来继续。
5. Light revisit completion rate: 第二天是否完成轻回访。

### Behavior Indicators

1. 家长讲答案次数下降。
2. 孩子说“我不会”的停留时间下降。
3. 孩子主动输入卡点的次数上升。
4. 每晚只处理一个真实卡点的完成率。
5. 专注舱打开后 2 分钟内开始率。

### Parent-Reported Indicators

1. 今晚是否少吵。
2. 家长是否更知道怎么问。
3. 家长是否减少直接讲答案。
4. 家长是否愿意明天继续用。
5. 家长是否认为孩子更愿意开口。

### Child Self-Explanation Indicators

1. “我卡在哪”的具体度。
2. “我先看哪里”的准确度。
3. “第一步怎么说”的可执行度。
4. 第二天是否能复述昨天第一步。
5. 是否能从“不会”改成“我先做这个”。

### Possible Long-Term Learning Indicators

1. 同类题开始速度提升。
2. 审题/列式/表达等常见卡点减少。
3. 复盘后同类卡点的回访顺畅度提升。
4. 家长陪作业冲突频次下降。
5. 老师或家长观察到孩子表达思路更清楚。

### What Can Be Claimed Now

1. 帮孩子把“卡住”说清楚。
2. 帮孩子找到今晚先做的一小步。
3. 陪孩子围绕这一小步专注一段。
4. 帮家长用 5 秒知道今晚怎么问一句。
5. 帮家庭减少直接讲答案的冲动。

### What Cannot Be Claimed

1. 不能声称提分。
2. 不能声称掌握知识点。
3. 不能声称替代老师。
4. 不能声称替代家长陪伴。
5. 不能声称自动诊断能力弱点。

### Data Needed Before Claiming 提分

1. 至少 4-8 周真实家庭使用。
2. 明确年级、学科、题型。
3. 前后测或作业表现对照。
4. 家长冲突/孩子开始行为的持续记录。
5. 对照组或至少同家庭历史基线。
6. 老师/家长外部评价。

### Safe Marketing Wording

1. “不直接给答案，陪孩子看清今晚第一步。”
2. “让卡住的晚上，先有一个能开始的小动作。”
3. “帮家长少讲答案，多问对一句。”
4. “把今晚的努力留下来，明天轻轻回看。”
5. “先改善开始和陪伴，再验证长期学习效果。”

## 6. Product Evidence Loop Hardening

### Current Evidence Loop

| Evidence | Current Meaning | Maturity Risk | Product-Level Recommendation |
| --- | --- | --- | --- |
| First-step articulation | 孩子或系统形成第一小步 | 可能只是系统建议，不是孩子表达 | 区分 system_suggested_step 和 child_articulated_step |
| Focus completion | 专注舱完成记录 | 可能被理解为只是在计时 | 记录 task_bound = true/false and target_source |
| Interruption | 中断状态 | 中断可能被负向解读 | 命名为 pause_or_interruption_trace，不做失败标签 |
| Revisit | 明天轻回访 | 可能变成复习任务 | 记录 revisit_light_check，只问这一小步是否还顺 |
| Parent recap | 家长一句话 | 可能变成报告 | 保持 one_line_parent_recap and one_question_to_ask |
| Child self-explanation quality | 当前不足 | 学习效果证据薄 | 后续增加 rubric: vague / partial / actionable |

### Recommended Evidence Names

1. `first_step_articulated`
2. `child_step_sentence`
3. `focus_started_for_step`
4. `focus_completed_for_step`
5. `focus_interrupted_without_blame`
6. `light_revisit_done`
7. `parent_one_question_read`
8. `child_returned_next_day`

### Validation Metrics

1. First-step articulation rate.
2. Median time-to-start.
3. Task-bound focus completion rate.
4. Interruption comfort rate: child is willing to resume or return later.
5. Next-day revisit rate.
6. Parent 5-second comprehension rate.
7. Parent-reported conflict reduction.
8. Child willingness-to-return score.

### Local Logging Needs Later

No implementation is required in RC8. If implemented later, local logs should stay minimal and privacy-safe:

1. Event name.
2. Timestamp.
3. Current step id.
4. Session state.
5. Child-written step sentence, only if entered.
6. Parent recap generated/read state.
7. No sensitive answer content beyond the user-provided stuck point.

## 7. Monetization Maturity Map

### Stage 0: No Payment

| Item | Requirement |
| --- | --- |
| Entry condition | Current RC8 state |
| Goal | Prove trust and repeated use |
| Proof needed | Parent understands value; child accepts; 3-night and 7-night use happens |
| Trust risk | None if no commercial surface appears |
| Must not monetize | Core first-step route, parent recap, child safety |
| Stop when | Families do not understand or reuse the product |

### Stage 1: Willingness-To-Pay Interview

| Item | Requirement |
| --- | --- |
| Entry condition | 5-10 families complete prototype or 3-night smoke |
| Goal | Learn what parents think is worth paying for |
| Proof needed | Parents can name concrete saved effort or reduced conflict |
| Trust risk | Low if framed as research, not sales |
| Must not monetize | Direct answer, pressure stats, child monitoring |
| Stop when | Parents only value answer speed or score guarantees |

### Stage 2: Soft Paid Pilot

| Item | Requirement |
| --- | --- |
| Entry condition | 7-night pilot shows repeated use and parent trust |
| Goal | Test whether families pay for continued evening companionship |
| Proof needed | 40%+ families express willingness to continue; child does not reject |
| Trust risk | Medium: payment can make product feel commercial |
| Must not monetize | Basic first-step help and anti-answer trust boundary |
| Stop when | Payment reduces child use or parent trust |

### Stage 3: Subscription / Premium Features

| Item | Requirement |
| --- | --- |
| Entry condition | Multiple cohorts show retention and clear parent value |
| Goal | Build family subscription around memory, revisit, and calm parent support |
| Proof needed | Retention, WTP, low refund, strong trust |
| Trust risk | High if scenes/audio/IP become the value center |
| Must not monetize | Safety, no-answer boundary, basic recap |
| Stop when | Product drifts into timer/theme pack or report wall |

### Stage 4: B2B2C / Offline Services

| Item | Requirement |
| --- | --- |
| Entry condition | Strong family proof, compliance clarity, channel demand |
| Goal | Explore after-school/family education distribution |
| Proof needed | Schools/tutors see support value without teacher dashboard pressure |
| Trust risk | Very high: can become course lead-gen or school admin |
| Must not monetize | Child data, ranking, teacher surveillance |
| Stop when | Channel demands pull product away from family evening route |

### Recommended First Paid Experiment

No paid experiment now.

The first paid experiment should only happen after a 7-night family pilot proves:

1. Families reuse it naturally.
2. Parents trust the no-answer boundary.
3. Children do not feel monitored.
4. Parent-child conflict is measurably lower or subjectively clearly lower.
5. Parents can say what they would pay for without being prompted.

## 8. First Target Segment Lock

FIRST_TARGET_SEGMENT = Grade 4-7 Chinese families in Tier 1, new Tier 1, and strong Tier 2 cities; primary homework-accompanying parent is usually the mother, age 32-45, digitally comfortable, anxious about direct-answer dependence, tired of evening homework conflict; child often freezes at math word problems, equation setup, reading the question, or writing process, but is still capable of expressing a first step with gentle support.

### Detailed Segment

| Dimension | Lock |
| --- | --- |
| Grade range | Grade 4-7 |
| Parent type | Mother or primary homework-accompanying parent, 32-45 |
| City tier | Tier 1, new Tier 1, strong Tier 2 |
| Subject pain | Math word problems first; later reading comprehension and English writing |
| Homework situation | Child says “不会”; parent wants to help but fears turning into answer-giving or arguing |
| Child personality | Not fully disengaged; can talk when pressure is lowered; may freeze, avoid, or say “不知道” |
| Willingness to try | Parent already uses WeChat miniapps and is worried about answer tools |
| Payment ability | Medium to high, but payment should wait |

### Rejection Segment

1. Parents who only want fast answers.
2. Families expecting guaranteed score improvement.
3. Children above Grade 8 who reject mascot-led support unless visual design matures.
4. Families already served by daily human tutoring and wanting full explanations.
5. Low-conflict families without evening homework pain.
6. Parents looking for school-style reports, ranking, or teacher dashboards.

## 9. Product Principle Lock

1. Never make direct answers the hero value.
2. Never let child-facing pages feel like reporting to parents.
3. Never make focus stats more important than the current first step.
4. Never sell before trust is proven.
5. Never expose leaderboard, ranking, or competitive study-room mechanics before child safety proof.
6. Never turn Profile into a report wall.
7. Never turn Tools into a toolbox; it is light revisit only.
8. Never let 咕点 become a teacher, chatbot, course mascot, or surveillance narrator.
9. Never claim 提分 before long-term evidence exists.
10. Never add features that do not serve: 卡住 -> 第一小步 -> 专注一段 -> 明天轻回访 -> 家长 5 秒复盘.

## 10. Product Maturity Roadmap Before Commercial Launch

| Stage | Goal | Required Proof | Pass Criteria | Fail Criteria | Next Action |
| --- | --- | --- | --- | --- | --- |
| Stage A: Product logic maturity | Lock positioning, target segment, evidence, claims, boundaries | RC8 document accepted | Team can explain product in one sentence and reject feature drift | Team still debates whether it is answer tool/timer/report app | Move to UI/prototype |
| Stage B: Parent-child prototype validation | Test whether families understand and accept the route | 5 parents + 5 children complete core scenario | 4/5 parents understand in 5 seconds; 3/5 children accept 咕点 and 三问 | Parents think it gives answers; children feel monitored | Revise copy/hierarchy before more UI |
| Stage C: 7-night family pilot | Test repeated evening use | 5-10 families use across real nights | 40%+ families use 4+ nights; parent reports lower conflict; child does not reject | Use drops after novelty; parent asks for answers only | Rework product or segment |
| Stage D: Payment interview | Identify what value might be paid | Interviews after real use | Parents can name saved effort, reduced conflict, or safer AI use | Parents only pay for answers, tutoring, or scores | No payment; revisit positioning |
| Stage E: Paid pilot | Test soft conversion without damaging trust | Small paid cohort | Payment does not reduce child use; refund/complaint low | Payment makes product feel commercial or coercive | Stop monetization and return to trust |
| Stage F: Broader launch | Prepare public release | Retention, trust, support, compliance proof | Clear category, repeat use, safe claims | Confusion with answer tools or pressure systems | Launch narrowly, not as mass answer solver |

## 11. Optional Minimal Product Changes

No P0 implementation blocker was found in RC8. Do not change code in this sprint.

| Priority | Issue | Why It Matters | Recommended Change | Likely Files If Implemented Later | Type |
| --- | --- | --- | --- | --- | --- |
| P0 | None | Current loop can be validated | No implementation | N/A | N/A |
| P1 | Child-facing copy boundaries need to stay enforced | A single “report/weakness/ranking” leak can break child trust | Add a copy QA checklist before UI and release | pages/*, view-models, docs | Copy/Product structure |
| P1 | Evidence naming should distinguish child articulation from system suggestion | Learning proof depends on child agency | Later add explicit local fields | utils/storage.js, utils/focus-cabin.js | Data |
| P1 | Keep study-room/social backstage | Social pressure can dilute the promise | UI must not hero room/leaderboard/check-in | pages/entry-detail?scene=today, focus-cabin.js | Product structure |
| P1 | Parent recap needs one-question discipline | Profile can drift into report wall | Keep parent question as first value | pages/profile, view-models | Copy/Product structure |
| P2 | Add child self-explanation quality rubric later | Needed for learning-outcome proof | Add simple rubric after validation | diagnosis/review/storage | Data/Research |
| P2 | Validate subject-specific first-step quality | Math and reading may need different prompts | Run pilot by subject | diagnosis/review | Research |
| P2 | Refine interruption evidence | Interruption can be powerful if framed gently | Test naming and recap | focus-cabin.js | Copy/Data |
| P3 | Premium scenes/audio | Potential revenue later, dangerous now | Keep out of current UI promise | focus assets/settings | Backlog |
| P3 | IP/mascot extensions | Could help brand later | Wait until children like 咕点 | brand/docs/assets | Backlog |
| P3 | B2B2C/school pilot | Possible later | Wait for family proof | docs/business | Backlog |

## 12. Final Maturity Decision

### Maturity Verdict

This is not a mature product. It is a strong, coherent MVP with a narrow, promising wedge.

It is mature enough to proceed into UI/prototype work **only if** UI treats the product as one evening homework route, not a feature dashboard.

It is mature enough for parent-child validation.

It is not mature enough for payment, investor pitch, broad launch, or score-improvement claims.

### What UI Should Do Next

UI should not wait for more product features. UI should wait only for acceptance of this RC8 product boundary.

The next UI/prototype should prove:

1. A parent understands in 5 seconds: not answer tool, first-step companion.
2. A child feels 咕点 is on their side.
3. 三问 feels short and gentle.
4. 专注舱 feels like doing the current first step.
5. Profile feels like parent calm recap, not child report.

### What Must Be Proven Before Paid Conversion

1. 7-night repeat use.
2. Parent trust in the no-answer boundary.
3. Child acceptance and willingness to return.
4. Measurable or clearly reported reduction in evening conflict.
5. Evidence that first-step articulation improves start behavior.
6. Parents can state what they would pay for without being led.
7. Payment does not make the product feel like course sales, surveillance, or pressure.

## Final Status Lines

PRODUCT_MATURE_ENOUGH_FOR_UI = YES

PRODUCT_MATURE_ENOUGH_FOR_PARENT_CHILD_VALIDATION = YES

PRODUCT_MATURE_ENOUGH_FOR_PAYMENT = NO

PRODUCT_MATURE_ENOUGH_FOR_INVESTOR = NO

PRODUCT_DIFFERENTIATION_CLEAR = YES

PARENT_TRUST_LOGIC_CLEAR = YES

CHILD_ACCEPTANCE_LOGIC_CLEAR = YES

LEARNING_OUTCOME_LOGIC_CLEAR = YES
