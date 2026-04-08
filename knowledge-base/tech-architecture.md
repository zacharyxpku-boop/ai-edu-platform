# 原点AI学伴 · 技术架构文档
> 器灵出品 · Zack执行 · 2026年4月
> MVP目标：8周内上线微信小程序

---

## 一、技术选型决策

### 选型原则
1. **一人可维护** — Zack一个人能hold住全栈
2. **国内合规** — 数据境内存储、国产模型、个保法
3. **最快上线** — MVP只做苏格拉底对话+诊断+家长报告
4. **成本极低** — 月成本<¥6,000

### 技术栈

| 层 | 选型 | 理由 |
|---|------|------|
| **前端(小程序)** | Taro 3 + React | 一套代码编译微信小程序+H5，Zack熟React |
| **前端(管理后台)** | Next.js 16 | Zack已有经验，SSR+API Route一体 |
| **后端API** | Next.js API Routes / Vercel Edge Functions | 无需独立后端，轻量够用 |
| **数据库** | Supabase (PostgreSQL) | 免费额度够MVP，内置Auth/Storage/Realtime |
| **AI模型(主)** | DeepSeek V3.2 (deepseek-chat) | $0.28/M input，90%缓存折扣，数学最强 |
| **AI模型(语文)** | Qwen Plus | 中文生成更自然，作文/阅读理解场景 |
| **AI模型(路由)** | 自写规则(不用AI路由) | 基于学科字段硬编码路由，省token |
| **部署** | Vercel (前端+API) + Supabase (数据) | 全Serverless，无服务器运维 |
| **监控** | Vercel Analytics + Supabase Dashboard | 免费够用 |
| **支付** | 微信支付(小程序原生) | 国内标准 |

### 不选的技术及理由

| 不选 | 理由 |
|------|------|
| 自建服务器 | 一人维护不了，Serverless更省心 |
| MongoDB | 关系型数据更适合学习记录的结构化查询 |
| GPT-4 | 中国无法直接访问，且贵 |
| Claude API | 中文数学弱于DeepSeek |
| 独立后端(Express/Nest) | MVP阶段用Next.js API Routes够了 |
| Redis | 缓存用Supabase的内置功能够了 |
| 微服务 | 过度设计，单体够用 |

---

## 二、系统架构图

```
┌─────────────────────────────────────────────────┐
│                  微信小程序 (Taro)                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │对话页│ │诊断页│ │元元页│ │报告页│ │模板页│   │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──────┘   │
│     └────────┴────────┴────────┘                 │
│                    ↕ HTTPS                        │
└─────────────────────────────────────────────────┘
                     ↕
┌─────────────────────────────────────────────────┐
│              Vercel Edge Functions               │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │/api/chat │ │/api/diag │ │/api/report       │ │
│  │苏格拉底  │ │学习诊断  │ │生成周报+分享卡片 │ │
│  └────┬─────┘ └────┬─────┘ └────────┬─────────┘ │
│       │            │                │            │
│  ┌────┴────────────┴────────────────┴──────┐     │
│  │           AI Router (硬编码规则)         │     │
│  │  数学/英语 → DeepSeek V3.2              │     │
│  │  语文/作文 → Qwen Plus                  │     │
│  │  其他     → DeepSeek V3.2               │     │
│  └────┬────────────┬───────────────────────┘     │
└───────┼────────────┼─────────────────────────────┘
        ↕            ↕
┌───────┴──┐  ┌──────┴──────┐
│DeepSeek  │  │ Qwen Plus   │
│API       │  │ API         │
│$0.28/M   │  │ ¥0.40/M     │
└──────────┘  └─────────────┘
        ↕
┌─────────────────────────────────────────────────┐
│              Supabase (PostgreSQL)                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐  │
│  │users   │ │convos  │ │diagnos │ │reports   │  │
│  │用户表  │ │对话记录│ │诊断结果│ │周报数据  │  │
│  └────────┘ └────────┘ └────────┘ └──────────┘  │
│  ┌────────┐ ┌────────┐ ┌────────┐               │
│  │pets    │ │badges  │ │streaks │               │
│  │宠物状态│ │徽章记录│ │连续天数│               │
│  └────────┘ └────────┘ └────────┘               │
└─────────────────────────────────────────────────┘
```

---

## 三、数据库Schema（MVP）

```sql
-- 用户表
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wechat_openid TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'parent')),
  nickname TEXT,
  grade INT CHECK (grade BETWEEN 1 AND 12),
  textbook_version TEXT DEFAULT '人教版',
  parent_id UUID REFERENCES users(id),
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'growth', 'family')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 对话记录
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  subject TEXT NOT NULL, -- math/chinese/english
  topic TEXT, -- 分数运算/阅读理解/...
  messages JSONB NOT NULL DEFAULT '[]',
  thinking_score INT, -- 0-100 思考评分
  is_valid BOOLEAN DEFAULT false, -- 是否为有效对话
  model_used TEXT, -- deepseek/qwen
  tokens_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 诊断结果
CREATE TABLE diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  subject TEXT NOT NULL,
  grade INT NOT NULL,
  scores JSONB NOT NULL, -- {计算:80, 理解:65, 应用:45, 分析:70, 创造:30}
  weak_points TEXT[], -- ['分数混合运算', '方程移项']
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 元元宠物
CREATE TABLE pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  name TEXT DEFAULT '元元',
  stage INT DEFAULT 1 CHECK (stage BETWEEN 1 AND 6),
  -- 1灵种 2灵芽 3灵体 4灵核 5灵魂 6灵尊
  xp INT DEFAULT 0,
  mood TEXT DEFAULT 'happy', -- happy/sleepy/excited
  last_active_at TIMESTAMPTZ DEFAULT now()
);

-- 连续学习
CREATE TABLE streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  freeze_remaining INT DEFAULT 1, -- 每月1张断签保护
  last_study_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 徽章
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  badge_type TEXT NOT NULL, -- mastery/method/milestone/explore/special
  badge_name TEXT NOT NULL,
  badge_icon TEXT,
  earned_at TIMESTAMPTZ DEFAULT now()
);

-- 周报
CREATE TABLE weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  parent_id UUID REFERENCES users(id),
  week_start DATE NOT NULL,
  study_minutes INT DEFAULT 0,
  convo_count INT DEFAULT 0,
  valid_convo_count INT DEFAULT 0,
  highlights TEXT[], -- 本周亮点
  suggestions TEXT[], -- 本周建议
  pet_stage INT,
  share_card_url TEXT, -- 分享卡片图片URL
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS策略（行级安全）
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
-- 学生只能看自己的数据，家长可以看绑定孩子的数据
```

---

## 四、核心API设计

### POST /api/chat — 苏格拉底对话

```typescript
// 请求
{
  conversation_id?: string,  // 续接对话时传
  message: string,           // 用户输入
  subject: string,           // math/chinese/english
  grade: number,             // 年级
  input_type: 'text' | 'voice' | 'image'  // 输入类型
}

// 响应
{
  conversation_id: string,
  reply: string,             // AI回复（引导式提问）
  thinking_score: number,    // 本轮思考评分 0-100
  is_valid_turn: boolean,    // 本轮是否为有效对话
  pet_xp_gained: number,    // 元元获得的经验值
  daily_remaining: number,  // 今日剩余对话次数(免费版)
  model: string             // 使用的模型
}
```

**服务端逻辑：**
1. 检查用户tier和每日限额
2. 根据subject路由到DeepSeek或Qwen
3. 注入System Prompt（8层架构）+ 对话历史
4. 调用AI API，流式返回
5. 后处理：计算thinking_score、判断is_valid、更新pet XP
6. 异步写入conversations表

### POST /api/diagnose — 学习诊断

```typescript
// 请求
{
  subject: string,
  grade: number,
  answers: { question_id: string, answer: string, time_ms: number }[]
}

// 响应
{
  scores: { 计算: 80, 理解: 65, 应用: 45, 分析: 70, 创造: 30 },
  weak_points: ['分数混合运算', '方程移项'],
  radar_chart_data: [...],
  next_steps: string  // AI生成的个性化建议
}
```

### GET /api/report/weekly — 周报

```typescript
// 响应
{
  week: '2026-04-07 ~ 2026-04-13',
  study_minutes: 145,
  convo_count: 12,
  valid_convo_count: 9,
  highlights: ['小明在分数运算中展现了迁移能力'],
  suggestions: ['建议本周关注应用题审题能力'],
  pet: { stage: 3, name: '灵体', xp: 156 },
  share_card_url: 'https://...',
  abilities_change: { 计算: +5, 理解: +3, 应用: 0, 分析: +8, 创造: +2 }
}
```

---

## 五、AI模型调用成本估算

### 单次对话成本

| 项目 | Token估算 | 单价 | 费用 |
|------|----------|------|------|
| System Prompt | ~2,000 tokens | 缓存价$0.028/M | $0.000056 |
| 对话历史(5轮) | ~3,000 tokens | $0.28/M | $0.00084 |
| AI输出(1轮) | ~500 tokens | $0.42/M | $0.00021 |
| **单次对话总计** | | | **~$0.001 (¥0.007)** |

### 月度成本（600付费用户）

| 场景 | 对话次数 | 月成本 |
|------|---------|--------|
| 保守(每人10次/月) | 6,000次 | ¥42 |
| 基准(每人20次/月) | 12,000次 | ¥84 |
| 活跃(每人40次/月) | 24,000次 | ¥168 |
| 加上诊断+报告生成 | +2,000次 | +¥50 |
| **月AI成本** | | **¥100-220** |

加上Supabase(¥0免费层) + Vercel(¥0免费层) = **月总成本 < ¥500**

这个成本结构意味着：**只要有10个付费用户(¥380/月)，AI成本就能cover。**

---

## 六、MVP开发计划（8周）

### Week 1-2：基础搭建
- [ ] Taro项目初始化 + 微信小程序配置
- [ ] Supabase项目创建 + 数据库Schema部署
- [ ] 微信登录(wx.login → openid) + 用户注册流程
- [ ] DeepSeek API对接 + 基础对话测试

### Week 3-4：苏格拉底引擎
- [ ] System Prompt 8层架构实现
- [ ] 对话页面UI（输入框+消息列表+语音输入）
- [ ] 流式响应渲染
- [ ] 有效对话判定逻辑
- [ ] 数学题Python验证集成(通过API调用)

### Week 5：游戏化 + 诊断
- [ ] 元元宠物状态机（6阶段进化）
- [ ] 连续学习打卡 + 断签保护
- [ ] 学习诊断（10题自适应 + 雷达图）
- [ ] 徽章系统基础版

### Week 6：家长端
- [ ] 家长-孩子绑定流程
- [ ] 周报自动生成(CRON每周日)
- [ ] 分享卡片生成(Canvas → 图片)
- [ ] 微信服务号模板消息推送

### Week 7：付费 + 安全
- [ ] 微信支付接入（¥38/月 + ¥288/年）
- [ ] Freemium限额控制（免费5次/天）
- [ ] 内容安全过滤（敏感词+未成年人保护）
- [ ] 反作弊输出过滤器

### Week 8：测试 + 上线
- [ ] 内部测试（Zack + 5个种子家庭）
- [ ] Bug修复 + 性能优化
- [ ] 小程序审核提交
- [ ] 上线发布 + 种子用户邀请

---

## 七、关键技术风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| 微信小程序审核被拒 | 上线延迟 | 提前研究教育类小程序审核要求，备好资质 |
| DeepSeek API不稳定 | 用户体验差 | 双模型fallback：DeepSeek挂了自动切Qwen |
| AI回答数学错误 | 信任危机 | 数学必须Code Execution验证后再返回 |
| 用户数据泄露 | 法律风险 | Supabase RLS + 传输加密 + 最小权限原则 |
| 小程序性能差 | 留存低 | Taro预渲染 + 骨架屏 + 对话分页加载 |

---

## 八、后续扩展路径

| 阶段 | 时间 | 技术动作 |
|------|------|---------|
| MVP+ | Month 3-4 | 语音输入(微信录音API) + OCR拍照识题(通义千问多模态) |
| V1.0 | Month 5-6 | 独立App(React Native) + 题库接入(人教版知识图谱) |
| V1.5 | Month 7-9 | 班级模式 + 教师后台 + 批量周报 |
| V2.0 | Month 10-12 | 成长档案时间线 + 作品集PDF导出 + AI辩论模式 |

---

*器灵出品 · 阁主审核 · 原点智学技术内部文件*
