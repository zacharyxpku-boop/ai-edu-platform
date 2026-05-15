# RC1.5 已知限制

RC1.5 的目标是本地封闭试用中的状态流可观察，不是完整服务端学习档案。

## 当前边界

1. `miniActionText` 是本地学习证据，用于证明孩子说出了自己的第一步。
2. 当前不判断 `miniActionText` 在学科上是否正确。
3. 当前不改后端 API。
4. `appendSyncMutation('today_focus')` 暂未同步 `miniActionText`、`miniActionAt`、`sourceText`。
5. 如果未来要做跨设备、家长端或服务端复盘，需要把这些字段纳入同步 payload。
6. 当前 `reviewCard` 会引用具体卡点或孩子说出的第一步，但仍是规则生成，不是完整学科诊断。
7. 当前 RC1.5 重点是：输入卡点、保存证据、完成修复、生成回访卡、我的页读取证据这一条本地闭环。

## 不在本轮解决

- 不做答案正确性校验。
- 不做拍照、OCR、PDF、PPT 导入。
- 不做 dashboard。
- 不做家长端服务端档案。
- 不做 UI 重构。
- 不做老师系统包装调整。
