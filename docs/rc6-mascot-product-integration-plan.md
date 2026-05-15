# RC6 Mascot Product Integration Plan

## 1. Readiness summary

Is mascot setting ready? **YES**

咕点的世界观、名字、核心情绪、视觉方向和语气已经足够稳定，可以承接原点私教从“六位老师陪伴”到“一个品牌 mascot 陪孩子先迈出第一步”的产品叙事。

Is mascot visual asset ready? **NO**

当前只有文字设定，没有头像、状态图、贴纸、空状态插图或真机 UI 可用视觉素材。Variant 可以开始设计，但小程序产品内还不能依赖 mascot 图片。

Is mascot product integration ready? **NO**

产品叙事已经准备好，但前台代码和文案仍保留大量六老师 / teacher / companion matrix 残留。当前不应宣称 mascot 已完成产品集成。

Current gate judgment:

**MASCOT_READY_FOR_COPY_INTEGRATION = YES**

**MASCOT_READY_FOR_VISUAL_UI_REBUILD = YES**

**MASCOT_ALREADY_IN_PRODUCT = NO**

## 2. User-visible six-teacher residues

### Home

Home 是六老师残留最强的位置。

Current residues:

- `homeViewModel.teacherPickerLabel`: “今天想被怎么陪？”
- `homeViewModel.teacherPickerHint`: “老师都会陪你走完今晚路线，只是陪法不同。”
- `companionOptions` 渲染 2x3 选择区。
- 默认 `companionPreference`: 小原。
- fallback copy: “今天由 小原 陪你：先把今晚理顺。”
- home view-model 中仍有六个角色语气：小原、问问、安安、阿衡、团团、跃跃。
- Home 仍有“老师不会直接给答案，会先陪你找到第一步。”

Impact:

Home 当前仍会让用户理解为“先选陪伴老师”，而不是“咕点陪我先迈出第一步”。这是 mascot 替换的 P0 前台残留。

### Upload

Upload 本身在本轮 targeted search 中没有明显六老师名字残留。它应成为咕点接住卡点的入口，但当前缺少咕点叙事。

Potential integration gap:

- 用户上传/输入卡点时还没有统一 mascot voice。
- 后续不应加入 mascot 图片依赖；先用短文案即可。

### Diagnosis

Diagnosis 当前不是六老师残留重灾区，但需要把“三问收束”改成咕点式陪问。

Potential integration gap:

- 需要避免测评感。
- 需要用咕点短句承接“我不会”。

### Review

Current residues:

- review view-model 默认 `selectedLabel`: 小原。
- fallback copy: “小原陪你把这个卡点放回今晚路线里，只先看第一步。”
- fallback copy: “小原陪你只修今晚最卡的一步。”
- review page fallback `companionLine`: “今天由 小原 陪你：先把今晚理顺。”
- Review 深层输入提示仍出现“老师批注”场景。

Impact:

Review 的核心“卡在哪 / 先看哪里 / 第一步怎么说”适合咕点，但当前仍有 old companion copy。需要最小替换成“咕点陪你只看第一步”。

### Tools

Current residues:

- tools view-model 默认 `selectedLabel`: 小原。
- fallback copy: “小原陪你用 2 分钟回访一下，确认这一步还顺不顺。”
- fallback copy: “小原陪你轻轻回访一个修过的卡点。”
- tools page fallback `companionLine`: “今天由 小原 陪你：先把今晚理顺。”
- tools page 示例内容仍提到“老师批注”。

Impact:

Tools 的目标应是“明天轻轻回访”，但 old companion copy 和部分“错题/批注整理”语言会让它像复习工具集合。咕点集成应先替换回访入口和空状态，不做新功能。

### Profile

Current residues:

- profile view-model 中仍有六角色整理文案。
- primary card section label: “老师提示你先看”。
- empty state: “老师会帮你整理给家长看。”
- profile page visible labels: “老师建议”“老师复盘建议”。
- profile fallback copy: “小原帮你整理今晚路线：先修一个卡点，再回访一小步。”
- profile fallback `companionLine`: “今天由 小原 陪你：先把今晚理顺。”

Impact:

Profile 是家长 5 秒复盘页，不能继续像老师建议或报告墙。这里应改为“咕点整理给家长看 / 小黑板提示 / 家长只问这一句”。

### Shared storage / utilities

Current residues:

- `COMPANION_OPTIONS` 仍是六个角色。
- `COMPANION_STAGE_COPY` 仍按六个角色分发全局 stage copy。
- `COMPANION_STRIP_COPY` 仍支持“今天由 X 陪你”。
- `formatCompanionLine` 输出“今天由 ${companion.label} 陪你”。
- `loadCompanionPreference` 默认小原。
- `getGrowthMemoryLine` 仍按 companion id 给六角色语气。

Impact:

这是最大工程集成点。后续实现应保留内部兼容层读取旧字段，但用户可见输出必须统一为咕点。

## 3. Where 咕点 should replace the old teacher concept

### Home

Mascot role:

咕点作为首屏情绪锚点，替代老师选择区。

Minimal copy direction:

- “我懂你卡住了，我陪你先迈出第一步。”
- “今晚先别全摊开，我们先找第一步。”
- “把作业或卡住点发来，说一句也行。”

Remove or defer:

- 2x3 老师选择区。
- “今天想被怎么陪？”
- “老师都会陪你走完今晚路线。”

### Upload

Mascot role:

咕点接住孩子说不清的卡点，降低输入压力。

Minimal copy direction:

- “把卡住的地方给咕点看看。”
- “不会说完整也没事，先说一句。”
- “这里不出完整答案，只找第一步。”

Do not add:

- mascot image dependency。
- OCR / direct answer promise。

### Diagnosis

Mascot role:

咕点把“我不会”收束成三问：卡在哪、先看哪里、第一步怎么说。

Minimal copy direction:

- “咕点先问三个小问题，找到入口就停。”
- “先别整题想，只看第一眼。”
- “你觉得第一步要看哪里？”

Do not add:

- 测评感。
- 能力判定。
- 老师审问语气。

### Review

Mascot role:

咕点陪孩子只修一个真实卡点，并让孩子说出第一步。

Minimal copy direction:

- “咕点陪你只修这一小步。”
- “我不讲完整答案，只陪你看第一步。”
- “你先说：第一步看哪里？”

Replace:

- “小原陪你……”
- “老师提示你……”

### Tools

Mascot role:

咕点作为轻回访提醒者，从昨天的小纸条里探头提醒一下。

Minimal copy direction:

- “昨天那一步，咕点陪你轻轻看一眼。”
- “不加量，只确认还顺不顺。”
- “还没有回访卡。先完成一次卡点修复。”

Avoid:

- 玩法合集感。
- 挑战感。
- 老师批注工具感。

### Profile

Mascot role:

咕点是家长 5 秒复盘翻译官。

Minimal copy direction:

- “咕点帮你整理成家长能看懂的一句话。”
- “家长今晚只问这一句。”
- “今天不是看分数，是看孩子有没有说出第一步。”

Replace:

- “老师建议” → “咕点小纸条” / “给家长的一句话”
- “老师复盘建议” → “家长只问这一句”
- “老师提示你先看” → “小黑板先提示你看”

### Empty states

Mascot role:

空状态不应像系统空白，而应像咕点轻轻提醒下一小步。

Minimal copy direction:

- Home empty: “今天还没说卡在哪。咕点在旁边，先说一句就行。”
- Review empty: “还没有卡点。先把今晚最卡的一步告诉咕点。”
- Tools empty: “还没有回访卡。修过一小步后，明天咕点再来轻轻看。”
- Profile empty: “还没有学习小结。完成一次卡点修复后，咕点会整理给家长看。”

## 4. Minimal integration plan

### Phase 1: Product copy integration only

Goal:

在不重设计 UI、不增加图片、不改变学习流的前提下，把用户可见叙事从六老师切到咕点。

Scope:

- Home / Review / Tools / Profile view-model fallback copy。
- Shared storage copy output。
- Home teacher picker visible copy and selector area。
- Profile visible labels。
- Empty states。
- Tests that currently断言 six-teacher copy。

Recommended implementation stance:

- 保留 `companionPreference` 等内部字段作为兼容层。
- 不再让前台展示六个角色。
- 不把咕点做成可选角色之一；咕点是唯一品牌脸。
- 不引入 mascot 图片。
- 不调整 core learning state：todayFocus、miniActionText、blackboardHint、reviewCard、growthMemory 继续保持。

Acceptance criteria:

- 用户可见页面不出现小原、问问、安安、阿衡、团团、跃跃。
- 用户可见页面不出现“今天由 X 陪你”。
- 用户可见页面不出现“今天想被怎么陪？”。
- 首页不再让用户理解为选老师。
- Profile 不再出现“老师建议 / 老师复盘建议”作为家长信息标题。
- 核心 loop 仍可跑通：输入卡点 → 三问收束 → 第一小步 → 修卡点 → 轻回访 → 家长 5 秒复盘。

### Phase 2: Variant UI rebuild

Goal:

用 Variant 重建首屏与关键路径，把咕点作为视觉和情绪锚点。

Scope:

- Home 首屏结构。
- 咕点视觉占位。
- 小黑板与咕点的关系。
- 空状态插图。
- 轻回访卡片。
- 家长 5 秒复盘页。

Should wait until this phase:

- mascot image / avatar / illustration。
- mascot 状态图：idle、stuck、thinking、blackboard、revisit、parent recap。
- mascot motion / micro-interactions。
- sticker-like assets。
- 分享图。

### Phase 3: Visual asset production

Goal:

基于 worldbuilding 输出正式 mascot 视觉资产。

Should wait:

- 角色定稿。
- 表情包。
- UI icon set。
- onboarding 插画。
- reminder / empty-state illustration。

## 5. What should wait until UI redesign

These should not be implemented in the copy-only integration pass:

- 生成或接入咕点图片。
- 重画 Home。
- 重排 tab。
- 新增 mascot 交互入口。
- 新增 mascot 养成、收集、换装。
- 新增语气选择器。
- 新增商业化入口。
- 新增 onboarding 故事长页。
- 新增聊天式 mascot 悬浮入口。
- 把旧六角色做成咕点的六种模式。

Reason:

当前产品最重要的是让核心 loop 清楚：输入卡点 → 三问收束 → 第一小步 → 修卡点 → 轻回访 → 家长 5 秒复盘。咕点应服务这条路线，而不是成为新功能。

## 6. Product-loop preservation checklist

The mascot integration must preserve:

- 输入卡点：孩子仍能发作业或说卡点。
- 三问收束：Diagnosis 仍把模糊卡点变成第一步。
- 第一小步：孩子仍必须说出 miniActionText。
- 修卡点：Review 仍只修一个真实卡点。
- 小黑板：仍只提示先看哪里，不讲完整答案。
- 轻回访：Tools 仍回访已修过的一小步。
- 家长 5 秒复盘：Profile 仍只给一句可问的话。

The mascot integration must not introduce:

- 直接答案承诺。
- 老师分工。
- 新 tab。
- 新状态流。
- 新后端 API。
- 商业化 UI。
- 游戏化任务。

## 7. Final recommendation

咕点设定已经准备好替代六老师产品叙事，但产品内部尚未完成替换。下一步不应直接进入视觉大改；应先做一次最小 copy integration，把用户可见的老师矩阵和六角色文案清掉。

Recommended next action:

1. Create a copy-only implementation branch/task.
2. Replace user-visible six-teacher copy with 咕点 copy.
3. Keep internal compatibility fields where needed.
4. Update tests from six-teacher assertions to mascot assertions.
5. Run startup guard, npm test, and verify script.
6. Then hand off to Variant for visual UI rebuild.

Final status:

**MASCOT_SETTING_READY = YES**

**MASCOT_VISUAL_ASSET_READY = NO**

**MASCOT_PRODUCT_INTEGRATION_READY = NO**

**READY_FOR_MINIMAL_COPY_INTEGRATION = YES**
