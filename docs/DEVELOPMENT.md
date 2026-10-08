# 开发与发布 / Development and release

源码是原生 ESM，无构建步骤、运行依赖或安装脚本。`npm test` 使用 Node 内置测试器；`npm run check:package` 检查真实 npm pack 清单。`test/` 和 `scripts/` 留在 GitHub 供维护，npm 包只发运行源码及用户文档。

Pure ESM, no build, runtime dependencies or install scripts. Tests use Node's built-in runner. The package check inspects npm's actual pack manifest. Test and maintainer scripts stay on GitHub and are excluded from npm.

第一版集中做通信，不实现设计草案中的共享黑板、自动创建、恢复离线会话和跨进程。设计中的自动降级重发、路径统一小写、“结构化提示即可阻止注入”等假设已修正。标题按需读取；不轮询状态、不展开无关历史。

The initial scope is messaging. Shared boards, creation, offline resume and cross-process routing are deferred. Automatic fallback resends, forced path lowercasing and claims that envelopes eliminate injection are intentionally rejected. Titles are opt-in; no polling or broad history reads.

发布前必须：

1. Mac 和 Windows 最终源码快照测试通过；完成桌面安装及实际协作验收，或明确标为预览。
2. 确认 npm 包名可用和 GitHub 仓库名；已选名称为 `dsh-xsession`，首次发布前仍须核查 registry 与仓库归属。
3. 核版本、README 状态、MIT 许可和 `npm run check:package`；不要上传上级目录的调研、宿主提取件、日志、会话或机器路径。
4. 用 `npm pack --ignore-scripts` 只打包一次，记录 SHA256，将同一文件用于测试、npm 发布和 Release 附件。预览发 `next`，正式版发 `latest`；0.1.2 已选择正式发布。首次公开发布需要所有者授权。
5. 后续可配置 GitHub OIDC；本仓库已准备 Release 发布工作流，普通 push 不发布；账号配置见 [发布说明](RELEASING.md)。

Before release, validate the final snapshot on both platforms, explicitly state desktop test coverage, confirm package/repository names, inspect pack contents and reuse identical tarball bytes. Preview releases use `next`; stable publication requires an explicit decision. Release-triggered publishing is prepared; see [setup](RELEASING.md). Push does not publish, and no account credentials are included.

当前收件索引不回读完整历史。后续如需跨重启恢复，应使用宿主 projection／查询接口，并保留有界读取与身份校验；不要依赖已弃用的同步 `Session.snapshotEvents`，也不要把插件自己的写盘权限当作用户文件权限。

Future restart recovery should use supported host projections/queries with bounded reads and identity checks. Avoid deprecated synchronous session-log reads and host-privileged filesystem side effects.
