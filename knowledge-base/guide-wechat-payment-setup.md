# 微信支付商户接入指南
> AI学伴小程序收费的前置条件

---

## 一、前置条件

| 需要 | 说明 |
|------|------|
| 营业执照 | 个体工商户或公司均可 |
| 对公银行账户 | 个体户可用经营者个人账户 |
| 微信小程序已注册 | 需要AppID |
| 法人身份证 | 正反面照片 |

**如果还没有营业执照：**
- 注册个体工商户最快3-5个工作日
- 经营范围建议包含：教育咨询、软件开发、信息技术服务
- 不要写"培训"（可能触发双减审查）

---

## 二、申请流程

### Step 1: 注册微信支付商户
1. 打开 https://pay.weixin.qq.com/
2. 点击「成为商家」
3. 选择「小程序」
4. 填写商户信息（营业执照+法人信息+银行账户）
5. 等待审核（1-3个工作日）
6. 审核通过后获得：商户号(mch_id) + API密钥

### Step 2: 小程序关联商户号
1. 登录微信公众平台 → 小程序后台
2. 左侧菜单 → 微信支付
3. 关联已有商户号 或 申请新的
4. 确认关联

### Step 3: 配置API密钥
1. 登录商户平台 → 账户设置 → API安全
2. 设置APIv3密钥（32位字符串）
3. 下载商户证书（apiclient_cert.pem + apiclient_key.pem）
4. 保存到服务端安全目录（不要放在前端代码里！）

---

## 三、小程序支付代码

### Next.js后端 — 创建订单
```javascript
// app/api/payment/create/route.ts
import crypto from 'crypto';

export async function POST(req: Request) {
  const { userId, tier, price } = await req.json();

  // 生成订单号
  const outTradeNo = `YD${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

  // 调用微信统一下单API
  const params = {
    appid: process.env.WECHAT_APPID,
    mchid: process.env.WECHAT_MCH_ID,
    description: `原点AI学伴-${tier}`,
    out_trade_no: outTradeNo,
    notify_url: `${process.env.BASE_URL}/api/payment/notify`,
    amount: { total: price * 100, currency: 'CNY' },  // 单位：分
    payer: { openid: userId },
  };

  // 签名 + 调用微信API
  // ... (使用wechatpay-node-v3库简化)

  return Response.json({ prepay_id: result.prepay_id });
}
```

### 小程序前端 — 唤起支付
```javascript
// 小程序端
wx.requestPayment({
  timeStamp: timestamp,
  nonceStr: nonceStr,
  package: `prepay_id=${prepayId}`,
  signType: 'RSA',
  paySign: paySign,
  success: () => {
    // 支付成功 → 更新用户tier
    wx.showToast({ title: '升级成功！', icon: 'success' });
  },
  fail: () => {
    wx.showToast({ title: '支付取消', icon: 'none' });
  },
});
```

---

## 四、定价配置

| 产品 | 价格(元) | 微信金额(分) | 描述 |
|------|---------|-------------|------|
| AI学伴·成长版·月付 | 38 | 3800 | 原点AI学伴-成长版月付 |
| AI学伴·成长版·年付 | 288 | 28800 | 原点AI学伴-成长版年付 |
| AI学伴·家庭版·月付 | 68 | 6800 | 原点AI学伴-家庭版月付 |
| AI学伴·家庭版·年付 | 498 | 49800 | 原点AI学伴-家庭版年付 |
| 速成班 | 298 | 29800 | 原点智学-AI学习方法速成班 |
| 速成班(体验价) | 98 | 9800 | 原点智学-速成班首期体验 |

---

## 五、退款流程

```javascript
// app/api/payment/refund/route.ts
// 7天无理由退款
export async function POST(req: Request) {
  const { outTradeNo, refundAmount, reason } = await req.json();

  // 调用微信退款API
  // 退款到原支付账户，3-5个工作日到账

  // 同时：降级用户tier为free
  // 记录退款原因到数据库
}
```

**退款政策（写入小程序页面）：**
```
退款说明：
- AI学伴：7天内不满意全额退款
- 速成班：第1节课后不满意全额退款
- 成长课：前4节课(1个月)不满意全额退款
退款将在3-5个工作日退回原支付方式。
```

---

## 六、注意事项

1. **手续费**：微信支付收0.6%手续费（¥38收¥0.23）
2. **结算周期**：T+1到账（自动结算到对公账户）
3. **发票**：需要给家长开发票时，用个体户的普通发票即可
4. **测试**：先用沙箱环境测试，不要直接上生产
5. **推荐库**：`wechatpay-node-v3`（npm包，简化签名和API调用）
