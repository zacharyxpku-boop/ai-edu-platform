# RC7 Product Consolidation Report

> Scope: product hierarchy consolidation before UI redesign. No new features, no UI redesign, no AppID change, no upload, no backend/social/audio/asset implementation.

## Final Status

PRODUCT_STRUCTURE_MATURE_ENOUGH_FOR_UI = YES

RC7 has consolidated the product around one story:

> 卡住 -> 看清第一步 -> 专注做一段 -> 明天轻回访 -> 家长 5 秒复盘

The product is mature enough to enter UI redesign as long as Variant treats all functions with hierarchy, not as equal feature blocks.

## What Was Messy

1. **专注舱 risked looking like a generic focus product.**  
   Countdown, scene, audio, growth, and room signals were all visible close to the top, which made the page feel like a timer/wallpaper/study-room hybrid instead of “做完今晚第一步”.

2. **Tools risked looking like a toolbox.**  
   Light practice, material generation, and game-like secondary modules were available as a visible expansion path, creating “feature collection” smell.

3. **Profile risked becoming a report/personal-center surface.**  
   Parent recap existed, but advanced entries, share panels, lead cards, and game/growth panels could pull it toward report wall or commercial/service feeling.

4. **Growth and social language risked pressure.**  
   Streak, badge, room, check-in, and peer presence could easily read as ranking/attendance pressure if surfaced too strongly.

5. **Tab order did not fully match the locked story.**  
   专注舱 was placed before 修卡点 in tab order, while the intended story is: first clarify the stuck point, then stay with the first step.

## What Was Consolidated

### Product hierarchy

The product now follows this hierarchy:

| Layer | Role | UI Treatment |
|---|---|---|
| A. Core visible promise | 今晚先迈出第一步 / 不直接给答案 / 卡在哪 / 先看哪里 / 专注做完这一小步 / 明天轻轻回访 / 家长 5 秒看懂 | Prominent |
| B. Supporting interactions | 三问 / 第一小步卡片 / 专注计时 / 轻回访入口 / 家长一句话 | Visible and operational |
| C. Atmosphere/evidence | scenes / audio / growth / streak / badges / focus stats | Subtle, secondary |
| D. Future/backstage | study room / leaderboard / social / heavy achievements / legacy deep pages | Hidden, mock-only, or de-emphasized |

### 专注舱

Repositioned from “timer + scene + audio + room” toward:

> 咕点陪你把今晚这一小步做完。

Changes:

- The task/first-step card now appears before the countdown.
- The task label says “今晚先做完这一小步”.
- Timer status copy now describes doing the current step, not generic focus.
- Scene copy is reframed as background that does not steal attention.
- Audio copy is reframed as light background sound.
- Stats are reframed as “今晚留下的一小步”.
- “连续天数” is softened to “回来天数”.
- Local study-room panel is hidden from the visible page and kept as backstage architecture.
- Room/check-in copy is softened from 打卡/自习室 to 陪坐/痕迹.

### Profile

Repositioned toward parent 5-second recap:

- Focus recap title changed from “专注舱记录” to “今晚专注痕迹”.
- Focus evidence label changed from “今晚坐住” to “做完这一小步”.
- Advanced profile entry grid is hidden unless advanced profile is explicitly opened.
- Parent-facing primary card remains first.
- Commercial/manual-review/game-style panels remain behind advanced gates and should not be heroed in UI redesign.

### Tools

Repositioned toward light revisit:

- Main first screen remains recent stuck point / revisit card driven.
- Primary CTA remains “开始回访” or “先去修卡点”.
- Advanced light-practice/material-generation section is hidden from the visible path.
- Tools should now read as “明天轻轻回访”, not a feature hub.

### Growth / Social Pressure

Pressure language was softened or hidden:

- “打卡” in focus room copy was replaced with “回来坐过一会儿 / 留下痕迹”.
- “连续 3 天” badge was changed to “三天有痕迹”.
- Study-room panel is no longer visible in the focus page.
- Growth remains evidence, not competition.

### Navigation

Five tabs are kept, but reordered to match the locked story:

1. 作业点拨
2. 修卡点
3. 专注舱
4. 轻回访
5. 我的

This better matches:

> 先看清第一步，再专注做一段。

## What Remains Hidden / Backstage

The following remain present as architecture or legacy modules, but should not be visible as primary product promises in UI redesign:

- local study-room placeholder
- room/peer state
- material generation / light-practice workbench
- game-like or arcade-like deep pages
- heavy growth/badge/achievement logic
- share card / advanced profile panels
- lead/manual-review surfaces
- module/radar/tutor legacy routes

These should be treated as backstage capability, not current product identity.

## Final Product Hierarchy

### Core promise

原点私教是中国家庭晚间作业陪伴小程序。咕点不直接给答案，而是陪孩子看清今晚第一步、专注做完一小段，并让家长 5 秒看懂。

### Core loop

1. Home / 作业点拨: 今晚先从哪一步开始。
2. Upload/Input: 把作业或卡住点说出来。
3. Diagnosis: 三问收束第一步。
4. Review / 修卡点: 孩子说清“我卡在哪 / 我先看哪里 / 我的第一步怎么说”。
5. 专注舱: 咕点陪孩子把这一小步做完。
6. Tools / 轻回访: 明天轻轻看一眼。
7. Profile / 我的: 家长 5 秒看懂今晚发生了什么。

### Screen roles

| Screen | Consolidated Role |
|---|---|
| Home | Route start and first-step promise |
| Upload/Input | Stuck-point capture without answer promise |
| Diagnosis | Three gentle questions |
| Review | First-step clarity |
| 专注舱 | Do the first step with 咕点 |
| Tools | Light revisit only |
| Profile | Parent calm recap |

## Whether Key Areas Are Clear

### 专注舱 is now clearly “doing the first step”

YES. The visible hierarchy now starts with the task target, then timer. Scene/audio/growth are secondary.

### Profile is now clearly parent recap

YES. The first visible area is still parent 5-second recap, and focus evidence is framed as parent-readable effort evidence. Some advanced legacy panels still exist behind gates and must stay out of the redesign hero path.

### Tools is now clearly light revisit

YES. The visible surface is recent revisit card and CTA. The old “practice/material generation” section is hidden as backstage.

## Remaining Risks Before User Testing

1. **Legacy routes still exist.**  
   module / arcade / tutor / radar can still carry old product concepts if exposed by deep links. UI redesign must either hide them or fully reframe them under tonight's route.

2. **Profile advanced panels are still heavy.**  
   They are gated, but if opened, they still contain older report/share/commercial/service concepts. Before public release, these should be further pruned or kept inaccessible.

3. **Growth evidence can still become pressure.**  
   Streak-like data is softened, but parents may still use it as supervision if UI highlights it too much.

4. **咕点 still lacks final visual asset.**  
   The character role is clear in copy and behavior, but UI redesign must make 咕点 feel like a real companion rather than text.

5. **Investor narrative remains unproven.**  
   Product coherence is enough for UI redesign, not enough for commercial/investor proof. User validation is still needed.

## UI Redesign Instruction

Variant should not design a feature dashboard.

Variant should design one calm evening route:

> 卡住 -> 看清第一步 -> 专注做一段 -> 明天轻回访 -> 家长 5 秒复盘

Visual hierarchy must be:

1. First step and 咕点.
2. Review card and focus task.
3. Parent recap.
4. Atmosphere controls.
5. Growth evidence.
6. Backstage future systems hidden.

## Final Judgment

PRODUCT_STRUCTURE_MATURE_ENOUGH_FOR_UI = YES

The product still has backstage complexity, but the visible hierarchy is now clear enough for UI redesign. Do not add features before redesign. The next work should be visual consolidation and parent-child smoke validation.
