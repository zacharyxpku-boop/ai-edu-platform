# 初中课程数据 (Middle School Curriculum Data)

## 课程知识点 JSON 文件

基于人教版教材目录 + 2022版课程标准构建的结构化知识点数据。

| 文件 | 学科 | 年级 | 知识点数 |
|------|------|------|---------|
| `math.json` | 数学 | 7-9年级 (6册) | 29章 ~90个知识点 |
| `physics.json` | 物理 | 8-9年级 (3册) | 22章 ~85个知识点 |
| `chemistry.json` | 化学 | 9年级 (2册) | 12单元 ~35个知识点 |
| `biology.json` | 生物 | 7-8年级 (4册) | 8单元 ~70个知识点 |

### JSON 结构

```json
{
  "subject": "学科名",
  "edition": "人教版",
  "grades": [7, 8, 9],
  "volumes": [
    {
      "grade": 7,
      "semester": "上册",
      "chapters": [
        {
          "id": "ch01",
          "name": "章节名",
          "topics": [
            {
              "id": "1.1",
              "name": "知识点名",
              "difficulty": "基础|中等|较难",
              "weight": "必考|中考常考|常考|了解|选考",
              "keyPoints": ["具体知识点1", "具体知识点2"]
            }
          ]
        }
      ]
    }
  ],
  "zhongkaoFocus": { ... }
}
```

### 数据来源

- 人教版教材官方目录 (renjiaoshe.com)
- 义务教育课程标准 2022年版
- 中考考纲要求与历年考频分析

---

## 开源题库数据源

### 可直接下载的数据集

| 数据集 | 规模 | 内容 | 获取方式 |
|--------|------|------|---------|
| **Ape210K** | 210,488题 | 中文数学应用题 + 方程 + 答案 | [GitHub](https://github.com/Chenny0808/ape210k) / [HuggingFace](https://huggingface.co/datasets/MU-NLPC/Calc-ape210k) |
| **Math23K** | 23,162题 | 中文数学应用题 | [GitHub](https://github.com/SCNU203/Math23k) |
| **TAL-SCQ5K** | 5,000题 | 好未来数学竞赛题（小/初/高），选择题，含详细解题步骤 | [GitHub](https://github.com/math-eval/TAL-SCQ5K) / [HuggingFace](https://huggingface.co/datasets/math-eval/TAL-SCQ5K) |
| **CMATH** | 1,700题 | 中文小学数学应用题 | [GitHub](https://github.com/XiaoMi/cmath) |
| **CMMaTH** | 23,000题 | 多模态K12数学题（含图形） | [论文](https://arxiv.org/abs/2407.12023) |
| **AGI-Eval** | 多学科 | 中国高考/中考/竞赛真题 | [GitHub](https://github.com/ruixiangcui/AGIEval) |

### 最推荐的题库组合（用于AI提分教练）

1. **Ape210K** - 量大，覆盖小学到初中数学应用题，有方程和答案
2. **TAL-SCQ5K-CN** - 质量高，好未来出品，覆盖初中数学竞赛，有详细解题步骤（适合CoT训练）
3. **Math23K** - 经典数据集，已被广泛验证

### 在线题库平台（需爬取或API）

| 平台 | 网址 | 数据质量 | 备注 |
|------|------|---------|------|
| 菁优网 | jyeoo.com | 高 | 最全的K12题库，按知识点分类，有难度标签 |
| 组卷网 | zujuan.com | 高 | 支持知识点树形结构，有中考真题 |
| 学科网 | zxxk.com | 高 | 大量教师共享试卷，需会员 |
| 题库网 | tiku.cn | 中 | 按章节组织，人教版同步 |

### 教材PDF资源

| 资源 | 地址 |
|------|------|
| ChinaTextbook (全科PDF) | [GitHub](https://github.com/TapXWorld/ChinaTextbook) |
| 智慧教育平台下载器 | [GitHub](https://github.com/happycola233/tchMaterial-parser) |
| 人教版教材资源 | [GitHub](https://github.com/weiyayun925104/Mathematics_Physics_Chemistry_Books) |

### 在线考试系统（含题库结构参考）

| 项目 | 地址 | 说明 |
|------|------|------|
| 学之思 (uexam) | [GitHub](https://github.com/wittech/uexam) | K12在线考试系统，支持数学公式 |
| xzs在线考试 | [GitHub](https://github.com/mindskip/xzs) | 含题库管理，支持多题型 |
| MathExamGen | [GitHub](https://github.com/gasongjian/mathexamgen) | 中学数学试卷自动生成 |

---

## 下一步计划

- [ ] 下载 Ape210K 并筛选初中难度题目
- [ ] 下载 TAL-SCQ5K-CN 并按知识点映射到 math.json
- [ ] 从菁优网抓取物理/化学计算题（需评估合规性）
- [ ] 构建知识点-题目映射索引
