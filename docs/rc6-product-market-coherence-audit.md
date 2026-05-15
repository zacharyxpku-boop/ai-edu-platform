# RC6 Product-Market Coherence Audit

> Scope: strategy audit only. No code, UI, test, AppID, backend, upload, or feature change.

## 1. One-Product Coherence Audit

### Verdict

Current RC6 is **mostly one coherent product**, not just a competitor-feature mashup, but the coherence is fragile.

It becomes one product only when framed as:

> 原点私教是中国家庭晚间作业陪伴小程序。咕点陪孩子从“卡住”走到“看清第一步”，再在专注舱里把这一小步做完，最后让家长 5 秒看懂今晚发生了什么。

If framed as AI 解题、错题本、专注计时器、自习室、成长系统、IP 陪伴的并列组合, it immediately becomes messy.

### Central User Promise

**今晚不求一下子学会全部，只先看清并做完一个小小的第一步。**

### Features That Reinforce The Promise

| Feature | Why It Supports The Promise |
|---|---|
| Home “今晚先从哪一步开始” | Defines the product's entry point around tonight's immediate pain. |
| Upload/Input | Gives the family a simple place to describe where the child is stuck. |
| Diagnosis 三问 | Converts vague anxiety into a bounded first step. |
| Review 修卡点 | Lets the child say “我卡在哪 / 我先看哪里 / 我的第一步怎么说”. |
| 专注舱 | Converts “I know the first step” into “I stayed with it and did something”. |
| Tools 轻回访 | Keeps yesterday's effort alive without turning it into heavy review. |
| Profile 家长 5 秒复盘 | Gives the buyer a calm, non-report-wall proof of value. |
| 咕点 | Creates emotional consistency and lowers the child's shame/pressure. |

### Features That Risk Diluting The Promise

| Feature Area | Dilution Risk |
|---|---|
| Scenes / wallpapers | Can make 专注舱 feel like a focus wallpaper app if over-marketed. |
| Audio modes | Useful ambience, but weakens positioning if treated as a main sell point. |
| Study-room / leaderboard architecture | Highest risk. Can pull product toward social competition and away from family relief. |
| Growth / streak / badges | Helpful if gentle; dangerous if it becomes another pressure system. |
| Legacy deep pages: module / arcade / tutor / radar | Even if not primary tabs, their conceptual residue can make the product look like an old learning platform bundle. |

### Does 专注舱 Strengthen Or Distract?

**It strengthens the product if it is framed as “把今晚这一小步做完”.**  
It distracts if framed as “番茄钟 + 壁纸 + 音乐 + 自习室 + 打卡”.

The right hierarchy:

1. First-step task is the anchor.
2. Timer is the container.
3. Scene/audio are atmosphere.
4. Growth is evidence.
5. Study room is future optional social proof, not current core.

### Does 咕点 Unify The Experience?

**Yes, strategically. Not yet visually.**

咕点 gives the product a single emotional voice:

> 我懂你卡住了，我陪你先迈出第一步。

But without final visual assets and a unified UI system, 咕点 still risks being perceived as copy pasted into several pages instead of a living product character.

### Are The Tabs One Story?

The story can be coherent:

Home: 今晚先做什么  
Upload/Input: 把卡住点说出来  
Diagnosis: 三问收束第一步  
Review: 孩子说清第一步  
专注舱: 咕点陪你做完这一小步  
Tools: 明天轻轻回访  
Profile: 家长 5 秒看懂

But the tab order and deep feature surface must keep repeating this story. Any page that feels like “功能集合” will damage coherence.

**PRODUCT_COHERENCE_SCORE = 7/10**

The product has a real center, but it is one UI layer away from becoming too crowded.

## 2. Competitor Category Mapping

| Category | User Expectation | Our Resemblance | Relative Position | Helps Or Confuses | Must Avoid |
|---|---|---|---|---|---|
| AI homework answer tools | Fast answer, explanation, photo solve | Upload/Input and stuck-point flow may look similar at first | Different if anti-answer promise is clear; weaker if user expects answers | Helps acquisition curiosity, confuses trust | “拍照出答案”, “秒解”, complete solution framing |
| AI chat / general education assistant | Ask anything, get AI response | 咕点 companion and diagnosis Q&A | Different: bounded evening route, not open chat | Helps familiarity, confuses if too chatty | Generic chatbot UI and endless conversation |
| Wrong-question notebook | Collect mistakes, review weak points | Review and Tools light revisit | Different: immediate first step, not archival correction | Helps retention, can confuse if too much record/report | Heavy “错题管理”, “薄弱点分析” language |
| Parent learning report product | Parent sees performance and progress | Profile recap | Different: 5-second calm recap, not dashboard | Helps buyer value, confuses if report-heavy | Report wall, charts-first, score-first |
| Tutoring / course product | Human/AI teacher teaches knowledge | Old teacher framing, Review repair | Different: companion, not tutor | Dangerous if framed wrongly | Teacher team, subject teacher, course promise |
| Pomodoro / focus timer app | Timer, white noise, focus stats | 专注舱 | Weaker as pure timer; stronger when bound to first step | Helps usage frequency, confuses if hero is timer | “效率工具” as primary identity |
| Virtual study room / community | Co-study, presence, ranking, check-in | Study-room placeholder | Future expansion, not current strength | Can help retention later; currently risky | Leaderboard, PK, peer pressure |
| Habit / streak / gamified learning app | Streaks, rewards, badges | Growth evidence | Useful as gentle evidence | Helps repeat use, confuses if too game-like | 闯关, XP, rank, pressure loops |
| Mascot-led education brand | Emotional attachment, IP recall | 咕点 | Promising if mascot has real role | Helps memorability | Mascot as decoration or course mascot |

Strategic rule: borrow from categories only as **supporting mechanics**, not as product identity.

## 3. Feature Collision Audit

| Module | Core Job | User Value | Market Analogy | Confusion Risk | Recommendation | One-Sentence Frame |
|---|---|---|---|---|---|---|
| Home | Start tonight's route | Parent/child instantly know where to begin | Family homework assistant | Low | Keep | “今晚先从哪一步开始。” |
| Upload/Input | Capture stuck point | Turns chaos into input | Homework helper | Medium | Keep, guard copy | “把卡住点说出来，不是让 AI 直接给答案。” |
| Diagnosis 三问 | Narrow the problem | Makes first step concrete | Guided reflection | Low | Keep | “咕点问三句，帮你看清第一步。” |
| Review 修卡点 | Let child articulate | Builds child agency | Micro review card | Low | Keep | “我卡在哪，我先看哪里，我怎么开口说第一步。” |
| 专注舱 | Sustain effort | Helps child actually do the first step | Focus room / Pomodoro | Medium-high | Keep but tightly bind to first step | “咕点陪你把今晚这一小步做完。” |
| Tools 轻回访 | Bring back recent evidence | Makes learning loop continue | Light review | Medium | Reposition away from toolbox | “明天轻轻回来看一眼。” |
| Profile | Parent 5-second proof | Reduces parental uncertainty | Parent recap | Medium | Keep minimal | “家长只看今晚孩子有没有迈出一步。” |
| 咕点 mascot | Emotional glue | Lowers shame and conflict | Mascot companion | Low-medium | Preserve | “我懂你卡住了，我陪你先迈出第一步。” |
| Growth/streak/badge | Evidence of staying | Encourages continuation | Habit product | Medium | Keep gentle, hide pressure | “不是排名，是留下今晚努力过的证据。” |
| Study-room/leaderboard placeholder | Future social presence | Potential retention | Virtual study room | High | Hide until validated | “以后可以有人一起安静学，但现在不抢主线。” |
| Scene/audio | Atmosphere | Makes studying feel less painful | Focus app | Medium | Keep as background layer | “换个舒服一点的地方，陪你坐住这一小段。” |

## 4. China Family Suitability Audit

### Is It Solving A Real Chinese Family Evening Pain?

Yes. The pain is not simply “孩子不会题”, but:

- 晚上时间有限。
- 家长已经累了。
- 孩子一卡住就容易崩。
- 家长越急，孩子越抗拒。
- AI 工具给答案太快，家长不放心。
- 传统学习产品太像任务、报告、测评和压力。

This product's strongest local fit is: **帮家庭把今晚作业冲突降温，并把“不会”变成一个可做的小动作。**

### Does It Reduce Parent-Child Conflict?

Potentially yes, if UI avoids supervision tone. 咕点 should act as a soft third party:

- It hears the child first.
- It does not accuse.
- It does not expose a weakness.
- It gives the parent one calm question instead of a report.

### Does It Avoid Direct-Answer Cheating?

Strategically yes. The product line is anti-answer-solver. The risk is Upload/Input: any photo/input page visually similar to homework solver apps must explicitly say it helps find the first step, not generate answers.

### Does It Avoid Becoming Another Pressure System?

Partially. 专注舱, streak, completion counts, and study-room concepts are useful but dangerous. In China-family context, “打卡 / 连续 / 排名 / 自习室” can easily become pressure. The UI must soften them into “留下努力证据”, not “必须坚持”.

### Does 专注舱 Make Sense For Chinese Families?

Yes, if it is not a productivity app concept. It should be presented as:

> 写作业时，咕点陪孩子安静坐住 15 分钟，把第一步真正做一下。

This is more culturally suitable than “Pomodoro productivity”.

### Does 咕点 Feel Trustworthy?

咕点 can be trustworthy if it is:

- gentle but not childish,
- funny but not frivolous,
- clear about not giving direct answers,
- useful in each step,
- visible to parents as a conflict-reduction companion.

It will lose trust if it behaves like a generic AI robot, course mascot, or overactive chatbot.

### Will Children Feel Helped Or Supervised?

They will feel helped if the product says:

- “卡住没关系。”
- “先做一小步。”
- “你不用马上会全部。”

They will feel supervised if the product says:

- “坚持打卡。”
- “完成目标。”
- “排名提升。”
- “家长查看报告。”

### 5-Second Parent Attention Trigger

“今晚孩子卡住时，不直接给答案，而是陪他讲清第一步，再专注做一小段。”

### Immediate Close Triggers

- Looks like direct answer cheating.
- Looks like another paid course funnel.
- Looks like performance report/dashboard.
- Looks like a childish cartoon app for younger children.
- Looks like a ranking/check-in pressure machine.

### Cultural/Emotional Risks

1. 家长对“AI 作业”天然担心作弊。
2. 孩子对“学习陪伴”可能理解为监控。
3. 初中家庭对幼稚 IP 接受度有限。
4. “自习室/打卡/连续天数”容易被家长用成压力工具。
5. 教育产品商业化痕迹会迅速破坏信任。

## 5. Parent-User-Child-Buyer Tension Audit

| Stakeholder | Primary Pain | Desired Outcome | Fear | Trust Trigger | Rejection Trigger | Product Should Show | Product Should Hide |
|---|---|---|---|---|---|---|---|
| Buyer: parent | 晚上陪作业崩溃、担心孩子依赖答案 | 孩子能说出第一步，情绪少崩 | AI 偷懒、骗钱、又来一个课 | 不给答案、孩子能开口、5 秒复盘 | 付费课、报告墙、排行榜 | 今晚第一步、家长只问一句、努力证据 | 复杂能力、商业入口、社交竞争 |
| Daily user: child | 卡住丢脸、怕被骂、开始不了 | 有人懂我，先做一小步 | 被监控、被评价、被逼打卡 | 咕点不凶、不讲大道理、任务很小 | 长篇说教、强打卡、家长报告感 | 咕点陪伴、短句、专注舱氛围 | 分数、排名、弱点标签 |
| Emotional stakeholder: family | 晚上冲突升级 | 作业时间不再爆炸 | 产品制造新矛盾 | 亲子对话变短变稳 | 家长拿产品当管控工具 | 一句可问的话、温和证据 | 诊断标签、压力指标 |
| Possible channel: school/after-school | 家校沟通、课后学习延续 | 低风险辅助工具 | 违规答题、数据风险、家长投诉 | 本地优先、反答案、轻回访 | 商业化太重、不可控社交 | 合规边界、学习过程证据 | 排名、聊天社交、直接解题 |

Current balance: **parent value and child acceptance are directionally balanced, but child acceptance depends heavily on UI tone.** The product must not let Profile/report and growth/streak leak too strongly into the child's experience.

## 6. Marketability And Marketing Audit

### Simplest Marketing Sentence

**孩子晚上作业卡住时，咕点不直接给答案，只陪他看清第一步，并专注做完这一小段。**

### 5-Second Pitch To A Parent

“不是拍照出答案。孩子卡住时，咕点帮他讲清第一步，再陪他安静做 15 分钟，最后你只看一句复盘。”

### 5-Second Pitch To A Child

“卡住没事。咕点陪你先找一个小小的第一步，做一会儿就算开始了。”

### 30-Second Pitch To An Investor

“原点私教切入中国家庭晚间作业高频冲突场景，不做直接答案工具，而是用 AI 三问把卡点收束成第一小步，再通过咕点专注舱把第一步转化为真实学习时长和本地证据，最后给家长极简复盘。它的价值不是替孩子做题，而是降低亲子冲突、提升开始率和持续率，未来可扩展到家庭订阅、学习陪伴 IP、轻量复习闭环和教育服务转化。”

### Product Category Name

**家庭晚间作业陪伴**

### What It Should NOT Call Itself

- AI 解题神器
- 拍照搜题工具
- 错题本
- 学习报告系统
- 专注计时器
- 自习室 App
- AI 老师
- 智能测评平台
- 课程服务平台

### Strongest Slogan

**我懂你卡住了，我陪你先迈出第一步。**

### Hero Feature In Marketing

Hero should be **“看清并做完今晚第一步”**, not 专注舱 alone.

专注舱 should be marketed as the proof that the product goes beyond advice:

> 不是只告诉你第一步，而是陪你把这一小步做完。

### 咕点 Positioning

咕点 should be marketed as **companion/guide**, not teacher, not AI assistant, not IP toy.

### Parent-Facing Taglines

1. 不直接给答案，先帮孩子说清第一步。
2. 晚上作业卡住时，少一点吼，多一步开始。
3. 孩子今晚有没有迈出第一步，你 5 秒看懂。
4. 咕点陪孩子把卡住的地方变成一个小动作。
5. 从“我不会”到“我先这样做”，今晚先走一步。

### Child-Facing Taglines

1. 卡住没事，咕点陪你先看第一步。
2. 不用一下子全会，先做一小段。
3. 你说哪里卡住，咕点陪你坐一会儿。
4. 今天先迈一小步，也算很认真了。
5. 先别慌，我们只看下一步。

### Investor-Facing One-Liners

1. A family evening homework companion that turns stuck points into completed first-step sessions.
2. Not an answer solver: a local-first AI route system for reducing homework conflict.
3. A high-frequency family education wedge built around the moment children get stuck at night.
4. Mascot-led study companionship with evidence loops for children and calm recaps for parents.
5. The product layer between homework help, focus time, and parent trust.

### App-Store / Landing-Page Title Options

1. 原点私教：今晚先迈出第一步
2. 咕点陪学：卡住时先走一小步
3. 原点私教：家庭晚间作业陪伴
4. 咕点专注舱：陪孩子做完第一步
5. 原点智学：不直接给答案的作业陪伴

### Short Social Media Hooks

1. 孩子写作业卡住，别急着讲答案，先让他说出第一步。
2. 晚上陪作业最怕什么？不是不会，是一开口就崩。
3. 我们做了一个不直接给答案的 AI 作业陪伴。
4. 孩子说“我不会”时，咕点只问三句。
5. 真正有用的陪学，不是秒解，是让孩子愿意开始。

## 7. Investment / Venture Perspective Audit

### Wedge Market

The wedge is strong: **Chinese family evening homework conflict** is frequent, emotional, and painful. It is narrower and more believable than “AI education platform”.

### Urgency Of Pain

High. The problem happens at night, repeatedly, and carries emotional cost for parents and children.

### Frequency Of Use

Potentially high on school nights, but only if the product remains lightweight. If input/diagnosis feels heavy, frequency will collapse.

### Retention Loop

Current loop:

卡住 -> 第一小步 -> 专注完成 -> 证据 -> 明天轻回访 -> 家长复盘 -> 下次再来

This is a real retention loop, not just content consumption.

### Willingness To Pay

Plausible but unproven. Parents pay for reduced conflict and credible learning help, not for timer, scenes, or mascot alone.

### Expansion Path

1. Parent subscription for family homework companion.
2. Premium companionship/focus environments after trust is built.
3. Family learning plan based on repeated stuck-point patterns.
4. Offline education/service conversion if product evidence proves intent.
5. B2B2C pilots only after compliance and anti-answer trust are clear.

### Why It Is Not Just A Prompt Wrapper

Because the value is not one AI response. The defensible product layer is:

- bounded homework-night workflow,
- local evidence state,
- first-step framing,
- focus completion,
- parent recap,
- revisit loop,
- mascot trust layer.

### Why It Is Not Just A Timer

Because 专注舱 is task-bound to the first step and writes learning evidence back to Profile and Tools. A generic timer does not know what the child was stuck on.

### Why It Is Not Just A Homework Helper

Because it refuses direct-answer framing and focuses on family conflict, child agency, and completion of a small step.

### Proof Points Investors Would Need

1. Parent 5-second understanding rate.
2. Child willingness to use it without being forced.
3. Repeat use across 7-14 school nights.
4. Evidence that 专注舱 increases actual start/completion behavior.
5. Reduced parent-child conflict signals.
6. Conversion willingness after trust is established.
7. Clear CAC/channel path beyond founder-led demos.

### Biggest Current Investment Risks

- Too many category signals before one growth wedge is proven.
- No real user retention evidence yet.
- Mascot visual/IP not validated.
- Monetization trust risk in education.
- Direct-answer competitors may own the acquisition vocabulary.

**INVESTOR_NARRATIVE_SCORE = 6.5/10**

The narrative is promising but not yet investment-ready. It needs user proof, not more features.

## 8. Monetization Fit Audit

| Path | Fit With Current Product | Short-Term Suitability | Long-Term Potential | Trust Risk | Should Appear In Current UI | Evidence Needed |
|---|---|---|---|---|---|---|
| Parent subscription | High | Medium after smoke/user proof | High | Medium | No | Repeat usage, parent perceived value, willingness to pay |
| Premium focus scenes/audio/theme packs | Medium | Low | Medium | Medium-low | No | Children actually use 专注舱 repeatedly and care about atmosphere |
| Family learning plan | Medium-high | Low | High | Medium-high | No | Enough stuck-point history and parent trust |
| Offline education service conversion | Medium | Low | Medium-high | High | No | Clear demand for human/service escalation without hurting trust |
| School / after-school pilot | Medium | Low | Medium | High compliance risk | No | Safety, content boundaries, school acceptance |
| B2B2C channel | Medium | Low | High if proven | High | No | Partner proof, retention, compliance, data policy |
| IP / mascot extensions | Medium | Low | Medium | Low-medium | No | 咕点 affection, sticker usage, social sharing |
| Study-room/social features | Low-medium now | Low | Medium | High | No | Child safety, moderation, genuine co-study demand |

Monetization should stay invisible in RC6. The current product must earn trust first.

## 9. Product Architecture Recommendation

### Recommended Framing

Primary category:

**B. family evening homework companion**

Secondary category:

**A. AI homework first-step companion**

Do not frame as:

- D. AI study coach
- E. focus + homework hybrid
- pure 咕点学习陪伴空间

Those frames are either too generic, too broad, or too feature-led.

### Final Conceptual Architecture

Core loop:

> 输入卡点 -> 三问收束 -> 第一小步 -> 专注做一段 -> 明天轻回访 -> 家长 5 秒复盘

### Main Tab Logic

| Tab | Meaning |
|---|---|
| Home / 作业点拨 | Route start: tonight begins here. |
| 专注舱 | Usage center: do the first step with 咕点. |
| Review / 修卡点 | First-step clarity: say what is stuck and where to look. |
| Tools / 轻回访 | Continuity: gently revisit recent effort. |
| Profile / 我的 | Parent value center: calm proof and recap. |

### Centers

- Emotional center: **咕点**
- Route center: **Home**
- Usage center: **专注舱**
- Learning clarity center: **Review**
- Parent value center: **Profile**
- Retention center: **Tools + 专注舱 evidence**

## 10. Risk Diagnosis

| Risk | Why It Matters | Severity | Recommended Action | Type |
|---|---|---|---|---|
| Positioning risk | Too many analogies can blur the product into “another AI learning app”. | P1 | Make “家庭晚间作业陪伴 / 今晚第一步” the only top-level frame. | Product + Marketing |
| Product bloat risk | Scenes/audio/social/growth can overwhelm the first-step promise. | P1 | Hide secondary mechanics behind the first-step task; do not market them equally. | Product + UI |
| Trust risk | Parents may fear cheating or commercialization. | P1 | Keep anti-answer copy visible and avoid monetization UI. | Copy + UI |
| Child rejection risk | Child may feel monitored or infantilized. | P1 | Make 咕点 low-pressure and avoid report/streak pressure in child-facing screens. | UI + Copy |
| Parent misunderstanding risk | Parent may expect answer solving or full tutoring. | P1 | Use 5-second parent framing: “不直接给答案，只帮孩子说出第一步”. | Marketing + Copy |
| Competitive weakness risk | Pure timer/homework/helper categories have stronger incumbents. | P2 | Compete on workflow and trust, not feature parity. | Product |
| UI coherence risk | Current UI is visually weak and may not express one story. | P1 | UI rebuild must use one narrative path and one mascot presence system. | UI |
| Monetization risk | Early payment/course signals can break trust. | P1 | Keep monetization out until user validation proves value. | Business |
| Retention risk | Diagnosis may be too much friction for daily use. | P1 | In UI prototype, test one-minute input-to-first-step path. | Research + Product |
| Implementation risk | Legacy pages and placeholder systems may resurface old product smell. | P2 | Keep deep pages hidden/reframed; audit visible routes during UI rebuild. | Product + QA |

## 11. What To Do Before UI Redesign

### Decisive Recommendation

Proceed to UI redesign, but do **not** redesign all current functions as equal citizens.

The product is coherent enough for UI rebuild, but the UI must impose hierarchy:

1. First-step loop is the product.
2. 专注舱 is the usage center because it helps complete the first step.
3. 咕点 is the emotional glue, not decoration.
4. Scenes/audio/growth/study-room are secondary atmosphere/evidence systems.
5. Profile is proof for parents, not a dashboard.

### Keep All Current Functions?

Technically yes. Strategically no.

Keep them in architecture, but UI should hide or de-emphasize:

- study-room/leaderboard placeholder,
- badges/milestones if they look competitive,
- scene/audio as hero-level selling points,
- legacy deep pages unless they are tightly reframed.

### Hide Some Functions?

Yes.

Hide or subordinate:

- leaderboard/peer comparison,
- heavy growth achievements,
- any “toolbox” impression,
- old module/tutor/radar/arcade conceptual signals.

### Reposition Some Functions?

Yes.

- 专注舱: from timer to “做完第一步”.
- Tools: from tools to “明天轻轻回访”.
- Profile: from report to “家长只看一句”.
- Growth: from gamification to “努力证据”.
- Scene/audio: from feature to mood support.

### Simplify Navigation?

Keep current five-tab structure for now, but ensure every tab name and first screen tells one story. If UI prototype feels crowded, Tools should become a quieter revisit entry, not a visible feature hub.

### Change Tab Names?

No immediate name change required if current visible names are:

- 作业点拨
- 专注舱
- 修卡点
- 轻回访
- 我的

But “我的” should visually behave like parent recap, not a personal center/dashboard.

### Adjust Marketing Hierarchy?

Yes.

Hero message:

> 今晚先迈出第一步。

Sub-message:

> 咕点不直接给答案，只陪孩子看清第一步，并在专注舱里把这一小步做完。

Do not hero:

- scenes,
- audio,
- streak,
- study room,
- mascot IP alone.

### Run User Interviews?

Yes, but after a clickable UI prototype, not before. The next validation should be small and practical:

- 5 parents, especially mothers who accompany homework at night.
- 5 middle-school children.
- Task: explain what the app does in 5 seconds, complete first-step path, enter 专注舱, read Profile recap.

### Run Parent Smoke Tests?

Yes. This is more important than adding features.

Critical questions:

1. Do parents understand it is not giving answers?
2. Do they see how it reduces tonight's conflict?
3. Do children feel helped rather than supervised?
4. Does 专注舱 feel useful or like extra homework?
5. Does 咕点 feel trustworthy or childish?

## 12. Final Status Lines

PRODUCT_COHERENCE_READY_FOR_UI_REBUILD = YES

PRODUCT_MARKET_POSITIONING_CLEAR = YES

FEATURE_SET_TOO_MESSY = YES

CHINA_FAMILY_FIT = STRONG

INVESTOR_NARRATIVE_READY = NO

MARKETING_MESSAGE_READY = YES

## Required Final Summary

### One-Sentence Product Definition

原点私教是中国家庭晚间作业陪伴小程序，咕点不直接给答案，而是陪孩子看清今晚第一步、专注做完一小段，并让家长 5 秒看懂。

### Recommended Product Category

Primary: **家庭晚间作业陪伴**  
Secondary: **AI 作业第一步陪伴**

### Core Target User

核心购买者是晚上陪作业的中国家长，尤其是母亲；核心日常用户是作业中容易卡住、抗拒被说教的中小学生。

### Core Pain

孩子一到晚间作业就卡住、拖住、崩住，家长想帮又容易变成催促和冲突。

### Core Promise

不直接给答案，不做压力系统，只陪孩子把“我不会”变成“我先迈出这一小步”。

### Top 5 Risks

1. 功能过多导致产品像拼盘。
2. 专注舱被理解成普通计时器或壁纸工具。
3. 家长误解为拍照解题或商业课程入口。
4. 孩子感觉被监督、被打卡、被报告。
5. 咕点没有视觉资产前容易停留在文案层。

### Top 5 Things To Preserve

1. “孩子今晚先迈出第一步”的核心定位。
2. “不直接给答案”的信任边界。
3. 咕点作为单一陪伴角色。
4. Home -> Diagnosis -> Review -> 专注舱 -> Tools -> Profile 的证据闭环。
5. 家长 5 秒复盘的轻量价值。

### Top 5 Things To Change Before UI Redesign

1. 把 专注舱 明确设计成“做完第一步”，不是计时器首页。
2. 把 scenes/audio/study-room/growth 降为氛围和证据层，不做同级卖点。
3. 把 Profile 视觉从个人中心/报告感转成家长一句话复盘。
4. 把 Tools 彻底做成轻回访，不做工具箱。
5. 把所有旧 module/arcade/tutor/radar 气味藏住或重构叙事，避免用户看到旧产品拼盘感。

### Final Recommendation

**Proceed to UI redesign, but with product hierarchy locked first.**

Do not add features. Do not market 专注舱 as a standalone focus product. Do not push investor/commercial narrative yet. The next best step is a Variant UI rebuild that makes the full product feel like one calm evening route:

> 卡住 -> 看清第一步 -> 专注做一段 -> 明天轻回访 -> 家长 5 秒复盘。

After the UI prototype, run small parent-child validation before AppID upload or public-facing marketing.
