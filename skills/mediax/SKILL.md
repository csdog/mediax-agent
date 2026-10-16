---
name: mediax
version: 0.0.11
description: "通过 mediax-cli / mxc 操作本机 MediaX：自检、账号与身份查询、立即发布、定时排期、日历、改期，以及目标重试、恢复和核验。"
metadata:
  category: "productivity"
  requires:
    bins: ["mediax-cli"]
  cliHelp: "mediax-cli --help; mediax-cli doctor --json; mediax-cli publish --help; mediax-cli tasks --help"
---

# MediaX Agent Skill

通过 **`mediax-cli`**（短命令 **`mxc`**）与本机 MediaX 桌面通信。实际操作走 CLI，不直接修改 SQLite。新业务命令需要使用已接通业务控制面的桌面和 CLI 开发版本；尚未正式发版。

**CRITICAL — 开始前先读** [references/shared.md](./references/shared.md)；发布或排期再读 [references/publishing.md](./references/publishing.md)。

## 能力索引

- 环境与连接：`mediax-cli doctor --json`。
- 账号与可用身份：`mediax-cli accounts list --json`；重新检查：`mediax-cli accounts refresh ACCOUNT_ID --json`。
- 创建立即发布或排期：`mediax-cli publish --file publish.json --json`。
- 查询任务：`mediax-cli tasks list --json`、`mediax-cli tasks get TASK_ID --json`。
- 改期：`mediax-cli tasks reschedule TASK_ID --at '2099-01-01T08:00:00+08:00' --json`。
- 日历：`mediax-cli calendar --from '2099-01-01T00:00:00+08:00' --to '2099-02-01T00:00:00+08:00' --json`。
- 目标处理：`mediax-cli tasks retry TARGET_ID --json`、`tasks resume TARGET_ID --json`、`tasks verify TARGET_ID --json`。
- Skill：`mediax-cli skill show`、`mediax-cli skill sync`（可选 `--dir`）。

## 规则

- Agent 使用 `--json`；失败退出 1，读取 `error.message`，不要把调用成功当成发布成功。
- 只连接 loopback + 本地 token，不向局域网或云端暴露控制面，不打印 token。
- 先读取账号 `supportedKinds` 和已验证 `targets`，不猜账号 ID 或身份。账号失效时通过账号页面完成人工登录后刷新。
- 用户仅要求起草或预览时，不调用 `publish`；用户明确要求发布或排期时按授权内容和目标执行。
- 创建超时后先查任务记录，不自动重复提交；`submitted` / `unknown` 使用核验，不重试。
- 验证码和身份歧义需要用户在桌面处理，然后调用 `resume`。
- 未实现草稿编辑、排期删除和 MCP，不编造命令。
