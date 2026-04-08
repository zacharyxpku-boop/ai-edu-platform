# DeepSeek API 接入指南
> AI学伴开发的第一步 · 10分钟搞定

---

## 一、注册与获取API Key

### Step 1: 注册账号
- 打开 https://platform.deepseek.com/
- 用手机号注册（支持中国大陆号码）
- 邮箱验证

### Step 2: 获取API Key
- 登录后进入 API Keys 页面
- 点击「Create new API key」
- 复制保存（只显示一次！）
- 命名建议：`yuandian-studypal-prod`

### Step 3: 充值
- 进入 Billing 页面
- 支持支付宝/微信支付
- 建议首次充值 ¥50（足够测试几千次对话）
- 新用户可能有免费额度

---

## 二、API调用方式

### 基本参数
```
Endpoint: https://api.deepseek.com/v1/chat/completions
Model: deepseek-chat (V3.2)
```

### Node.js 调用示例
```javascript
// .env.local
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

// src/lib/deepseek.ts
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

export async function chat(messages: any[], options?: {
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}) {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 500,
      stream: options?.stream ?? false,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  return response.json();
}
```

### 流式响应（推荐用于对话）
```javascript
export async function chatStream(messages: any[]) {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.7,
      max_tokens: 500,
      stream: true,
    }),
  });

  return response.body; // ReadableStream
}
```

### Next.js API Route 示例
```javascript
// app/api/chat/route.ts
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { messages, subject } = await req.json();

  // 加载System Prompt（参考 src/prompts/system-prompt-yuanyuan.md）
  const systemPrompt = getSystemPrompt(subject);

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 500,
      stream: true,
    }),
  });

  // 转发流式响应
  return new Response(response.body, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

---

## 三、定价（2026年4月）

| 项目 | 价格 |
|------|------|
| 输入（非缓存） | $0.28 / 百万tokens |
| 输入（缓存命中） | $0.028 / 百万tokens（便宜90%！） |
| 输出 | $0.42 / 百万tokens |

**缓存优化关键：** System Prompt（约2000 tokens）在每次调用中都一样，会自动命中缓存。这意味着我们的System Prompt基本上是免费的。

### 成本估算
- 单次对话（5轮）：~¥0.007（不到1分钱）
- 1000个用户×每人20次/月：~¥140/月
- **月收入¥38,000（1000付费用户）vs 月API成本¥140 = 99.6%毛利**

---

## 四、模型路由（双模型策略）

```javascript
// src/lib/model-router.ts
export function getModel(subject: string): {
  endpoint: string;
  model: string;
  apiKey: string;
} {
  // 语文/作文 → Qwen Plus（中文生成更自然）
  if (subject === '语文' || subject === '作文') {
    return {
      endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      model: 'qwen-plus',
      apiKey: process.env.QWEN_API_KEY!,
    };
  }

  // 其他学科 → DeepSeek V3.2（数学最强+最便宜）
  return {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    apiKey: process.env.DEEPSEEK_API_KEY!,
  };
}
```

### Qwen API 注册
- 打开 https://dashscope.console.aliyun.com/
- 用阿里云账号登录
- 开通DashScope服务
- 获取API Key
- Qwen Plus 定价：输入 ¥0.0008/千tokens，输出 ¥0.002/千tokens

---

## 五、Fallback策略

```javascript
// src/lib/ai-client.ts
export async function chatWithFallback(messages: any[], subject: string) {
  const primary = getModel(subject);

  try {
    return await callModel(primary, messages);
  } catch (error) {
    console.error(`Primary model failed: ${error}`);

    // Fallback: DeepSeek挂了用Qwen，Qwen挂了用DeepSeek
    const fallback = subject === '语文'
      ? getModel('数学')  // 语文Qwen挂了→用DeepSeek
      : { endpoint: 'https://dashscope.aliyuncs.com/...', model: 'qwen-plus', apiKey: process.env.QWEN_API_KEY! };

    return await callModel(fallback, messages);
  }
}
```

---

## 六、测试清单

开发前先跑通这几个测试：

```bash
# 测试1: 基础对话
curl https://api.deepseek.com/v1/chat/completions \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role":"user","content":"你好"}],
    "max_tokens": 100
  }'

# 测试2: System Prompt + 苏格拉底式回应
# 发送一道数学题，验证AI不给答案而是追问

# 测试3: 流式响应
# 验证SSE流正常工作

# 测试4: 错误处理
# 发送无效API Key，验证错误码处理
```

---

## 七、安全注意事项

1. **API Key永远不放前端** — 只在Next.js API Route (服务端)使用
2. **.env.local 加入 .gitignore** — 绝不提交到Git
3. **设置用量预警** — DeepSeek后台可设月度预算上限
4. **限流** — 给用户端加限制(免费5次/天)，防止被刷
