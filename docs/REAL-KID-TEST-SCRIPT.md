# 真孩子试用 + 录屏 SOP（今晚-明早）

阁主 v1.1 后送给你的「拿到录屏就够我修 UI 1-2 小时」工作脚本。

---

## 0. 准备（5 分钟）

### 0.0 前置铁律 · seed 必须先跑（否则第一题答完写库 23503 FK 炸）
- 打开 Supabase SQL Editor
- 跑 `scripts/seed-demo-dialogues.sql` 一次（含「INSERT students id=000…001 ON CONFLICT DO NOTHING」兜底 + 4 个 KP 兜底）
- 验证：右下角 NOTICE 应见 `Demo seed inserted: 14 dialogues for demo-student-001`
- 没跑 seed 就直接给孩子链接 → attempts FK violation → 录屏废掉

### 0.0a 给 seed 对话生成 embedding（让 tutor 的「我记得你」真生效）
seed 写入 dialogues 时 embedding 列是 NULL，向量搜索找不到，tutor 第一句的「上次咱们在 X 卡过」就不会触发。
跑一次（PowerShell / 任意 shell 都行）：
```bash
curl -X POST "https://yuandianzhixue.com/api/embed-dialogue?limit=50" \
  -H "X-Admin-Token: $ADMIN_TOKEN"
```
返回应见 `processed: 14, succeeded: 14`。这一步在 V2 真用户上线后会有 cron 自动跑，PoC 期手动触发就够。

### 0.1 student_id 选哪个
- 演示用：保留默认 `00000000-0000-0000-0000-000000000001`（seed 已建）
- 自家孩子用：先在 Supabase 手动 INSERT 一行 students（grade 必须用 `middle_1` 之类 enum 字面量）
- 别让前端自己生 UUID 然后扔给端点——students 表里没这一行就一定炸

### 找 2 个孩子（任选其一即可）
- 你/乙方/丙方家庭里 10-14 岁真孩子（数学初中段最理想）
- 不要给他看任何介绍。打开就用。

### 录屏工具
- iPhone：自带录屏（控制中心红圆点）+ 手机里同步开「语音备忘录」录他自言自语
- 安卓：自带屏幕录制
- 电脑：OBS / QuickTime / 截屏录屏均可
- **录屏必须含声音**——他卡住时的吐槽是金子

### URL（直接发到孩子手机微信）
- mastery-loop（25 min 单知识点闭环）：
  `https://[你的 Vercel domain]/mastery-loop?topic_code=math.7.ch3.kp3&name=他的真名`
  （TOPIC_CODE 必须是 ontology kp_id 格式如 `math.7.ch3.kp3`，旧文档的 `kp-7-eq-linear` 无效，seed SQL 已建这条）
- tutor（一对一私教）：
  `https://[你的 Vercel domain]/tutor.html?student_id=[同一个 UUID]&name=他的真名`
- parent-radar（妈妈雷达图）：
  `https://[你的 Vercel domain]/parent-radar.html?student_id=[同一个 UUID]`

> 同一个 student_id 跑全套，雷达图才能聚合。如果没生成 UUID 就保留 default `00000000-0000-0000-0000-000000000001`（演示用）。

---

## 1. 试用流程（30-40 分钟一个孩子）

### 阶段 A · mastery-loop（15 min）

把链接发给他，**只说一句**：「这是个数学练习，做完告诉我感受」。

**你只看不说**。让他自然摸索。重点观察：
- 第 1 题：他多久搞清楚怎么提交？卡住了吗？
- 第 2-3 题：BKT 调难度后，他有没有觉得「咦怎么变了」？
- 错题诊断弹窗：他读了吗？会跳过吗？
- 出师弹窗 + 「复制给妈妈看」：他点了吗？复制后给谁看？

### 阶段 B · tutor（15 min）

mastery-loop 跑完直接打开 tutor。同一个 student_id。

**测试三个场景**（让他自己选感兴趣的）：

1. **正常对话**：「我刚做完一元一次方程，再讲讲移项」
   - 看老师第一句有没有引用他刚做的卡点（应该说「上次咱们在 X 卡过…」）
   - 老师超 80 字了吗？算术对不对？

2. **粘贴检测试一下**（关键卖点验证）：
   - 让他从课本/练习册拍一题，粘贴进对话框
   - 应该立即出现红边框 + ⚠️ 顶部提示
   - 发送后老师不应该直接讲题，而是问「你看到这题第一反应是什么？」
   - 这是 **Khanmigo 都没做的反作弊机制**

3. **算术铁律试一下**：
   - 问「2x + 3 = 11，x 等于几」
   - 老师应该分行写步骤：`2x = 11 - 3 = 8 → x = 8 ÷ 2 = 4`
   - 不应该跳步直接给答案

### 阶段 C · parent-radar（5 min）

让他看自己的雷达图（或你看）：
- 「AI 已识别孩子的学习指纹」面板出现没？（这是 v1.1 真数据驱动的卡片，靠 seed + signals）
- 数据不够时显示「再用 1-2 次就能识别」是否友好？
- 雷达图加载顺畅吗？

**注意 V1 雷达图本身是 MOCK 数据**（NCDM 服务 V1 不部署），所以那 10 个 KP 的 mastery 数字跟孩子刚答完的 mastery-loop 不会同步。这是已知 spec，不是 bug，5.5 真用户期再修。
真 mastery 已写进 student_states 表，但雷达图只读 NCDM proxy → 不读表。Demo Day 现场介绍时**避免演示「雷达图实时更新」这个动作**——容易翻车。

---

## 2. 录屏后立刻记 5 件（你 5 分钟回顾）

| # | 维度 | 写下他的具体反应 |
|---|---|---|
| 1 | 第一次卡 1 秒以上的瞬间在哪 | |
| 2 | 他自言自语说的最负面那句 | |
| 3 | 他眼睛亮了的瞬间在哪（看表情） | |
| 4 | 他主动想「再来一题」还是马上想退出 | |
| 5 | 他会不会自己复制金句给家长 | |

**填完发我（截图也行）**。这 5 个数据点就够我做 5 处最痛 UI/UX 修复。

---

## 3. 不要做的事

- 不要在他用的过程里「指导」「解释」「示范」
- 不要让他配合你「帮你测一下」——他会装好用
- 不要选成绩特别好或特别差的极端孩子（要中间 60-80% 段位）
- 不要超过 40 分钟一个孩子（疲劳数据无效）

---

## 4. 最低成功线（明早判断要不要继续推 5.4 Demo Day）

满足 **任意 3 项**就走：
- ✅ 他主动连刷 ≥ 3 题没退出
- ✅ 他自言自语里至少有 1 句正面（「哦」「懂了」「这个简单」）
- ✅ 出师后他自己点了「复制给妈妈看」
- ✅ tutor 第一句让他「咦」了一下（说明记忆引用奏效）
- ✅ 粘贴检测触发后他没投诉「这 AI 真烦」（说明语气把握住了）

满足 **0 项或仅 1 项**就回头：
- 大概率不是 prompt 问题，是 UI/onboarding 问题
- 不要硬上 5.4，往后挪 1 周

---

## 5. 录屏存档

录完发到一个固定文件夹：
- 命名：`孩子昵称_日期_阶段.mp4`（例：`小米_0427_mastery.mp4`）
- 我看完后会把 5 处修复点列给你

---

**版本**：v1.0 · 阁主 2026-04-27 自驱推进 5 步后写
**触发条件**：tutor / mastery-loop / parent-radar 全部 ship 到 Vercel main 之后
