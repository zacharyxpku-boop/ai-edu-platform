# GPT Six-Screen Web Reference

This note preserves the product and UI standard from the six GPT-generated reference images supplied in the Codex thread. The raw images were provided in chat, not as local files. If exported later, place them in `apps/web/design-references/screenshots/` and keep this note as the acceptance checklist.

## Global Frame

- Left rail: brand, Gudian companion, six product entries, soft onboarding button, light nature base.
- Top bar: search, student selector, notification, family selector.
- Main area: one clear active page, not a long marketing scroll.
- Right rail: contextual evidence, progress, next action, parent reminder.
- Visual tone: warm white, fresh green, yellow CTA, small blue/orange/purple accents.
- Product tone: child-friendly but credible for parents and partners.

## Page 1: Home Overview

Reference intent: "Tonight, where do we start?"

Must show:
- Big first-step headline.
- Gudian companion greeting.
- Personalized report preview with radar chart and evidence tags.
- Six entry cards: upload, report, AI tutor, review game, parent center, learning map.
- Tonight route strip: upload -> report -> first step -> revisit -> parent view.
- Right rail with today progress, uploaded evidence, streak, parent reminder.

Acceptance:
- User can understand all main entries in one screen.
- Entry cards are clickable and route to focused subpages.
- It must not look like a long tool directory or marketing hero.

## Page 2: Upload Materials

Reference intent: make parents know what to upload and what happens next.

Must show:
- Large upload drop zone.
- Material type cards: talent assessment, score sheet, wrong-question photo, school feedback, parent observation.
- Recent upload list with type, time/status/action.
- Right rail: upload stats, material completeness, next analysis steps, Gudian tip.

Acceptance:
- The page must communicate evidence intake, not generic file storage.
- It must make clear that different materials become one standard report.
- It must keep source boundaries: no fixed talent labels from a single test.

## Page 3: Personalized Report

Reference intent: parent-facing decision report, not a sales report.

Must show:
- Student summary banner.
- Strong but bounded headline about current strengths.
- Ability radar.
- Evidence source cards.
- Method-fit cards: talent/advantage, current state, method match, gap, next action.
- Tonight recommendation, seven-day plan, report preview/download/share.
- Right rail: progress, key takeaways, parent-readable summary.

Acceptance:
- Report explains "why this method fits this child" before routing to product actions.
- Evidence must appear before recommendations.
- Avoid fake certainty, fixed labels, score promises, or marketing-heavy copy.

## Page 4: AI Tutor

Reference intent: Socratic first-step workspace.

Must show:
- AI tutor title and session stats.
- Left chat panel: Gudian asks for the first step, child answers, AI follows up.
- Middle/right blackboard: problem, child's thought, staged hints.
- Right rail: related weak point, recommended revisit, parent summary.
- Boundary copy: AI guides thinking and does not directly give the answer.

Acceptance:
- The first visible action is to answer the first question.
- The UI must not become a generic chat screen.
- It should show local evidence and tutor boundary together.

## Page 5: Review Game

Reference intent: memory and transfer validation through challenge map.

Must show:
- Review game headline and daily goal.
- Large learning map with levels.
- Challenge cards: recall, transfer, variation, combo review.
- Reward/streak/coverage report in right rail.
- One strong "start today's challenge" CTA.

Acceptance:
- Game mechanics must be tied to wrong-cause repair, not generic entertainment.
- The challenge map should feel playful and structured.
- It must show memory, transfer, and revisit as separate learning purposes.

## Page 6: Parent Center

Reference intent: parent can see evidence and know tonight's next question.

Must show:
- Child portrait.
- Weekly progress.
- Evidence summary.
- "What to ask tonight" question card.
- Method suggestion card.
- Weekly change chart.
- Right rail: learning overview, suggested dialogue, next action, parent reminder.

Acceptance:
- Parent center must not be a dense analytics wall.
- It should answer: what happened, what changed, what should I ask tonight?
- It should reduce anxiety without promising outcomes.

## Non-Negotiables

- Web code stays under `apps/web`.
- Miniapp code stays under `miniprogram`.
- App shell stays under `apps/app`.
- Shared logic can only move into `packages/edu-core` or `packages/ui-contracts`.
- No direct Web import from `miniprogram/pages`, WXML, or WXSS.
- Every Web iteration should pass `npm run web:check` and `npm run check:boundaries`.
