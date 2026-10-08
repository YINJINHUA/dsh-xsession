# 审查处理 / Review decisions

审查修复已纳入 0.1.1（2026-10-09）：

- 拒绝空 replyTo；会话 UUID 大小写不敏感，但文件路径不做小写转换。
- 回执增加 senderMode / recipientMode，表示校验时的权限快照，不是权限授予或持续状态保证。保留跨权限等级通信，支持默认权限执行者向协调者回报；接收者必须独立检查授权。
- 增加最终工作区变化、目标对象替换、参数/宿主不可用、容量满后重试等回归。
- 根目录防误上传规则、公开树白名单及定向隐私扫描、旧快照标识、CI 并发去重、Action 更新检查已补。
- 不采用“accepted 旧回执可安全淘汰”的建议：accepted 仅同步入队，不是完成。删除记录会让迟到的同 requestId 重试重新执行。保持实例内最多 2000 条的保守限制，包括所有工作区；容量满仍可查询/返回已有请求，拒绝新发送。没有自动自愈，恢复需先核对未决任务、停止新投递，再受控重载；重载会丢失全部防重索引，绝不能自动重发未知请求。
- 不把信封提升成 system 指令，也不承诺消除提示注入。已有结构化生产者归属和消息种类保留。跨重启持久化是后续设计，需要有界宿主查询与恢复一致性，未临时加入未验证写盘方案。
- 不增加未经官方契约确认的第三方插件清单格式，不改调研包的安装脚本。路径授权不加跨调用缓存，避免权限陈旧。

## English

Version 0.1.1 rejects empty reply references, accepts UUID case variants, and reports both peers' policy snapshots without changing permissions. New tests cover final workspace changes, replaced recipients, validation failures and preserved idempotency at capacity. Public-tree hygiene, historical-snapshot labeling and release automation were added.

Cross-policy communication remains intentional for worker/coordinator replies; metadata is informative, not authorization. Receipts are not evicted merely because they say accepted: enqueue acceptance is not completion, and eviction would admit delayed duplicate requests. At 2,000 receipts per plugin instance, new sends stop across all workspaces while existing IDs remain queryable/retryable. There is no automatic recovery. A controlled reload requires reconciling pending tasks first and loses all idempotency state; never automatically resend uncertain work afterward.

Prompt-injection resistance is not guaranteed. Peer text is never promoted into system instructions. Durable restart recovery, unsupported third-party manifest formats and cross-call authorization caching are deliberately deferred.
