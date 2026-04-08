# 原点AI学伴 · 数据埋点规划
> 知道用户在干什么，才能让产品变好
> 开发时按这个文档埋点

---

## 一、核心指标（North Star + 关键指标）

| 层级 | 指标 | 定义 | 目标 |
|------|------|------|------|
| **North Star** | 周有效对话数 | 每周完成≥3轮有意义对话的次数 | >20次/活跃用户 |
| L1 | DAU/MAU | 日活/月活比率 | >25% |
| L1 | 7日留存 | 注册7天后仍使用的比例 | >40% |
| L1 | 付费转化率 | 免费→付费的转化 | >15% |
| L2 | 平均对话轮数 | 每次对话的平均轮数 | >4轮 |
| L2 | 思考评分均值 | 所有对话的平均思考评分 | >3.5/5 |
| L2 | 家长报告打开率 | 周报推送后的打开率 | >60% |
| L2 | 分享率 | 生成分享卡片的比例 | >10% |

---

## 二、事件埋点清单

### 用户生命周期事件
| 事件名 | 触发时机 | 属性 |
|--------|---------|------|
| `user_register` | 完成注册 | role, grade, textbook, source |
| `user_login` | 每次打开小程序 | login_count, days_since_register |
| `user_bind_parent` | 家长绑定孩子 | parent_id, child_id |
| `user_upgrade` | 免费→付费 | tier, price, payment_method |
| `user_churn` | 连续7天未打开 | last_active_date, tier |

### 核心功能事件
| 事件名 | 触发时机 | 属性 |
|--------|---------|------|
| `convo_start` | 开始一次对话 | subject, topic, input_type |
| `convo_turn` | 每轮对话 | turn_number, user_msg_length, ai_msg_length |
| `convo_end` | 对话结束 | total_turns, thinking_score, is_valid, duration_sec |
| `convo_cheat_detect` | 触发反作弊 | cheat_type(paste/direct_ask/gibberish) |
| `diagnosis_start` | 开始诊断 | subject, grade |
| `diagnosis_complete` | 完成诊断 | scores(JSON), weak_points, duration_sec |
| `prompt_view` | 查看模板 | template_id, category |
| `prompt_copy` | 复制模板 | template_id |

### 游戏化事件
| 事件名 | 触发时机 | 属性 |
|--------|---------|------|
| `pet_xp_gain` | 元元获得经验 | xp_amount, source(convo/mastery) |
| `pet_evolve` | 元元进化 | from_stage, to_stage |
| `streak_update` | 连续天数变化 | current_streak, is_break |
| `streak_freeze_use` | 使用断签保护 | streak_before |
| `badge_earn` | 获得徽章 | badge_type, badge_name |

### 家长端事件
| 事件名 | 触发时机 | 属性 |
|--------|---------|------|
| `report_send` | 周报推送 | child_id, week |
| `report_open` | 家长打开周报 | child_id, open_delay_hours |
| `report_share` | 家长分享周报 | share_channel(moments/chat/group) |
| `parent_view_archive` | 查看成长档案 | child_id |

### 付费事件
| 事件名 | 触发时机 | 属性 |
|--------|---------|------|
| `paywall_view` | 看到付费引导 | trigger(limit_reached/feature_locked) |
| `paywall_click` | 点击升级按钮 | tier, price |
| `payment_success` | 支付成功 | tier, price, payment_method |
| `payment_fail` | 支付失败 | error_code |
| `refund_request` | 申请退款 | tier, reason, days_used |

### 内容/分享事件
| 事件名 | 触发时机 | 属性 |
|--------|---------|------|
| `share_card_generate` | 生成分享卡片 | card_type(report/evolve/badge/work) |
| `share_card_send` | 发送分享卡片 | channel |
| `invite_code_generate` | 生成邀请码 | user_id |
| `invite_code_use` | 使用邀请码 | inviter_id, invitee_id |

---

## 三、关键漏斗

### 注册→首次对话→有效对话→7日留存→付费

```
注册 (100%)
  ↓ 转化率目标 >80%
首次对话 (80%)
  ↓ 转化率目标 >60%
首次有效对话 (48%)
  ↓ 转化率目标 >50%
7日留存 (24%)
  ↓ 转化率目标 >15%
付费转化 (3.6%)
```

**每个环节的优化杠杆：**
- 注册→首次对话：引导页+元元初见体验
- 首次→有效对话：降低问题门槛+积极反馈
- 有效→7日留存：连续打卡+元元成长+推送提醒
- 7日留存→付费：限额触发+周报价值展示

### 家长报告漏斗

```
报告推送 (100%)
  ↓ 目标 >60%
报告打开 (60%)
  ↓ 目标 >10%
分享朋友圈 (6%)
  ↓ 目标 >1% of viewers
新用户注册 (0.06%)
```

---

## 四、数据看板设计

### 每日必看（5个数字）
1. 昨日DAU
2. 昨日新增注册
3. 昨日有效对话数
4. 昨日付费转化数
5. 昨日分享数

### 每周必看（10个数字）
1-5同上（周汇总）
6. 7日留存率
7. 周报打开率
8. 元元进化数
9. 反作弊触发次数
10. 客诉/退款数

### 每月必看（产品健康度）
- DAU/MAU趋势
- 留存曲线(D1/D7/D14/D30)
- 付费漏斗各环节转化率
- 学科使用分布
- 对话质量分布（思考评分分布图）
- 元元阶段分布（多少用户在哪个阶段）
- 收入与成本

---

## 五、预警阈值

| 指标 | 健康 | 注意 | 危险 | 危险时做什么 |
|------|------|------|------|-----------|
| DAU/MAU | >25% | 15-25% | <15% | 检查推送/内容/bug |
| 7日留存 | >40% | 25-40% | <25% | 优化新手引导+元元体验 |
| 付费转化 | >15% | 8-15% | <8% | 调整定价/限额/价值展示 |
| 反作弊触发率 | <10% | 10-20% | >20% | Prompt可能太严，适当放松 |
| 退款率 | <3% | 3-8% | >8% | 紧急排查产品问题 |
