# MediaX Agent

**MediaX 的 Agent 面**  
CLI + Skill，让 Cursor / Claude 等通过本机命令操作桌面  
loopback 连接 · 本地 token · 不经第三方云端

![release](https://img.shields.io/github/v/release/csdog/mediax-agent?style=flat-square&label=release)![Bun](https://img.shields.io/badge/Bun-compile-fbf0df?style=flat-square&logo=bun&logoColor=black)![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6?style=flat-square&logo=typescript&logoColor=white)![CLI](https://img.shields.io/badge/CLI-mediax%20%7C%20mx-111827?style=flat-square)

[为什么用](#为什么用-mediax-agent) · [特性](#特性) · [与桌面的关系](#与桌面的关系) · [快速开始](#快速开始) · [主要能力](#主要能力) · [开发](docs/DEVELOPMENT.md) · [Contributing](CONTRIBUTING.md) · [Releases](https://github.com/csdog/mediax-agent/releases)

---

## 为什么用 MediaX Agent

桌面仓 [`csdog/mediax`](https://github.com/csdog/mediax) 负责账号、创作与发布；本仓是给 Agent 用的**机器入口**，不另起一套云发布通道。

- **同一套命令** — 主命令 `mediax`，别名 `mx`；Skill / 日后 MCP 都走同一路径
- **本机可控** — 只连桌面 loopback HTTP + 本地 token，不经第三方云中转
- **契约生成** — 客户端由桌面 OpenAPI 生成，避免手写第二套类型

## 特性

| | |
| --- | --- |
| 🩺 **doctor** | 检查 `control.json` / 环境变量，探测桌面 `GET /health` |
| 📎 **Skill** | 仓内维护 `skills/mediax/`，`mediax skill sync` 同步到本机 |
| 📦 **单文件分发** | Bun compile → `mediax` / `mx`，终端用户不必装 Node |
| 🔌 **OpenAPI 客户端** | `@openapi-codegen/typescript` 生成类型化调用 |

## 与桌面的关系

| 侧 | 仓库 | 职责 |
| --- | --- | --- |
| 桌面 | [`csdog/mediax`](https://github.com/csdog/mediax) | Electron；Hono 控制面写 `~/.mediax/control.json`；业务真源 |
| Agent（本仓） | `csdog/mediax-agent` | CLI / Skill /（后）MCP；只做客户端 |

创建或改动**排期**的命令，需等桌面落地**多平台排期**与**内容日历**后再做。当前以 `doctor` / `skill` 等业务无关能力为主。

## 快速开始

### 下载使用

1. 打开 [Releases](https://github.com/csdog/mediax-agent/releases)，按系统下载 `mediax`（或 `mx`）二进制（有发布时）
2. 放到 `PATH` 后执行 `mediax doctor`
3. （可选）`mediax skill sync` 同步 Skill

发版：在已合并的 `main` 上打与 `package.json` 一致的 `v*` 标签（如 `v0.0.2`）并推送，用于 GitHub Release。当前优先本机 `bun run build`；CI 自动打多平台二进制仍待补齐。

### 配合桌面自检

1. 启动带控制面的 [MediaX 桌面](https://github.com/csdog/mediax)（开发：`pnpm run dev`），等待 Eventually 写出 `~/.mediax/control.json`（约 3 秒）
2. 或本仓源码运行：

```sh
bun install
bun run mediax doctor
# 或
bun run mediax doctor --json
```

本地改代码、生成 API、构建与发版步骤见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。

## 主要能力

| 能力 | 说明 | 状态 |
| --- | --- | --- |
| doctor | 配置与桌面 `/health` 可达性 | ✅ |
| skill show / sync | 展示与同步仓内 Skill | ✅ |
| OpenAPI 生成客户端 | `bun run generate:api` | ✅ |
| Bun compile 二进制 | `bun run build` → `dist/mediax`、`dist/mx` | ✅ |
| GitHub Release（`v*`） | 打标签发版；What's Changed 依赖 PR 合并 | 🚧 |
| CI 多平台二进制 | Actions 交叉编译并挂到 Release | ⏳ |
| 发布 / 草稿 API | 经控制面创建内容、触发发布 | ⏳ |
| 排期 / 日历命令 | 依赖桌面排期与内容日历 | ⏳ |
| MCP | CLI 同能力的薄封装 | ⏳ |

## 非目标（现阶段）

- 不与 `csdog/mediax` 合并为 monorepo
- 控制通道不依赖第三方云发布商
- 不在本仓实现桌面主进程 HTTP

## Star History

![Star History Chart](https://api.star-history.com/svg?repos=csdog/mediax-agent&type=Date)

## License

[AGPL-3.0](LICENSE) © csdog（`AGPL-3.0-only`）。

人怎么提 PR 见 [CONTRIBUTING.md](CONTRIBUTING.md)；[AGENTS.md](AGENTS.md) 是给写本仓代码的 Agent 看的约定。
