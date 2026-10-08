# 验证状态 / Validation

当前源码版本为 0.1.2，仅更新版本与发布文档，运行代码与 0.1.1 相同。0.1.1 的 GitHub Actions 四项矩阵（Linux Node 22/24、macOS Node 24、Windows Node 24）已通过。0.1.2 发布要求自身提交的同一矩阵通过；未重新安装本版到 Desktop 或重做实机测试。

Version 0.1.2 updates version metadata and release documentation only; runtime code is unchanged from 0.1.1. All four hosted CI jobs passed for 0.1.1. Publication of 0.1.2 requires green checks on its own commit. Desktop installation and live-device tests have not been repeated for this version. The alpha.2 evidence below remains historical.

**0.1.0-alpha.2：Mac 和 Windows 默认权限双会话实机通过（2026-10-08）。尚未发布 npm。**

**0.1.0-alpha.2 passed live two-session default-permission tests on macOS and Windows on 2026-10-08. Not published to npm.**

alpha.1 的隔离测试未覆盖 V4 持久化准入，漏掉了旧来源包装被拒收的问题。alpha.2 改用 `source.kind="plugin:dsh-xsession"`，并新增官方 V4 准入正反例；本轮另以实际模型处理、双方持久化消息和报告写入验收，不将 `accepted` 当成已读。

Alpha.1 isolated tests missed rejection of the retired source wrapper by V4 durable admission. Alpha.2 fixes producer attribution and adds positive/negative tests against the official V4 admission code. Live acceptance additionally checks actual model processing, durable messages and report writes rather than treating enqueue acceptance as delivery.

## alpha.2 历史结果 / Historical alpha.2 results

| 验证项目 / Check | Mac | Windows |
| --- | --- | --- |
| 核心测试 / Core | 19 pass, 1 skip, 0 fail | 19 pass, 1 skip, 0 fail |
| npm 包清单 / Package manifest | PASS | PASS |
| 官方宿主隔离回归及 V4 准入 / Isolated host + V4 admission | PASS | PASS |
| 配套桥 0.4.0 隔离联调 / Companion integration | Unix socket PASS | Named pipe / worker PASS |
| Desktop 安装并加载固定包 / Installed fixed package | PASS | PASS |
| DSH 协调者创建两条普通默认权限会话 / Two new default-permission sessions created by DSH coordinator | PASS | PASS |
| 真实双向收信、回信、持久化和工作区写入 / Live exchange, persistence and workspace writes | PASS | PASS |
| 显式 steer 实机 / Live explicit steer | PASS | Not tested |
| 运行中 auto→inject 实机 / Live running auto→inject | Not tested | PASS |
| 空闲 inject 不唤醒实机 / Live idle inject without wake | Not tested | Not tested |

两端 DSH Desktop 为 0.2.0-rc.2；Node 分别为 24.21.0 和 24.19.0。两端跳过项均为当前文件系统不支持的“仅大小写不同的独立目录”。大小写敏感卷、Node 22 和公开 CI 尚未独立验证。

Both platforms used DSH Desktop 0.2.0-rc.2, with Node 24.21.0 on Mac and 24.19.0 on Windows. The skipped test requires distinct case-only directories unavailable on the test filesystems. Case-sensitive volumes, Node 22 and hosted CI remain unverified.

## 实机证据与权限 / Live evidence and permissions

DSH 内协调者通过配套桥显式传 `--dsh-permission inherit` 创建 A/B。创建回执仅说明未覆盖；另外读取两个新会话的实际持久化权限事件，确认均为 `workspace-write` + `ask`，且测试期间没有升权。协调者自身的权限不用于替代 A/B 的默认权限。

正式 A/B 通信均使用 `xsession_send`：A 唤醒闲置 B；B 计算、写报告并通过 message ID 关联回信；A 实际收到并核对。双方持久化消息来源为 `plugin:dsh-xsession`，消息 ID 与发送回执对应，nonce、结果和报告一致。Windows 回信在 A 运行期间自动使用 inject 并被消费。通信和工作区写入无审批阻塞；这不代表审批弹窗的批准／拒绝路径已测。

The DSH coordinator created A/B with explicit `inherit`. Durable permission events independently confirmed workspace-write / ask without elevation. Both peers used the plugin for real requests and correlated replies, with matching durable producer-attributed messages and report contents. Windows also exercised auto-inject into a running recipient. No tested operation required approval; the approval UI itself was not tested.

Mac 的额外配套桥注入探针不计入本插件 inject 覆盖。空闲 inject 不唤醒目前只有隔离宿主测试。收件索引仅在插件实例内保留，不提供跨重启恢复；未验离线恢复、跨进程通信或完整五对话业务流程。

Companion-bridge probes are excluded from plugin inject coverage. Idle inject/no-wake has isolated host coverage only. The receipt index is instance-local; restart recovery, offline resume, cross-process routing and a complete five-conversation business workflow are not established by these tests.

## 包与源码 / Package and source

两端使用同一固定包 `dsh-xsession-0.1.0-alpha.2.tgz`，SHA256：

`3a60c8f3c6ff791f77edb7086e1053fff99ced0c331a097ec32132b545a6be79`

Windows 的 13 个安装文件与该包一致，原配套桥 77 个文件未变。源码运行代码、测试与 Windows 核验快照一致；随后仅补录公开说明。固定包不覆盖，其中的测试状态说明保留打包时状态，最新结果以本页为准。

Both platforms used the same immutable tarball. All 13 installed Windows files matched it; all 77 companion files remained unchanged. Runtime code and tests match the verified snapshot. Later documentation-only updates are not replacements for the tested archive; the archive retains its original validation text, while this page records the final outcome.

## 复现与隔离边界 / Reproduction and fixture scope

- `npm test`
- `npm run check:package`
- `node scripts/test-host.mjs <trusted-runtime-node_modules>`
- 增加配套桥测试 / Add companion testing: append `<companion-0.4.0-source>`.

宿主脚本使用官方运行时代码中的 Cordis、tools、agents、AgentLoop、session、session-query、sandbox-policy 和 V4 准入；工作区登记、会话控制适配器及模型流仍为 fixture，无外部模型调用。脚本不得指向真实用户配置／会话目录，仅创建并清理自己的临时工作区和内存会话。实机测试独立于这些 fixture。

The isolated script uses official runtime services and V4 admission with fixture workspace/controller adapters and a local model stream. It performs no external model calls and must not target real user profiles or session directories. Live Desktop tests are separate evidence.

Windows 配套桥测试需要满足其私有目录 ACL 的临时根，仅为测试子进程选择；不得放宽安全门、修改系统目录 ACL 或全局环境来制造通过。

Select a private temporary root satisfying the companion's ACL checks for the Windows test process only. Do not weaken checks or change system ACLs/global settings to obtain a pass.
