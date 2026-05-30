# RC1.5 状态流验证报告

## 结论

本轮没有做 UI 重构，没有新增功能模块，只补齐了状态流验收文档和自动化覆盖。代码层只保留此前已修的 P0 状态断点：知识游乐场在没有 due 卡时，可读取已生成的 `today_focus` 回访卡，避免首日路径断掉。

## 验证项

1. 本轮是否改代码：
   - 改了测试：`scripts/test-learning-evidence-flow.cjs`
   - 保留前一轮 P0 状态流修复：`miniprogram/pages/entry-detail/entry-detail.js`
   - 新增文档：`docs/rc15-state-flow-checklist.md`、`docs/rc15-known-limitations.md`、`docs/rc15-state-flow-verification-report.md`

2. 是否只修 P0 状态流问题：
   - 是。没有改 UI 主结构，没有新增 Tab，没有改后端 API。

3. `todayFocus` 识别是否覆盖三条样例：
   - `我写到第二步就乱了` -> `步骤断点`
   - `我不确定单位1是谁` -> `列式关系`
   - `题目条件太多，我不知道怎么用` -> 保存 `sourceText`，且 `issueType` 不为空

4. `miniActionText` 拦截是否有效：
   - 无 `miniActionText` 不能 completed。
   - 无效 `miniActionText` 不能 completed。
   - 有效 `miniActionText` 可以保存并完成修复。

5. `reviewCard` 是否引用具体卡点：
   - 是。测试确认 `front` 引用 `todayFocus.title`、`sourceText` 或 `miniActionText`，不再是固定泛化句。

6. 我的页是否读取 `miniActionText`：
   - 是。我的页模板读取 `todayFocus.miniActionText`，家长问题可围绕它生成。

7. `growth memory` 是否避免虚假“最近常卡在”：
   - 是。1 条记录说“今天记录到”，2 条以上同类记录才允许说“最近常卡在”。

8. 是否影响 `companionPreference`：
   - 未改 companion 机制。

9. 是否影响 `tonightPlan / todayFocus / reviewCard / tutor ladder`：
   - 未改核心结构。
   - 状态流仍是：`todayFocus` -> `miniActionText` -> completed -> `reviewCard` -> 我的页。
   - tutor ladder 相关测试继续通过。

10. `npm.cmd test` 是否通过：
    - 通过。`npm.cmd test` 已完整跑完，包含 `scripts/test-learning-evidence-flow.cjs`。

11. `scripts/verify.ps1` 是否通过：
    - 通过。使用 `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts\verify.ps1` 验证通过。
    - 备注：Upload Gate 仍因当前 AppID 为 `touristappid` 标记为上传前阻塞，这是非本地验证失败；配置真实 AppID 后再上传体验版。

12. 是否建议进入真实 AppID 配置与真机手动验收：
    - 是。自动测试覆盖本地状态流后，下一步应配置真实 AppID，并按 `docs/rc15-state-flow-checklist.md` 在微信开发者工具和真机中手动验收。

## 已知限制

见 `docs/rc15-known-limitations.md`。
