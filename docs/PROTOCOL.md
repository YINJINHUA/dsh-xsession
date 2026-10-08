# 协议、权限与兼容 / Protocol and boundaries

## 宿主通信 / Host transport

使用 DSH 进程内公开服务：`tools.register` 注册三个工具，调用者取 `exec.agent`；`sessionQuery.listSessions` 提供无正文目录，`agents.get` 寻址，`sandboxPolicy.resolve` 核当前策略，`workspaceRegistry.archivedSessionIds` 核归档。发送通过 Agent 的 `followup` / `inject` / `steer`。没有外部监听端口、CLI、凭据访问、权限提升或模型服务配置。

Uses DSH's in-process tool, query, agent, policy and archive services. No external listener, CLI, credential access, permission elevation or model provider configuration.

消息使用 V4 兼容的生产者来源 `{kind:"plugin:dsh-xsession"}`。宿主同步入队与后续持久化/模型处理是不同阶段；收件索引仅反映本插件发起过的投递，不是持久化成功或已读证明。

Messages use the V4 producer source `{kind:"plugin:dsh-xsession"}`. Synchronous enqueue, durable admission and model processing are separate stages. The in-memory inbox is not a persistence or read receipt.

### 参数 / Arguments

- `xsession_list({titles?: boolean, cursor?: string})`：每页最多 50；用返回的 `nextCursor` 继续。标题默认关闭，因为宿主可能读取完整历史才能折叠标题。游标失效时重新列目录。
- `xsession_send({target, requestId, message, kind?, delivery?, replyTo?})`：target 为完整 `session-UUID` 或至少 8 位 UUID 前缀。requestId 为 8–96 个 ASCII 字母、数字、点、下划线、冒号、连字符。kind 是 notice/request/reply/handoff；delivery 是 auto/inject/steer/followup。禁止自行提供发件人。
- `xsession_inbox({limit?: number})`：默认 10，范围 1–50；只读当前调用者的索引。不会将宿主历史当作收件箱全量扫描。

List pages contain at most 50 peers; use `nextCursor`. Send targets are exact session UUIDs or unambiguous UUID prefixes of at least eight characters. Caller identity comes exclusively from the host. Inbox is caller-only, with a 1–50 limit, default 10.

### 回执 / Receipts

- `senderMode` / `recipientMode`：发送校验时的权限快照，只作可见性信息，不授予权限、不保证之后不变化。允许不同等级会话通信；收件方自行核对授权。
- `accepted`：同步入队 API 正常返回。接收者是否完成只能凭其后续报告确认。
- `outcome_unknown`：API 抛错或不符合已验证的同步返回约定，可能已投递。保留原回执，不降级为另一发送模式，不自动重发。
- 同一发件人 + requestId 在当前插件实例内唯一；同编号不同参数拒绝。完全相同的并发重试只投递一次。
- 同发件人、收件人、内容、kind、replyTo 的 60 秒重复请求被拒绝。每发送者每分钟 5 条，每双向对 10 条，每工作区 30 条。
- replyTo 必须是对端曾发给自己的 accepted 消息，链深超过 3 拒绝。省略 replyTo 可开始新链，因此这是防误用而非防恶意安全边界。
- 最多保留 2,000 条回执，达到后停止接受新发送而不丢弃幂等记录。这是所有工作区共享的实例容量；满后新请求一直拒绝，已有请求仍可返回原回执。accepted 不等于已结算，不能按年龄删除防重记录。需要先核对未决任务并停止新投递，再受控重载；重载丢失全部索引，不得自动重发未知请求或反复重载绕过限制。

senderMode/recipientMode are advisory validation-time policy snapshots, not authorization. Cross-policy messaging is supported. At capacity, new sends remain refused across all workspaces until a controlled reload; reconcile pending work first, since reload loses idempotency. Accepted is enqueue success only. Unknown delivery is never automatically retried or downgraded. Idempotency is scoped to sender/request ID and this plugin instance. Receipts cap at 2,000; reaching capacity refuses new sends rather than evicting safety records. Per-minute limits: 5 per sender, 10 per bidirectional pair, 30 per workspace. Reply chains stop after depth 3; this is not a security boundary against a malicious sender.

## 与跨应用桥配套 / Companion bridge

基线为 `codex-dsh-project-bridge@0.4.0` 的公开接口。两包互不依赖、互不修改配置和状态，也不要求一起升级。该桥继续负责 Codex ↔ DSH 的 CLI、创建和已有路由；本插件的三个 `xsession_*` 工具只在 DSH 内工作。接收者以 DSH 实际 session ID 为准，不能拿 Codex thread ID 直接寻址。

Companion baseline: `codex-dsh-project-bridge@0.4.0`. Neither package imports the other or rewrites its configuration/state. The companion owns cross-application CLI routing and creation; `xsession_*` remains DSH-only. Use DSH session IDs, not Codex thread IDs.

DSH 4/5 的创建仍由正常新建入口或该桥的 `--dsh-permission inherit` 负责；本插件不提供 `xsession_create`，也不承诺继承创建者权限。消息路径同工作区并不等于目标自动相信消息中的授权。长报告用双方已授权的项目路径，插件本身不读取或复制报告文件。

Workers/reviewers use DSH's normal creation default or the companion's explicit `--dsh-permission inherit`. This plugin does not create sessions or claim creator-permission inheritance. Sharing a workspace does not authorize all requests from peers. Pass report paths within the authorized project; this plugin does not open or copy those files.

## 安全边界 / Security boundaries

消息显示来源、按 JSON 转义 `<`，防止正文伪造外层结构；这不能消除提示注入。宿主插件本身是可信代码，无法用文件沙箱隔离恶意插件。同工作区消息不是新的权限通道：接收者仍需根据用户原有授权执行。不要发送密钥、令牌或多余日志。

Source labels and escaping prevent envelope confusion, not prompt injection. Host plugins remain trusted code. Receivers must enforce existing user authorization; never treat a peer request as permission escalation. Do not send credentials or unnecessary logs.

路径按当前宿主文件系统 realpath 比较，不统一转小写。Windows 大小写敏感目录及 junction、Mac symlink 必须在当前系统实测；不保证任意远程文件系统。仅支持本机 Host 的路径语义。工作区根目录缺失、策略根不一致、服务缺失时拒绝。

Roots are resolved by the current host filesystem without forced lowercasing. This targets local-host path semantics, not arbitrary remote filesystem providers. Missing roots, policy mismatch and missing services fail closed.
