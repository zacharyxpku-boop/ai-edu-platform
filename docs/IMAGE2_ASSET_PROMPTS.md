# 原点智学 Image2 资产生成 Prompt

用途：补齐小程序和官网中最影响高保真还原的透明 PNG 资产。当前代码已经使用 `miniprogram/assets/reference/` 和 `apps/web/assets/reference/` 作为统一资产入口，生成后把文件放进两个目录并保持同名即可。

统一风格要求：

```text
Create a polished 3D cartoon illustration asset for a Chinese AI education product named Yuandian Learning Lab.
Style: warm, child-friendly, premium edtech UI, soft clay-like 3D rendering, clean lighting, rounded shapes, fresh green hoodie mascot, cream-white and light green atmosphere, subtle yellow star accents, no text, no logo, no watermark.
Output: PNG with transparent background. Centered subject, full object visible, no cropping, enough margin around the subject.
Palette: fresh green #22b95c, bright yellow #f8c622, sky blue #4c9fff, coral orange #ff7a45, cream white #fbfaf5.
Avoid: dark background, purple gradient, flat icon style, generic robot mascot, text labels, English words, UI screenshots, photo realism, clutter.
```

## 1. gudian-fullbody-transparent.png

```text
Use the unified style requirements.
Subject: a cute original mascot named Gudian, a round white chick-like learning companion wearing a fresh green hoodie with a small sprout on the head, waving happily with one hand, friendly wink, small yellow stars around it.
Pose: full body or three-quarter body, standing, one hand waving, one hand relaxed, energetic but gentle.
Use case: homepage welcome card, sidebar companion card, miniapp child pages.
Transparent background, no text, no logo.
```

## 2. gudian-parent-helper-transparent.png

```text
Use the unified style requirements.
Subject: Gudian standing beside a friendly parent character holding a green checklist folder. The parent looks calm and reassured, not anxious. Gudian points to one simple next step.
Mood: supportive, parent-friendly, professional but warm.
Use case: parent center, parent reminder cards, family report summary.
Transparent background, no text, no logo.
```

## 3. report-radar-card-illustration.png

```text
Use the unified style requirements.
Subject: a premium education report illustration with a radar chart, a clipboard, a magnifying glass, small evidence cards, and soft green/yellow accents. Make it look like a high-end learning analysis report, not a generic business dashboard.
Composition: centered object cluster, readable as "personalized learning report", but do not include actual words.
Use case: report preview card, report page hero, parent evidence summary.
Transparent background, no text, no logo.
```

## 4. review-world-map-transparent.png

```text
Use the unified style requirements.
Subject: a playful learning review world map with a winding path, four challenge nodes, a small flag, stars, memory cards, and a tiny game controller element.
Mood: gamified review, active recall, transfer challenge, not arcade-heavy.
Use case: review game page, learning map, child entry detail review scene.
Transparent background, no text, no logo.
```

## 5. upload-folder-stack-transparent.png

```text
Use the unified style requirements.
Subject: a green folder stack with upload cloud, test paper, wrong-question photo thumbnail, report sheet, and small evidence tags floating around.
Mood: organized, safe material intake, stable evidence classification.
Use case: upload page, material classification card, entry upload scene.
Transparent background, no text, no logo.
```

## 6. family-avatar-group-transparent.png

```text
Use the unified style requirements.
Subject: a warm family avatar group: child, mother, father, and Gudian together in a rounded composition, holding a small learning report tablet.
Mood: family support, calm, collaborative, no anxiety.
Use case: top family switcher, parent center, report sharing.
Transparent background, no text, no logo.
```

## 7. tutor-socratic-board-transparent.png

```text
Use the unified style requirements.
Subject: Gudian beside a small green thinking board with question bubbles, a pencil, and step-by-step reasoning cards. The board should imply Socratic questioning and "first step" guidance without any written text.
Mood: thoughtful, encouraging, not answer-giving.
Use case: AI tutor page, entry tutor scene, hint ladder.
Transparent background, no text, no logo.
```

## 8. learning-route-map-transparent.png

```text
Use the unified style requirements.
Subject: a soft 3D learning route map with upload folder, report clipboard, AI tutor bubble, review challenge node, parent report node, connected by a winding path.
Mood: clear product loop, one-step-at-a-time learning journey.
Use case: homepage route strip, learning map page, onboarding.
Transparent background, no text, no logo.
```

## 文件放置位置

生成后放到：

```text
miniprogram/assets/reference/
apps/web/assets/reference/
```

建议先生成并替换优先级：

1. `gudian-fullbody-transparent.png`
2. `report-radar-card-illustration.png`
3. `upload-folder-stack-transparent.png`
4. `review-world-map-transparent.png`
5. `family-avatar-group-transparent.png`
6. `tutor-socratic-board-transparent.png`
7. `gudian-parent-helper-transparent.png`
8. `learning-route-map-transparent.png`
