# EXP-1 sunset / blocker · 英语 manifest 补全（暂停）

> 决策日：2026-04-28
> 决策人：阁主
> 状态：blocker · 等 OCR pipeline 就位再启

---

## 现状

`data/extracted/manifest.json` 里 8 学科有 56 本教材进 `books` 数组（已 OCR 完整正文），但英语只有 2 本进 `scans` 数组（待 OCR），且原始 PDF 标记 `reason: "需 OCR（PaddleOCR / 其他）处理才能抽取文字层"`：

- 初中/英语/人教版/七年级/下册（152 页）
- 初中/英语/人教版/八年级/下册（147 页）

## 为什么不能 fake 章节进 books

- 章节标题可手填（人教版课纲公开），但 textbook-browser 依赖 `data/extracted/<path>/chXX.json` 加载正文
- 把空教材推上 books 数组会让 path / hub 渲染 18px 章节方块 → 学生点开 → 404 → 体验崩
- 「正文 OCR 中」placeholder 是诚实选项；fake 内容不在 v1 容忍度范围内

## 解锁条件

至少满足以下之一：
1. PaddleOCR / 阿里云 OCR 跑通 2 本英语，正文按章节切片落 `data/extracted/初中/英语/.../chXX.json`
2. 找到 ChinaTextbook 之外的电子英语教材（PDF 自带文字层），无须 OCR
3. 决定先做高中英语（必修 1-3 + 选修），跳过初中 — 但更违和

## 已部署的诚实降级

- 9 学科 grid 上英语卡的 placeholder 文案：「PDF 已收 · 正文 OCR 中」
- title 属性提示：「人教版 七下 / 八下 PDF 已收, 正文 OCR pipeline 进行中」
- 不创建 `subjects/english.html`，避免空页面

## stop-loss 触发

EXP-1 本周不能 ship，不消耗 1 周硬窗口。改用替代分配：让出的 6h 工时投入 EXP-3（跨学科冲关 streak 徽章）或 EXP-4（家长简报图卡）。

## 后续 owner

OCR pipeline 优先级 P1，等 v1.2 拍版时再决定用 PaddleOCR 还是托管 OCR API。代码上先把 `subject-hub.SUBJ_CHIPS` 里 `english: { disabled:true }` 保留，等 manifest 真上线时单点切换。
