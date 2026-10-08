# DSH Workspace Conversation Bridge

[中文](README.md)

Message conversations inside the same workspace and DSH host. Complements **codex-dsh-project-bridge**, which connects Codex to DSH; this plugin connects DSH coordinators, workers and reviewers.

**Version 0.1.1; stable releases target npm `latest`.** Targets DSH Desktop 0.2.0-rc.2. See [validation scope](docs/VALIDATION.md).

## Who it is for

Designed for least-privilege workflows: keep DSH workers and reviewers on workspace-write or read-only while they communicate through native plugin tools. Sending a message does not require full access or launching an external CLI from a restricted conversation. Read-only agents can message peers but still cannot write project files.

The plugin neither changes session permissions nor creates an additional security sandbox. Same-workspace peers with different permission levels can communicate; untrusted peer text can still influence a privileged receiver. Receivers must independently check authorization. Keep workers and reviewers at the minimum necessary permission level.

## Install

Enter `dsh-xsession` (or `dsh-xsession@0.1.1`) in the desktop client's Add Plugin dialog, without an `npm install` command. This requires the version to be published on npm. Before publication, use the maintainer-provided `.tgz`; after release, you can also download it from GitHub Releases and install its file path through the plugin manager.

Use DSH's plugin toggle. No launcher, port configuration or global installation is required. Follow restart instructions when replacing an installed package. Uninstall through the plugin manager.

## Tools

| Tool | Purpose |
| --- | --- |
| `xsession_list` | Same-workspace top-level peers and live status; titles are opt-in |
| `xsession_send` | Send using a stable `requestId` for idempotency |
| `xsession_inbox` | Your recent messages and receipts |

Auto delivery wakes idle peers and injects context into running peers without forcing an interruption. **Accepted means enqueued, not read or completed.** Never resend an `outcome_unknown` message under a new ID.

Messaging works with workspace-write and read-only file policies and never changes permissions. Waking an agent may incur model costs. Peer messages are untrusted agent data, not new human authorization; privileged receivers must enforce their own task boundaries.

## Companion workflow

Codex conversation 1 writes a plan. Codex 2 relays it through the cross-application bridge to DSH 3. DSH 3 uses this plugin to contact an existing, open worker 4. Worker 4 writes a report and replies to 3, which relays through 2 to 1. For review, 1 writes a review brief and sends it through 2 and 3 to an independent reviewer 5; findings return along the same route.

This plugin does **not** create sessions. Create them normally in DSH or use the companion bridge's existing creation capability. When creating workers/reviewers through that bridge, explicitly select `--dsh-permission inherit` and check the application's default permission preset. Coordinator privileges are not worker requirements. See [protocol and compatibility](docs/PROTOCOL.md).

## Limits

Same canonical workspace root only; nested roots are distinct. Offline, archived and actual subagents cannot receive; ordinary forks are allowed. No resume, broadcast, shared board, cross-process or cross-machine routing. Use project documents for long content.

Each plugin instance retains at most 2,000 receipts. At capacity, new sends are refused while existing IDs remain queryable; reconcile pending work before a controlled reload. Never blindly resend uncertain work.

Bodies are limited to 4,000 UTF-16 code units. Rate limits and duplicate suppression prevent mistakes, not deliberate abuse. Inbox indexes and idempotency receipts last for this plugin instance only. After restart, inspect target history before retrying unknown delivery; durable history depends on host persistence configuration.

Development: Node.js 22+, `npm test`, `npm run check:package`. No runtime dependencies, install scripts or background services. MIT licensed.

Maintainers: pushes run tests; published Releases trigger npm after account setup. See [publishing](docs/RELEASING.md) and [review decisions](docs/REVIEW.md).
