# 极简观察 · 5/5 拍版用 Console Snippet

> 用法：在用户浏览器 DevTools Console 粘贴对应 snippet，立即拿到 EXP-2/3/4 真实数据。
> 没有埋点服务器、没有 Datadog，纯 localStorage + 现场观察。
> 拍版前 5 分钟可执行，每个 snippet < 30 行。
>
> 上游：[`EXPERIMENT-WEEK-v1.1.md`](./EXPERIMENT-WEEK-v1.1.md) 定义假设和 stop-loss · 本文档负责"怎么取数"

---

## EXP-2 · mastery 月度 delta 是否被消费

```js
// 检查 snapshot 是否已写 + 当前与上月差值
(() => {
  const m = JSON.parse(localStorage.getItem('ydzx_mastery_snapshots_v1') || '{}');
  const months = Object.keys(m).sort();
  console.table(months.map(k => {
    const subjs = m[k] || {};
    return Object.entries(subjs).map(([s, v]) => ({
      month: k, subject: s, mc: v.mc, total: v.total,
      pct: (v.pct * 100).toFixed(1) + '%',
      ts: new Date(v.ts).toLocaleDateString()
    }));
  }).flat());
  if (months.length < 2) console.warn('需 ≥2 个月数据 delta 才生效, 当前:', months);
})();
```

期望：表格输出每月每科 mastery 快照。
红旗：4 月没条目（snapshot writer 没触发）→ 检查是否所有用户都没在 stage='全部' tab 进过学科页。

---

## EXP-3 · 跨周冲关 streak 触发量

```js
// 算 yd:my_grade 用户的当前 streak + 历史周分布
(() => {
  const cleared = JSON.parse(localStorage.getItem('ydzx_challenge_clears_v1') || '{}');
  const wkOf = ts => {
    const d = new Date(ts); d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const ys = new Date(d.getFullYear(), 0, 4);
    return d.getFullYear() + '-W' + String(Math.round(((d - ys)/86400000 + 1)/7)).padStart(2,'0');
  };
  const weeks = {};
  Object.values(cleared).forEach(v => {
    if (!v || !v.ts) return;
    const k = wkOf(v.ts);
    weeks[k] = (weeks[k] || 0) + 1;
  });
  console.log('每周通关数:', weeks);
  console.log('共 ' + Object.keys(weeks).length + ' 周有通关');
  // 找连续周数
  let streak = 0; let cur = new Date();
  for (let i = 0; i < 60; i++) {
    if (weeks[wkOf(cur.getTime())]) { streak++; cur.setDate(cur.getDate() - 7); }
    else if (i === 0 && streak === 0) cur.setDate(cur.getDate() - 7);
    else break;
  }
  console.log('当前连续周 streak:', streak, '档:', streak >= 12 ? '👑 一季登顶' : streak >= 8 ? '🏆🏆 双月' : streak >= 4 ? '🏆 一月' : '未达档');
})();
```

期望：单用户最高 streak 数。
红旗：首批 5/12 拍版日 streak ≥ 4 用户 < 10 → 阈值过高，下调 streak_4 → streak_2。

---

## EXP-4 · 家长图卡按钮点击 + 转发漏斗

埋点目前是基于 utm_source 的，所以服务器侧 access log 才能看到。但本地能查的两件事：

```js
// 1. 家长卡是否真在所有学科页渲染
(() => {
  const has = !!document.querySelector('#parent-mount .parent-card');
  const btn = document.querySelector('#parent-card-share');
  console.log('parent-mount 渲染:', has);
  console.log('parent-card-share 按钮:', btn ? '存在 · 文案=' + btn.textContent : '缺失');
})();

// 2. 模拟点击触发懒加载是否成功
(() => {
  const btn = document.querySelector('#parent-card-share');
  if (!btn) return console.warn('按钮不存在');
  btn.click();
  setTimeout(() => {
    console.log('html2canvas:', typeof window.html2canvas);
    console.log('YdzxShare:', typeof window.YdzxShare);
  }, 2500);
})();
```

期望：第一步 `渲染:true / 按钮存在`；第二步 2.5 秒后两者都是 `'function'`/`'object'`。
红旗：第二步 `undefined` → 懒加载链断了，CDN 跨域或 share-kit 路径错。

---

## EXP-3/4 联合：周冲关 → 家长图卡转发漏斗

```js
// 估算 "本周通关 → 是否点过家长卡分享" 的相关性
// 没埋点 click 落 localStorage, 只能查"本周通关数 + 当前学科 hub 是否生成过 utm 链接"
(() => {
  const cleared = JSON.parse(localStorage.getItem('ydzx_challenge_clears_v1') || '{}');
  const thisWk = (() => {
    const d = new Date(); d.setHours(0,0,0,0);
    const off = (d.getDay() + 6) % 7;
    return new Date(d.getTime() - off * 86400000).getTime();
  })();
  const wkClears = Object.values(cleared).filter(v => v && v.ts >= thisWk);
  console.log('本周通关数:', wkClears.length);
  const subjHist = wkClears.reduce((a, v) => {
    const sub = (v.label || '').match(/数学|物理|化学|生物|语文|历史|地理|政治/);
    if (sub) a[sub[0]] = (a[sub[0]] || 0) + 1;
    return a;
  }, {});
  console.log('本周分学科:', subjHist);
})();
```

期望：哪个学科本周通关最多 → 推该学科页的家长图卡转发力。
红旗：本周通关数 = 0 → EXP-3 还没数据，再等 1 周再判。

---

## 三跳漏斗 · home → 学科 hub → hub 内首动作（新增）

```js
// 简化版 funnel: 算 home_subject_click → page_view(subject hub) → 任意 hub 动作 三档留存
(() => {
  const log = JSON.parse(localStorage.getItem('ydzx_event_log_v1') || '[]');
  const subjs = ['math','physics','chemistry','biology','chinese','history','geography','politics'];
  // step 1: 9 学科 grid 点击数(分学科)
  const step1 = {};
  log.filter(e => e.e === 'home_subject_click').forEach(e => {
    const s = e.p && e.p.subject; if (s) step1[s] = (step1[s]||0)+1;
  });
  // step 2: 该学科 hub 的 page_view
  const step2 = {};
  log.filter(e => e.e === 'page_view').forEach(e => {
    const p = e.p && e.p.page; if (subjs.indexOf(p) >= 0) step2[p] = (step2[p]||0)+1;
  });
  // step 3: 在 hub 上做了任何 click 行动
  const step3 = {};
  const hubActions = ['upnext_go_click','playbook_click','err_explain_click','err_review_click','parent_brief_copy_click','parent_card_share_click'];
  log.filter(e => hubActions.indexOf(e.e) >= 0).forEach(e => {
    const s = e.p && e.p.subject; if (s) step3[s] = (step3[s]||0)+1;
  });

  const rows = subjs.map(s => ({
    subject: s,
    'step1·home_click': step1[s]||0,
    'step2·hub_pv':     step2[s]||0,
    'step3·hub_action': step3[s]||0,
    's1→s2 %': step1[s] ? Math.round((step2[s]||0)/step1[s]*100)+'%' : '—',
    's2→s3 %': step2[s] ? Math.round((step3[s]||0)/step2[s]*100)+'%' : '—'
  }));
  console.table(rows);
})();
```

期望：每个学科一行，s1→s2 在 60-90% 是健康（点完学科卡然后没等加载好就关页面会丢一部分），s2→s3 在 30-50% 健康（学生看完 hub 不一定立刻动作）。
红旗：s1→s2 < 30% → 学科 hub 加载太慢或 nav 有断链；s2→s3 < 10% → hub 没有引导，学生进来就懵。

---

## EXP-4 · 家长卡按钮真点击事件流（新增）

```js
// 看 ydzx_event_log_v1 里的真点击, 按事件名分桶
(() => {
  const log = JSON.parse(localStorage.getItem('ydzx_event_log_v1') || '[]');
  console.log('total events:', log.length);
  const byName = {};
  log.forEach(e => { byName[e.e] = (byName[e.e] || 0) + 1; });
  console.table(byName);
  // 家长卡按钮分学科
  const shareBySubj = {};
  log.filter(e => e.e === 'parent_card_share_click').forEach(e => {
    const k = (e.p && e.p.subject) || 'unknown';
    shareBySubj[k] = (shareBySubj[k] || 0) + 1;
  });
  console.log('parent_card_share by subject:', shareBySubj);
  console.log('latest 5:', log.slice(-5));
})();
```

期望：每点一次「📤 生成图卡」按钮，`parent_card_share_click` 计数 +1，event log 顶部出现一条带 subject/state/weekRead/weekClears 的 prop。
红旗：log 全为空 → trackEvent 没绑或被 popup blocker 拦了；只有 copy 没有 share → 学生只复制不点图卡，重新设计按钮文案。

---

## 一键全跑

```js
// 复制下面这一坨直接看 EXP-2/3/4 整体状态
(() => {
  console.group('🔬 EXP-2/3/4 状态扫描 ' + new Date().toLocaleTimeString());
  console.log('m_snap:', Object.keys(JSON.parse(localStorage.getItem('ydzx_mastery_snapshots_v1') || '{}')));
  console.log('cleared count:', Object.keys(JSON.parse(localStorage.getItem('ydzx_challenge_clears_v1') || '{}')).length);
  console.log('parent-mount:', !!document.querySelector('#parent-mount .parent-card'));
  console.log('grade:', localStorage.getItem('yd:my_grade'));
  console.log('name:', localStorage.getItem('yd:my_name'));
  console.log('streak (per gamification):', JSON.parse(localStorage.getItem('ydzx_game_profile_v1') || '{}').streak);
  console.groupEnd();
})();
```

---

## 已知盲点

- 跨设备：snapshot 只在本地写，浏览器换机数据丢
- 跨用户聚合：没服务器侧不能跑全量，只能样本访谈 30 个学生
- 时间窗口：snapshot 月初触发但月末才看 delta，需 ≥ 2 个月数据才稳
- 触发率：用户必须在 stage='全部' tab 至少进过一次学科页才有 snapshot

---

## 5/5 周一 9 点 standup 模板

```
EXP-2 · 二访率：__ % vs baseline __ % → 留 / 撤
EXP-3 · streak_4 触发用户：__ 人（目标 ≥ 10）→ 留 / 调阈值
EXP-4 · 图卡按钮点击率：__ % vs PV → 留 / 撤
访谈：3 家长 + 3 学生反馈 (yes / no / 困惑)
下一周排：EXP-5 启动 / 不启动
```

---

> 这份文档预设："拍版那天没人记得怎么查数"。把所有动作压成 copy-paste 的 console 一键，是最便宜的 observability。

---

## Dry-run 结果（2026-04-28 当晚）

5 段 snippet 已在 Node 沙箱跑过空 state + 喂数据两轮验证：

| 输入态 | snippet 1 | snippet 2 | snippet 3 | snippet 5 |
|---|---|---|---|---|
| 空 localStorage / 空 DOM | OK | OK · streak=0 | OK · rendered=false | OK |
| 喂 4 周连续通关 | n/a | streak=4 · 档=🏆 一月 | n/a | n/a |
| 喂 1 周通关 + 跨 2 周空白 | n/a | streak=1（边界正确） | n/a | n/a |

snippet 2 的连续周回溯循环顶 60 周作 safety cap，零通关时单次跳出（i===0 走 fallback 一次后 break），确认无死循环或 NaN 风险。可以放心粘贴进任意学生浏览器。

### 自动化回归（不再靠手动跑）

```bash
npm test            # 跑全部回归 (observability + 静态链接 lint)
npm run test:obs    # 只跑 observability 相关 snippet 回归
npm run test:links  # 只跑 HTML 静态链接 404 检查
```

`npm test` 串行跑五段（524 assertion · 整体 < 100ms）：

1. [`scripts/observability-dry-run.cjs`](../scripts/observability-dry-run.cjs) · 8 case · 验 streak 算法 / event ring buffer / 三跳漏斗
2. [`scripts/check-static-links.cjs`](../scripts/check-static-links.cjs) · 499 内部 link · 任何 href/src 指向不存在文件即 fail
3. [`scripts/test-track.cjs`](../scripts/test-track.cjs) · 7 case · 沙箱 src/track.js (event/recent/countByName/auto-pv/ring buffer)
4. [`scripts/test-streak-bar.cjs`](../scripts/test-streak-bar.cjs) · 5 case · 沙箱 STREAK_BAR.computeStats (空态/streak 持久化/断签/chWeek/qAcc)
5. [`scripts/test-today-recos.cjs`](../scripts/test-today-recos.cjs) · 5 case · 沙箱 pickUpNext 4 档优先级 (A 错题 / B 年级 / C 广度 / D 兜底)

子命令：`npm run test:obs / test:links / test:track / test:streak / test:recos` 单跑某段。

第一段（observability）的 5 个 case：

1. 空 localStorage / 空 DOM 不爆错
2. 4 周连续通关 → streak === 4
3. 1 周通关 + 跨 2 周空白 → streak === 1（不跨空白）
4. malformed entries（null / 无 ts / 字符串 ts）不 crash
5. 200 entries 压测 < 50ms + safety cap 60 周生效

退出码 non-zero → 阻塞 push（接 git pre-push hook 或 GitHub Action 时）。改 streak 算法之前先跑一次确认 baseline，改完再跑确认没破。

> 加新埋点时：先在本文档加 snippet → dry-run 一遍 → 把对应 case 加进 `observability-dry-run.cjs` → 再拍版。三步走。

> CI 守门：`.github/workflows/test.yml` 在 push/PR 改 `src/**` 或 `*.html` 时自动跑 `npm test`，PR 红圈直接挡住 main 被破坏 streak 算法 / 加新死链。
