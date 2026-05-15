# RC8.5 Parent-Child Validation Pack

> Scope: validation preparation only. No UI redesign, no Variant prompt, no feature work, no product code changes, no AppID change, no upload.

## 1. Validation Objective

This validation is designed to prove whether the current product story is understandable, trustworthy, and acceptable to real Chinese families before UI redesign or commercial testing.

### What This Validation Must Prove

1. **Parent 5-second understanding**  
   A parent can understand within 5 seconds that 原点私教 helps with the evening homework stuck moment, not general AI chatting.

2. **Not mistaken as an answer solver**  
   A parent does not interpret the product as 拍照搜题, 秒解, direct answer generation, or homework replacement.

3. **Child feels helped, not monitored**  
   A child feels 咕点 is on their side and helps them start, rather than reporting them to parents.

4. **三问 is acceptable**  
   The three-question flow feels short, gentle, and useful, not like interrogation, testing, or blame.

5. **专注舱 means doing the first step**  
   Parents and children understand 专注舱 as “咕点陪你把今晚这一小步做完,” not as a generic timer, wallpaper, music, or self-study room app.

6. **Profile means calm parent recap**  
   Parents understand Profile as “家长 5 秒看懂今晚发生了什么,” not a report wall, dashboard, weakness analysis, or surveillance panel.

7. **Repeat-use potential exists**  
   Families can imagine using it during a real homework night more than once, especially when the child says “我不会.”

### What This Validation Must NOT Prove

1. It does **not** prove payment readiness.
2. It does **not** prove score improvement.
3. It does **not** prove investor readiness.
4. It does **not** prove long-term learning outcome.
5. It does **not** prove subject mastery.
6. It does **not** prove backend/social/audio/wallpaper value.

## 2. Target Participants

### Required Sample

| Participant | Count | Role |
| --- | --- | --- |
| Parents | 5 | Buyer, homework-accompanying decision maker, trust evaluator |
| Children | 5 | Daily user, emotional acceptance evaluator |
| Teachers/tutors | Optional 2 | Educational reasonableness reviewer |

Parent and child can come from the same family, but observations should be recorded separately because their acceptance signals are different.

### Locked Target Segment

| Dimension | Requirement |
| --- | --- |
| Grade range | Grade 4-7 |
| City tier | Tier 1 / new Tier 1 / strong Tier 2 |
| Parent | Primary homework-accompanying parent, usually mother, age 32-45 |
| Child pain | Often freezes at math word problems, equation setup, reading questions, or writing process |
| Parent concern | Worried about answer-tool dependence and direct answer copying |
| Family situation | Real evening homework friction: arguing, dragging, “我不会,” parent anxiety |
| Digital familiarity | Comfortable with WeChat miniapps or mobile learning tools |

### Rejection Participants

Do not recruit these participants for the first validation round:

1. Parents who only want fast answers.
2. Parents expecting guaranteed score improvement.
3. Children above Grade 8 unless specially recruited as an edge case.
4. Families with no homework conflict.
5. Families fully dependent on a daily human tutor.
6. Parents primarily looking for teacher dashboards, ranking, or school reports.
7. Families unwilling to let the child speak during the session.

## 3. Validation Assets Needed

These assets can be existing screens, screenshots, clickable prototype screens, or DevTools demo screens. They do not need final visual design.

| Asset | What It Validates | User Must Understand | Failure Looks Like |
| --- | --- | --- | --- |
| Home | First impression and category understanding | “今晚先从第一步开始,” not answer solver | Parent says “这是拍照搜题/AI 解题/学习报告” |
| Upload/Input | Stuck-point capture boundary | User describes where stuck; no direct answer promise | Parent expects upload to produce full answer |
| Diagnosis 三问 | Whether guidance feels light | Three questions help narrow stuck point | Child says it feels like being examined or blamed |
| Review first-step card | Whether first-step output is actionable | Child can say “我先看哪里/先做什么” | Output feels like vague advice or answer explanation |
| 专注舱 task-first screen | Whether focus is tied to first step | Main object is current task, timer is support | User describes it as a timer, music app, wallpaper app |
| Completion evidence | Whether effort evidence feels useful | Completion means “this small step was attempted/done” | Parent only sees minutes or child feels graded |
| Tools light revisit | Whether next-day revisit is light | “昨天那一步今天轻轻看一下” | User thinks it is a quiz, wrong-question notebook, or extra homework |
| Profile parent recap | Parent 5-second value | One calm recap and one question to ask | Parent sees it as report wall or surveillance |
| 咕点 visual placeholder if available | Mascot role and emotional trust | 咕点 is companion, not teacher/admin/AI robot | Child says it is childish, annoying, scary, or fake |

## 4. Parent Test Script

### Setup

Say to the parent:

> 我们今天不是测试孩子成绩，也不是让您评价 UI 好不好看。我们只想看：这个小程序在孩子晚上写作业卡住时，您能不能一眼看懂它做什么、信不信它不直接给答案、会不会愿意在真实晚上试一次。

Do not explain the product before the first 5-second impression.

### Step 1: First 5-Second Home Impression

Show Home for 5 seconds. Then hide it or move away.

Ask:

1. “您刚才觉得这个小程序是做什么的？”
2. “它最像哪一类产品？搜题、AI 老师、错题本、番茄钟、家长报告，还是别的？”
3. “您觉得它会不会直接给孩子答案？为什么？”
4. “如果孩子今晚说‘我不会’，您觉得下一步会点哪里？”

Observe:

1. Whether parent names “第一步/卡住/陪作业.”
2. Whether parent mistakes it for answer solving.
3. Whether primary CTA is understood.

### Step 2: Product Value Repeat-Back

Ask:

1. “如果用一句话跟另一个家长介绍，您会怎么说它？”
2. “它解决的是孩子学习里的哪个瞬间？”
3. “您觉得它更帮孩子，还是更帮家长？”
4. “您最担心它会变成什么？”

Pass signal:

Parent says something close to:

> 孩子卡住时，不直接给答案，帮他先说出第一步，家长能知道怎么问。

### Step 3: Simulate Stuck Point Input

Ask the parent to use or describe a real recent stuck point.

Prompt:

> 请想一个最近孩子写作业卡住的场景。比如应用题不知道先看哪句、列式不知道怎么列、读题读不懂。请像平时一样描述给这个产品。

Ask:

1. “这个输入方式像不像拍照搜题？”
2. “您会担心孩子拿它抄答案吗？”
3. “这里有没有一句话让您更放心？”
4. “这里有没有一句话让您误会它会出答案？”

### Step 4: View 三问

Show or run Diagnosis 三问.

Ask:

1. “这三个问题您觉得是在帮孩子想，还是在考孩子？”
2. “如果孩子已经烦了，这三个问题会不会太多？”
3. “哪一句最有用？”
4. “哪一句最容易让孩子反感？”
5. “您希望咕点在这里怎么说，孩子会更愿意回答？”

### Step 5: View First-Step Card

Show Review first-step card.

Ask:

1. “您看完这张卡，知道孩子今晚先做什么吗？”
2. “这张卡有没有给完整答案？”
3. “这一步够小吗？孩子能不能开始？”
4. “如果您现在陪孩子，会怎么问一句？”
5. “这个结果有没有让您少一点想直接讲答案？”

### Step 6: View 专注舱

Show task-first 专注舱.

Ask:

1. “您觉得这里主要是在做什么？”
2. “这是番茄钟，还是在陪孩子做刚才那一步？”
3. “计时、场景、声音，哪个最抢注意力？”
4. “您觉得孩子会愿意进去坐 15 分钟吗？”
5. “如果孩子中途停了，您希望产品怎么记录才不伤孩子？”

### Step 7: View Completion Evidence

Show completion state or evidence summary.

Ask:

1. “这条完成记录对您有用吗？”
2. “它让您知道了什么？”
3. “它有没有让您想继续追问孩子？”
4. “它看起来像鼓励，还是像考勤？”

### Step 8: View Profile Recap

Show Profile parent recap.

Ask:

1. “5 秒内您能看懂今晚发生了什么吗？”
2. “这里最有用的一句话是哪句？”
3. “这像不像报告墙？”
4. “孩子如果看到这个，会不会觉得被汇报？”
5. “您愿意今晚只问它建议的那一句吗？”

### Step 9: Trust And Real-Night Use

Ask:

1. “您信不信它不会直接替孩子写答案？0-10 分打几分？”
2. “您会不会在真实作业晚上试一次？为什么？”
3. “什么情况下您会第二天再打开？”
4. “什么情况下您会立刻关掉或卸载？”
5. “您觉得它现在能不能承诺提分？”
6. “您会不会觉得它在卖课或引流？”

## 5. Child Test Script

### Setup

Say to the child:

> 今天不是考试，也不是看你会不会。我们只想知道：如果你写作业卡住了，咕点这样陪你，你会不会觉得轻松一点，还是更烦。

Do not let the parent answer for the child during this section.

### Step 1: Show 咕点 / Home

Ask:

1. “你觉得咕点像谁？像老师、家长、同学、机器人，还是一个陪你的小伙伴？”
2. “你看到这个首页，会觉得它要你做什么？”
3. “它让你放松一点，还是紧张一点？”
4. “你觉得它会不会把你的表现告诉家长？”

### Step 2: Help Or Supervision

Ask:

1. “如果你写作业卡住了，你愿不愿意点这个？为什么？”
2. “它像是在帮你，还是像在盯着你？”
3. “哪句话让你觉得舒服？”
4. “哪句话让你不想用？”

### Step 3: Describe A Stuck Point

Prompt:

> 想一个你最近写作业卡住的地方。不用说答案，只说你卡在哪里。

Ask:

1. “你愿意这样说出来吗？”
2. “你会不会担心说出来以后被批评？”
3. “如果你不知道怎么说，你希望咕点怎么问你？”

### Step 4: Answer 三问

Ask the child to answer the three questions.

After answering, ask:

1. “这三个问题多不多？”
2. “像不像考试？”
3. “哪一个问题最容易回答？”
4. “哪一个问题最烦？”
5. “如果可以少一个，你想删哪个？”

### Step 5: Read First-Step Sentence

Show the first-step card.

Ask:

1. “你能不能用自己的话读一下这一小步？”
2. “你觉得这一步小不小？”
3. “你看完以后，知道先做什么吗？”
4. “它有没有直接告诉你答案？”
5. “你愿意把这句话跟家长说吗？”

### Step 6: Enter 专注舱

Show 专注舱.

Ask:

1. “你觉得这里是在干什么？”
2. “你会不会愿意让咕点陪你坐 15 分钟，把刚才那一步做一下？”
3. “你更在意计时、背景、声音，还是咕点陪你？”
4. “如果你中途不想做了，点暂停会不会有压力？”
5. “这里像不像又多了一份作业？”

### Step 7: Profile Reaction

Show parent recap lightly, without over-explaining.

Ask:

1. “如果家长看到这个，你会紧张吗？”
2. “你觉得它是在告状，还是帮家长少问一点？”
3. “哪一句会让你觉得被盯着？”
4. “哪一句你觉得可以给家长看？”

### Step 8: Tomorrow Return

Ask:

1. “如果明天咕点提醒你轻轻看一下昨天那一步，你会愿意吗？”
2. “你希望它怎么提醒才不烦？”
3. “什么情况下你会主动打开它？”
4. “什么情况下你再也不想用？”

## 6. Teacher/Tutor Optional Script

Use this only as an educational reasonableness check, not as a school-channel or teacher-dashboard validation.

Ask:

1. “让孩子先说出‘我卡在哪/我先看哪里/第一步怎么说’，在教学上有没有意义？”
2. “这个 no-answer boundary 可信吗？哪里容易被误解？”
3. “三问会不会太浅？如果浅，它是否仍然适合作为家庭晚间入口？”
4. “专注舱绑定第一步，而不是泛泛计时，这个逻辑是否成立？”
5. “家长 5 秒复盘会不会造成误解或过度追问？”
6. “这个产品绝对不能声称什么？”
7. “如果用于课后或家庭教育场景，最需要注意的边界是什么？”

Teacher/tutor should not be asked whether this can replace teaching. It cannot.

## 7. Success Metrics

### Interview Pass Thresholds

| Metric | Pass Threshold |
| --- | --- |
| Parent 5-second anti-answer understanding | 4/5 parents understand within 5 seconds that it is not an answer solver |
| Parent core value repeat-back | 4/5 parents can repeat the core value in their own words |
| Child emotional acceptance | 3/5 children feel 咕点 is helping, not monitoring |
| Child first-step completion | 3/5 children can complete or read a usable first-step sentence |
| 专注舱 fit | 3/5 families think 专注舱 makes sense after first step |
| Profile recap value | 4/5 parents find Profile recap useful and not heavy |
| Score claim misunderstanding | 0/5 parents think it guarantees score improvement |
| Course-selling misunderstanding | 0/5 parents interpret it as course-selling |

### Scoring Guidance

Use a 1-5 score for each subjective dimension:

1 = strongly negative / confused  
2 = weak / hesitant  
3 = acceptable  
4 = clear positive  
5 = strong positive, user explains value unprompted

Trust and child acceptance should be captured both as score and quote. Quote beats score when they conflict.

## 8. Failure Signals

Hard failure signals:

1. Parent says “这就是拍照搜题/搜答案.”
2. Parent expects the app to produce a complete answer.
3. Child says “这像在向家长汇报我.”
4. Child says 咕点 feels annoying, childish, fake, or supervisory.
5. 三问 feels like interrogation, test, or blame.
6. 专注舱 feels like an unrelated timer.
7. Profile feels like surveillance, report wall, weakness dashboard, or parent pressure.
8. Parent asks for direct answer as the main value.
9. Parent says “不能提分就没用.”
10. Product takes longer than parent help without reducing conflict.
11. Parent sees payment/course/service intent.
12. Child refuses to continue before completing first-step sentence.

If 2 or more hard failures appear in 5 families, do not proceed directly to UI implementation. Revise product copy or flow first.

## 9. Observation Form

Use one row per participant. For family-level notes, add parent and child rows plus a shared family note.

| Field | Entry |
| --- | --- |
| Participant ID | P1 / C1 / T1 |
| Participant type | Parent / Child / Teacher-Tutor |
| Child grade | Grade 4 / 5 / 6 / 7 |
| City tier | Tier 1 / new Tier 1 / strong Tier 2 |
| Subject pain | Math word problem / equation setup / reading question / writing process / other |
| Homework friction | Low / medium / high |
| 5-second understanding | Exact words |
| Mistaken category | Answer solver / AI tutor / wrong-question notebook / timer / report / none |
| Anti-answer trust score | 1-5 |
| Child acceptance score | 1-5 / N/A |
| 三问 acceptance | 1-5 |
| First-step completion | Yes / Partial / No |
| 专注舱 acceptance | 1-5 |
| Profile recap acceptance | 1-5 |
| Score-claim misunderstanding | Yes / No |
| Course-selling misunderstanding | Yes / No |
| Major quote | Verbatim |
| Hard failure signal | Yes / No; specify |
| Overall pass/fail | Pass / Borderline / Fail |
| Notes | Free text |

### Family-Level Summary Template

| Field | Entry |
| --- | --- |
| Family ID | F1 |
| Parent pass? | Yes / No |
| Child pass? | Yes / No |
| Biggest trust risk | Text |
| Biggest child acceptance risk | Text |
| Strongest product moment | Text |
| Weakest product moment | Text |
| Should include in 7-night pilot? | Yes / No |

## 10. 7-Night Pilot Design

### Pilot Shape

| Item | Design |
| --- | --- |
| Families | 5-10 families |
| Duration | 7 real homework nights |
| Target | Grade 4-7, real evening homework friction |
| Mode | Local-first miniapp / prototype / guided demo depending on readiness |
| Support | Researcher checks in once per day, not during homework unless needed |

### Daily Family Task

Each homework night:

1. When child gets stuck, open Home.
2. Enter or select the stuck point.
3. Complete 三问.
4. Read the first-step card.
5. Enter 专注舱 or do an equivalent focus action for that first step.
6. Complete or interrupt honestly.
7. Parent checks Profile recap.
8. Next day, try Tools light revisit if available.

### Daily Parent Mini Survey

Ask after homework:

1. “今晚孩子卡住了吗？卡在哪里？”
2. “孩子是否说出了第一步？Yes / Partial / No”
3. “您有没有直接讲答案？0 / 1 / 2+ 次”
4. “今晚冲突比平时少吗？少很多 / 少一点 / 差不多 / 更多”
5. “Profile 里哪一句最有用？”
6. “您明天还愿意用吗？为什么？”

### Daily Child Mini Survey

Ask after homework:

1. “今天咕点像在帮你，还是像在盯你？”
2. “三问烦不烦？1-5”
3. “你知道自己第一步是什么吗？Yes / Partial / No”
4. “专注舱有没有帮你坐住一会儿？Yes / No”
5. “你明天还愿意让咕点陪吗？为什么？”

### Data To Collect

1. Nights opened.
2. Stuck point entered.
3. 三问 completed.
4. First-step sentence completed.
5. 专注舱 or equivalent focus action started.
6. Completion or interruption.
7. Parent recap viewed.
8. Light revisit attempted.
9. Parent-reported conflict level.
10. Child acceptance score.
11. Verbatim quotes from parent and child.

### Active Use Definition

A night counts as active use if:

1. A real stuck point is entered or selected.
2. A first-step sentence is generated or written.
3. Parent or child can identify the intended first step.

### Successful Night Definition

A night counts as successful if:

1. Child articulates or accepts a first-step sentence.
2. Child starts 专注舱 or equivalent focused action.
3. Parent reports the product helped them ask less harshly or avoid direct answer-giving.
4. Child does not reject future use.

### 7-Night Pass Criteria

1. 40%+ families use 4+ nights.
2. Parents report lower conflict in at least 3 nights.
3. Children do not reject the product.
4. At least 50% of nights include first-step articulation.
5. At least 50% of first-step nights enter 专注舱 or equivalent focus action.

### 7-Night Fail Criteria

1. Most families only use once.
2. Parents mainly ask for direct answers.
3. Children describe the product as monitoring.
4. 专注舱 is skipped because it feels irrelevant.
5. Profile recap causes more parent pressure.
6. Families cannot explain why they would return tomorrow.

## 11. Claim Boundaries During Validation

### Researchers Can Say

1. “这个产品不直接给答案。”
2. “它想帮孩子看清今晚第一步。”
3. “它会陪孩子专注做一小段。”
4. “它希望帮家长少讲答案，多问对一句。”
5. “我们正在验证它是否能减少作业冲突。”
6. “现在还不是付费测试。”
7. “现在不验证提分，只验证理解、信任和使用意愿。”

### Researchers Cannot Say

1. “可以提分。”
2. “可以掌握知识点。”
3. “可以替代老师。”
4. “可以替代家长。”
5. “可以自动诊断薄弱点。”
6. “可以防止孩子所有拖延。”
7. “可以保证提升成绩。”
8. “可以避免所有作业冲突。”
9. “比作业帮/小猿更好。”
10. “以后一定会收费/现在就值得付费。”

## 12. Validation Decision Rules

| Decision | Evidence Required | Threshold | Next Action |
| --- | --- | --- | --- |
| A. Proceed to UI implementation | Parents understand value; children accept; no answer-solver confusion | Meets all core pass thresholds | Start UI with locked hierarchy |
| B. Revise product copy | Users understand flow only after explanation | Any 2 parent confusion signals | Rewrite Home/Upload/Profile copy before UI |
| C. Revise mainline flow | Users cannot connect Home -> first step -> focus -> recap | 2+ families cannot retell route | Simplify flow and retest |
| D. Cut or hide 专注舱 secondary mechanics | Timer/scenes/audio/social distract from task | 2+ families call it generic timer or wallpaper | De-emphasize atmosphere controls in UI |
| E. Rework 咕点 | Child feels monitored, childish, or fake | Fewer than 3/5 children accept 咕点 | Adjust mascot role/copy/visual direction before UI |
| F. Stop payment thinking | Parent value is unclear or tied to answer solving | Any payment interest depends mainly on answers or scores | Do not test payment; return to trust validation |
| G. Prepare 7-night pilot | Interview pass thresholds met and families volunteer for real use | 3+ families willing to try in real homework nights | Run 7-night pilot |

### Decision Priority

If signals conflict, prioritize in this order:

1. No-answer trust.
2. Child acceptance.
3. Mainline clarity.
4. Parent recap usefulness.
5. 专注舱 fit.
6. Payment curiosity.

Payment curiosity is never allowed to override trust or child safety.

## 13. Final Status Lines

VALIDATION_PACK_READY = YES

READY_TO_RECRUIT_PARENT_CHILD_TESTERS = YES

READY_FOR_PAYMENT_TEST = NO

READY_FOR_SCORE_CLAIM = NO

READY_FOR_INVESTOR_STORY = NO
