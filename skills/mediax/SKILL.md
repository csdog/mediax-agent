---
name: mediax
version: 0.0.7
description: "通过 mediax / mx CLI 操作本机 MediaX 桌面：环境自检（doctor）。桌面控制面已提供 /health；排期/发布等命令待排期能力就绪后再扩展。"
metadata:
  category: "productivity"
  requires:
    bins: ["mediax"]
  cliHelp: "mediax --help; mediax doctor; mediax doctor --json; mediax skill show"
---

# MediaX Agent Skill

你是 AI Agent，通过 **`mediax`**（别名 **`mx`**）CLI 与本机 MediaX 桌面通信。真正执行一律走 CLI，不要假设隐式 HTTP 客户端或直接改桌面 SQLite。

**当前阶段：** 仅环境与连通性（`doctor`）。内容发布、排期等业务命令尚未实现；桌面 Hono 控制面也尚未上线时，`doctor` 报 Not ready 是预期。

**CRITICAL — 开始前先读** [`./references/shared.md`](./references/shared.md)（配置路径、loopback、输出协议）。

## 能力索引

| 意图 | 动作 |
| --- | --- |
| 环境 / 桌面是否就绪 | `mediax doctor` 或 `mediax doctor --json` |
| 查看本 Skill 版本与路径 | `mediax skill show` |
| 把本仓 Skill 同步到本机 Agent 目录 | `mediax skill sync`（可选 `--dir`） |

## 全局规则

- 需要机器可读结果时加 `--json`。
- 控制面只允许 loopback（`127.0.0.1` / `localhost`）+ 本地 token；不要引导用户把 API 暴露到局域网。
- 配置来源优先级：`MEDIAX_CONTROL_URL` + `MEDIAX_CONTROL_TOKEN` > `~/.mediax/control.json`（或 `MEDIAX_CONTROL_CONFIG` / `MEDIAX_HOME`）。
- 未实现的子命令不要编造；引导用户查看 `mediax --help` 或等待桌面排期/控制面落地。

## 命令探索

```bash
mediax --help
mediax doctor
mediax doctor --json
mediax skill show
mediax skill sync
mediax skill sync --dir ~/.agents/skills/mediax
```
