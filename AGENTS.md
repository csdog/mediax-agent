# AGENTS.md

MediaX 的 Agent 面仓库（GitHub：`csdog/mediax-agent`）。本目录即仓库根；本地可放在外层容器 `mediax/mediax-agent/`，与桌面仓 `mediax-desktop/`（`csdog/mediax`）并列、**独立 git**。

给 Cursor / Claude 等用的 **CLI + Skill**（MCP 以后做薄封装）。业务发布/排期命令 **blocked by** 桌面排期与内容日历；当前以 `doctor` / `skill` 等业务无关能力为主。

## 命令

完整本地开发 / 生成客户端 / 构建见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。用 **Bun**（不要默认改成 npm/pnpm/vite）。TypeScript 与桌面对齐为 **7.0.2**。

```sh
bun install
bun run doctor
bun run mediax-cli doctor --json
bun run generate:api
bun test
bun run build
```

`doctor` 在无 `control.json` / 连不上 `/health` 时 exit `1` 是预期（桌面未开或未进 Eventually）。不要实现或假装已实现桌面尚未提供的业务 API。

## 代码位置

- `src/cli.ts`：citty 入口；子命令注册处。
- `src/commands/`：子命令（`doctor`、`skill`…）。
- `src/lib/config.ts`：`~/.mediax/agent/control.json` 与环境变量解析；**只允许 loopback**。
- `src/lib/desktop.ts`：经生成客户端探测 `healthGet`。
- `src/lib/skill.ts`：Skill 路径解析与同步。
- `src/lib/api/`：OpenAPI 客户端。`desktopFetcher.ts` 手写；`desktopSchemas.ts` / `desktopComponents.ts` 由 `bun run generate:api` 生成，**不要手写第二套 HTTP 类型**。
- `openapi-codegen.config.ts`：与 angryecho-web 同款 `@openapi-codegen` 流水线；默认读 `openapi/control.openapi.json`，可用 `MEDIAX_OPENAPI_URL` 拉桌面 `/doc`。
- `skills/mediax/`：**Agent Skill 源文件**（`SKILL.md` + `references/`）；改 CLI 行为时同步改 Skill，并视需要 bump Skill frontmatter `version`。
- `skills/mx/`：短名入口 Skill（与 AngryEcho 的 `ae` 同模式）；安装/同步时一并维护。

## 与桌面的边界

| 侧 | 仓库 | 职责 |
| --- | --- | --- |
| 桌面 | `csdog/mediax` | Electron；规划中主进程 **Hono + OpenAPI/Swagger**，写 `control.json`，业务真源 |
| 本仓 | `csdog/mediax-agent` | CLI / Skill /（后）MCP；只做客户端 |

- 连接：`127.0.0.1` + 本地 token；**不要**云中转、不要监听非 loopback。
- 配置优先级：`MEDIAX_CONTROL_URL` + `MEDIAX_CONTROL_TOKEN` > `MEDIAX_CONTROL_CONFIG` / `~/.mediax/agent/control.json`。
- 显示名 MediaX；CLI 命令 `mediax-cli` / `mxc`；Skill 名 `mediax` / `mx`。

## Skill

- 唯一源：`skills/mediax/`；短名：`skills/mx/`。
- 同步到本机：`mediax-cli skill sync`（刷新 `~/.mediax/agent/skills/{mediax,mx}`，并软链 `~/.agents/skills/{mediax,mx}`；`--dir` 可额外链接其它 Agent 路径及其 sibling）。
- Skill 文案必须可执行（真实子命令与 flag）；未实现的能力写明「未实现」，禁止编造命令。
- 有意义的 CLI/契约变更时：更新 `SKILL.md` / `references/`，必要时抬 Skill `version`。

## 版本与发版

对用户可见的 CLI/Skill 行为有实质变化时，**同一批提交**抬 `package.json` 的 `version`（semver），并视需要同步 Skill frontmatter `version`。

### 走 PR，再打 tag

完整构建与发版步骤见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。GitHub Release 自动 **What's Changed** 只汇总合并进默认分支的 **PR**。

1. 功能分支开发（含 version bump）。
2. PR → merge 进 `main`。
3. 在已合并的 `main` 上打并推送与 `package.json` 一致的 `v*` 标签，创建 [Release](https://github.com/csdog/mediax-agent/releases)。

用户要求「提交并推送」且属发版范围时：默认走 PR 再打 tag；明确「直推 / 不要 PR」时才直推。

## 约束

- 输出：人类可读默认；机器用 `--json`（字段含 `ok` / `action` / `version` / `data`）。更新提醒只写 **stderr**，不要污染 stdout JSON。
- 日志与 JSON **不要**打印完整 token。
- 更新检查：`src/lib/update.ts`；缓存 `~/.mediax/agent/update.json`；默认源为 GitHub Releases；可用 `MEDIAX_NO_UPDATE_CHECK` / `MEDIAX_UPDATE_URL`。
- 本机安装布局：`~/.mediax/agent/{bin,skills,backups,control.json}`；Agent/PATH 用软链，见 [install.md](install.md)。
- 不把本仓改成与 `csdog/mediax` 的 monorepo。
- 不在本仓实现桌面主进程 HTTP；契约变更以桌面 OpenAPI 为准，本仓只跑 `generate:api` 消费生成客户端。
- 改 `DesktopFetcherExtraProps` 后必须重跑 `generate:api`（并保留 `scripts/fix-generated-imports.mjs` 对 `verbatimModuleSyntax` 的修补）。
- MCP 若添加：必须调用与 CLI 相同的库/命令路径，禁止第二套协议语义。
