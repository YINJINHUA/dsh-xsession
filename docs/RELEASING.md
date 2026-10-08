# GitHub → npm 发布 / Publishing

本次为 **0.1.2 正式版**：仓库 `YINJINHUA/dsh-xsession`，Release 标签 `v0.1.2`，不勾选 pre-release，npm 目标 `latest`。准备好文件不代表账号授权或发布已经完成。

源码目录就是 GitHub 仓库根目录。不要上传其父目录、调研、测试会话、宿主提取代码或本机安装包。上传前运行：

```sh
npm test
npm run check:release
npm run check:package
```

## 一次性准备

1. 按 `package.json` 的 `repository.url` 创建 GitHub **公开**仓库，上传本目录，等 Tests 的四项矩阵全部通过。仓库更名时同步 package.json、scripts/release-plan.mjs 和 publish.yml 中的仓库门禁。
2. npm 包尚不存在时，先由所有者完成首次包创建/发布及本人验证。本次首次人工发布使用 0.1.1 和显式 `--tag latest`，不把账号令牌写进 GitHub。若无法为尚不存在的包配置可信发布，先完成这一引导步骤，再为后续新版本启用自动化。
3. 在 npm 包设置的 Trusted Publisher 中绑定：GitHub 用户 `YINJINHUA`、对应仓库名、工作流文件名 **`publish.yml`**（不是完整路径）；本流程不使用 environment，留空。允许直接 `npm publish`，以及 `npm dist-tag`（已有同字节版本晋升时使用）。保留账号双重认证，无需添加 NPM_TOKEN。
4. 首次引导人工发布后，后续发布更新版本号再使用自动流程；不要因授权失败反复发布相同版本。可信发布设置需在 npm 要求的有效期内完成首次成功发布。

0.1.1 已完成首次 npm 发布。0.1.2 使用上述可信发布流程；保存授权不等于已验证，需核对本次工作流与 npm 的验证状态。

## 每次发布

1. 更新 package.json 和两个 README 的版本，提交并推送默认分支。
2. 等同一个提交的 Tests 全绿，再从该提交创建 GitHub Release，标签必须是 `v` + package.json.version。
3. 勾选 **Set as a pre-release** → npm `next`；正式 Release → `latest`。带 `alpha` / `beta` / `rc` 后缀的版本必须用预发行；正式发布先改成无后缀版本。
4. 点击 **Publish release** 后，Publish npm 自动执行：核实时 Release/提交/CI → 固定打包 → npm 发布或核验 → 等待可见 → 校验 registry 包字节 → 附加同一个 `.tgz` 与 SHA256SUMS.txt。

普通 push、草稿 Release、PR 不发布 npm。自动化禁止把 latest 回退到较旧稳定版本。发布未完成时请看 Actions 中的 Publish npm，不把 GitHub Release 出现当成 npm 已上线。

首次上线前请验证 CI 和 OIDC；本地发布规则测试不是账号授权或线上发布成功的证明。

## 失败与重试

npm 接受后可能需要时间处理。流程最多进行约五分钟的只读可见性等待；超过窗口会失败并提示先检查 registry。不要改版本内容、删除回执或立刻重新 publish。

重跑同一次工作流时，已存在且字节一致的版本只核验或更新授权的 dist-tag；字节不一致则停止，必须使用新版本。已有不同哈希附件不覆盖。正在发布的任务不会被新一次发布取消。保存已用于安装的本地 tgz，不把它误删为缓存。

## English quick guide

Upload only this source directory as the public repository root. Run tests, public-tree hygiene and package checks first. Establish the npm package and owner verification before enabling trusted publishing; the initial 0.1.1 stable publication must explicitly use `--tag latest`. Then bind the exact GitHub repository and `publish.yml` on npm, allowing publish and dist-tag operations. No persistent npm token is stored here.

Push only runs CI. A published GitHub Release triggers npm: prerelease → next, formal release → latest. The tag must match the package version; prerelease version suffixes cannot become formal releases. Wait for all four CI jobs on the exact default-branch commit. The workflow verifies the live release/tag, packs once, checks registry integrity and attaches identical package bytes plus a checksum.

After a timeout, check registry visibility before retrying. Existing identical bytes are verified/promoted; different bytes and latest rollbacks are refused. Local tests do not establish successful hosted CI, account authorization or publication. Keep local tarballs still referenced by installed profiles.

Official setup references: [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/), [GitHub release events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#release).

## 0.1.2 正式发布顺序

1. 推送 0.1.2 提交，等待该提交的四项 Tests 全绿。
2. 从该提交创建正式 Release `v0.1.2`，不勾选 pre-release。
3. 等待 Publish npm 工作流完成，核对 npm `latest` 为 0.1.2、Release 的 `.tgz` 和 SHA256SUMS.txt，以及 npm Trusted Publisher 的验证状态。
4. 若失败先核对 registry 与工作流日志，不重复人工发布或覆盖已发布包。

Version 0.1.1 bootstrapped the npm package. For 0.1.2, push the release commit, wait for its full CI, then publish a formal v0.1.2 GitHub Release. Verify the automated npm publication, latest tag, identical release assets and trusted-publisher validation. Do not manually publish again while the workflow is running.
