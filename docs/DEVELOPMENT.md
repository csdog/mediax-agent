# 开发与构建

给人 / Agent 改本仓代码时用。产品说明见 [README.md](../README.md)；写代码约定见 [AGENTS.md](../AGENTS.md)。

本目录即 Git 仓库根（GitHub：`csdog/mediax-agent`）。若放在外层 `mediax/mediax-agent/`，请进入本目录再执行命令。用 **Bun**（不要默认改成 npm/pnpm/vite）。TypeScript 与桌面对齐为 **7.0.2**。

## 本地开发

```sh
bun install
bun run mediax --help
bun run doctor
bun run mediax doctor --json
bun run mediax skill show
bun run mediax skill sync   # → ~/.agents/skills/mediax
bun run generate:api
bun test
bun run typecheck
bun run build               # dist/mediax + dist/mx（Bun compile）+ dist/skills/
```

`doctor` 读取 `~/.mediax/control.json`（或 `MEDIAX_CONTROL_URL` + `MEDIAX_CONTROL_TOKEN`），经生成客户端探测 `GET {baseUrl}/health`。需本机已启动带控制面的 MediaX 桌面（Eventually 后约 3s 写出 control.json）。

### CLI 更新提示

交互终端（stderr 为 TTY）下，正常子命令会读本地 `update.json` 缓存；若缓存的最新版本高于当前 `package.json` version，则在 **stderr** 打印提醒（含安装说明链接与一句话安装）。后台最多每 24h 请求一次 GitHub `releases/latest`。设置 `MEDIAX_NO_UPDATE_CHECK=1` 可关闭。`--help` / `--version` 不检查。

## 构建与发版

```sh
bun run build    # → dist/mediax、dist/mx，并复制 skills/ → dist/skills/
```

### 走 PR，再打 tag

GitHub Release 的自动 **What's Changed** 只汇总合并进默认分支的 **PR**。

1. 功能分支开发（含需要的 `package.json` / Skill `version` bump）。
2. 开 PR → Review → **merge 进 `main`**。
3. 在已合并的 `main` 上打并推送与 version 一致的 `v*` 标签（如 `v0.0.2`），创建 [GitHub Release](https://github.com/csdog/mediax-agent/releases)。

```sh
git tag v0.0.2
git push origin v0.0.2
```

当前无 Actions 工作流自动交叉编译；Release 资产可先本机 `bun run build` 后手动挂上，或仅发源码 / changelog。CI 多平台二进制后续补。

用户要求「提交并推送」且属发版范围时：默认走 PR 再打 tag；明确「直推 / 不要 PR」时才直推（并自行写清 release 正文或接受无 What's Changed）。

## OpenAPI 客户端

- 配置：[`openapi-codegen.config.ts`](../openapi-codegen.config.ts)（`generateSchemaTypes` + `generateFetchers`，prefix `desktop`）
- 手写：`src/lib/api/desktopFetcher.ts`（`baseUrl` + bearer `token`）
- 生成：`desktopSchemas.ts` / `desktopComponents.ts`（勿手改；改契约后重跑 generate）
- 默认契约：fixture [`openapi/control.openapi.json`](../openapi/control.openapi.json)
- 从运行中的桌面拉规约（Hono 通常挂 `/doc`）：

  ```sh
  MEDIAX_OPENAPI_URL=http://127.0.0.1:<port>/doc bun run generate:api
  ```

- codegen 内部经 `scripts/preload-ts48.cjs` 使用嵌套 TypeScript 4.8；项目本身可继续用 TypeScript 7。改完生成结果后由 `scripts/fix-generated-imports.mjs` 适配 `verbatimModuleSyntax`。

## Skill

唯一源：[`skills/mediax/`](../skills/mediax/)。有意义的 CLI/契约变更时同步改 `SKILL.md` / `references/`，并视需要抬 Skill frontmatter `version`。拉取或升级后：

```sh
mediax skill sync
```

## 技术栈

| 层 | 选型 |
| --- | --- |
| CLI | TypeScript + Bun compile → 单文件 `mediax` / `mx` |
| 命令 | citty |
| API 客户端 | `@openapi-codegen/typescript`（对齐 angryecho-web） |
| 桌面控制面 | [`csdog/mediax`](https://github.com/csdog/mediax) 主进程 Hono + OpenAPI；loopback + token |

Electron 不能用 Bun 作主进程运行时；Bun 仅用于本 CLI。

## 约束摘要

- 只连 `127.0.0.1` / `localhost`；不经云中转。
- 日志与 JSON **不要**打印完整 token。
- 不与 `csdog/mediax` 做成 monorepo；不在本仓实现桌面主进程 HTTP。
- MCP 若添加：必须走与 CLI 相同的库/命令路径。
