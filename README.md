![MediaX](build/icon.png)

# MediaX Agent

**MediaX 的 Agent 面**  
CLI + Skill，让 Cursor / Claude 等通过本机命令操作桌面  
loopback 连接 · 本地 token · 不经第三方云端

![release](https://img.shields.io/github/v/release/csdog/mediax-agent?style=flat-square&label=release)![Bun](https://img.shields.io/badge/Bun-compile-fbf0df?style=flat-square&logo=bun&logoColor=black)![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6?style=flat-square&logo=typescript&logoColor=white)![CLI](https://img.shields.io/badge/CLI-mediax--cli%20%7C%20mxc-111827?style=flat-square)

[为什么用](#为什么用-mediax-agent) · [特性](#特性) · [与桌面的关系](#与桌面的关系) · [快速开始](#快速开始) · [主要能力](#主要能力) · [资助](#资助) · [开发](docs/DEVELOPMENT.md) · [Contributing](CONTRIBUTING.md) · [Releases](https://github.com/csdog/mediax-agent/releases)

## 安装

发给支持 Skill 的 Agent（一句话）：

```
请根据 https://raw.githubusercontent.com/csdog/mediax-agent/main/skills/install.md，安装 mediax
```

安装脚本会从 GitHub Release 拉取**已编译** `mediax-cli`（**不需要 Bun**；把 `<skills-dir>` 换成 Agent 的 skills 父目录）：

macOS / Linux：

```bash
curl -f --connect-timeout 10 --max-time 120 \
  'https://raw.githubusercontent.com/csdog/mediax-agent/main/skills/install.sh' \
  -o install-mediax.sh &&
bash install-mediax.sh --skills-dir '<skills-dir>'
```

Windows（PowerShell）：

```powershell
Invoke-WebRequest 'https://raw.githubusercontent.com/csdog/mediax-agent/main/skills/install.ps1' -OutFile install-mediax.ps1 -UseBasicParsing
& .\install-mediax.ps1 -SkillsDir '<skills-dir>' -AddToPath
```

---

## 为什么用 MediaX Agent

桌面仓 [`csdog/mediax`](https://github.com/csdog/mediax) 负责账号、创作与发布；本仓是给 Agent 用的**机器入口**，不另起一套云发布通道。

- **同一套命令** — CLI `mediax-cli`（短命令 `mxc`）；Skill 名 `mediax` / `mx`；日后 MCP 走同一路径
- **本机可控** — 只连桌面 loopback HTTP + 本地 token，不经第三方云中转
- **契约生成** — 客户端由桌面 OpenAPI 生成，避免手写第二套类型

## 特性

|                       |                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| 🩺 **doctor**         | 检查 `control.json` / 环境变量，探测桌面 `GET /health`                                              |
| 📎 **Skill**          | 仓内维护 `skills/mediax/`；安装与 `skill sync` 写入 `~/.mediax/agent/skills/mediax`，Agent 目录软链 |
| 🔔 **更新提示**       | 交互终端 stderr 提醒新版本（GitHub Releases；`MEDIAX_NO_UPDATE_CHECK` 可关）                        |
| 📦 **单文件分发**     | GitHub Release 预编译包；安装脚本无需 Bun / Node                                                    |
| 🔌 **OpenAPI 客户端** | `@openapi-codegen/typescript` 生成类型化调用                                                        |

## 与桌面的关系

| 侧            | 仓库                                              | 职责                                                             |
| ------------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| 桌面          | [`csdog/mediax`](https://github.com/csdog/mediax) | Electron；Hono 控制面写 `~/.mediax/agent/control.json`；业务真源 |
| Agent（本仓） | `csdog/mediax-agent`                              | CLI / Skill /（后）MCP；只做客户端                               |

开发源码已接通账号、发布、排期、日历及任务处理；需配合同样包含业务控制面的桌面源码。新能力尚未正式发版。命令和配置见 [发布指南](skills/mediax/references/publishing.md)。

## 快速开始

优先用上方[安装](#安装)一句话或 `skills/install.sh`。说明全文见 [install.md](skills/install.md)。

### 配合桌面自检

1. 启动带控制面的 [MediaX 桌面](https://github.com/csdog/mediax)（开发：`pnpm run dev`），等待 Eventually 写出 `~/.mediax/agent/control.json`（约 3 秒）
2. 执行 `mediax-cli doctor`（或 `mxc doctor --json`）

本仓源码开发：

```sh
bun install
bun run mediax-cli doctor
```

本地改代码、生成 API、构建与发版步骤见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。

## 主要能力

| 能力                   | 说明                                                        | 状态 |
| ---------------------- | ----------------------------------------------------------- | ---- |
| doctor                 | 配置与桌面 `/health` 可达性                                 | ✅   |
| skill show / sync      | 展示与同步仓内 Skill                                        | ✅   |
| 更新提示               | 有 GitHub Release 且版本更新时，stderr 提示并给出一句话安装 | ✅   |
| OpenAPI 生成客户端     | `bun run generate:api`                                      | ✅   |
| Bun compile 二进制     | `bun run build` → `dist/mediax-cli`、`dist/mxc`             | ✅   |
| GitHub Release（`v*`） | 打标签发版；What's Changed 依赖 PR 合并                     | ✅   |
| CI 多平台二进制        | Actions 交叉编译并挂到 Release（`release.yml`）             | ✅   |
| 发布                   | `publish --file` 创建立即或定时任务；桌面复用原发布队列     | ✅   |
| 账号 / 发布记录        | 账号查询与刷新；任务查询及目标重试、恢复、核验              | ✅   |
| 草稿 API               | 草稿编辑与保存                                              | ⏳   |
| 排期 / 日历命令        | `tasks reschedule` / `calendar`                             | ✅   |
| MCP                    | CLI 同能力的薄封装                                          | ⏳   |

## 非目标（现阶段）

- 不与 `csdog/mediax` 合并为 monorepo
- 控制通道不依赖第三方云发布商
- 不在本仓实现桌面主进程 HTTP

## 资助

本项目由下列组织资助开发。

| 资助方                                                                                     | 简介                                                                                                                       | 链接                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <img src="build/angryecho-icon.png" width="40" height="40" alt=""> **吐槽网（AngryEcho）** | 以兴趣为核心的实时社区：帖子即讨论室，点赞与互动实时同步；从兴趣热点到圈内新鲜事，随时加入讨论，在多元观点中看见事件全貌。 | <a href="https://www.angryecho.com"><img src="https://img.shields.io/badge/官网-angryecho.com-111827?style=flat-square&logo=googlechrome&logoColor=white" alt="官网"></a> <a href="https://www.angryecho.com/c/angryecho"><img src="https://img.shields.io/badge/社区-angryecho-ea580c?style=flat-square&logo=reddit&logoColor=white" alt="社区"></a> |

## Star History

![Star History Chart](https://api.star-history.com/svg?repos=csdog/mediax-agent&type=Date)

## License

[AGPL-3.0](LICENSE) © csdog（`AGPL-3.0-only`）。

人怎么提 PR 见 [CONTRIBUTING.md](CONTRIBUTING.md)；[AGENTS.md](AGENTS.md) 是给写本仓代码的 Agent 看的约定。
