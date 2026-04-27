# ⚠️ NCDM 服务 · V1 不启用

**SESSION-REVIEW 决策（2026-04-27）**

422 条 mock attempts 不够训 NCDM（toy 数据 AUC 0.623，远低于 0.78 可用线）。
PoC 期间这套服务**不部署到 Fly.io，不启用**。

## 什么时候启用

满足以下**全部**条件才回头跑：
- ✅ 真学员数 ≥ 200
- ✅ attempts 累积 ≥ 50,000 行
- ✅ 单学员平均答题 ≥ 30 题
- 预计：W12（6.21）之后才有可能

## 当前替代方案

V1 期间 mastery 计算路径：
- 学生答完一题 → `/api/bkt`（5 行 TS BKT difficulty-aware）→ 直接返回 mastery
- parent-radar 读 student_states.mastery_score（来自 fsrs-update 写入的 BKT 结果）
- 不经过 NCDM 训练

## 已 ship 但不启用的件

| 文件 | 状态 |
|---|---|
| `Dockerfile` | 不 build |
| `requirements.txt` | 不装 |
| `src/train.py` | 不跑 |
| `src/serve.py` | 不部署 |
| `fly.toml` | 不 fly deploy |
| `scripts/entrypoint.sh` + `crontab` | 不启动 |

## 下游影响

- `/api/mastery-proxy/*` 在 V1 期间会 503（环境变量 NCDM_HOST 留空）
- `parent-radar.html` 已写 mock 兜底，雷达图照常显示
- 不影响 mastery-loop / tutor / admin

---

**版本**：v1.0 · 2026-04-27 SESSION-REVIEW 决策后冻结
