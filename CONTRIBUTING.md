# Contributing

感谢关注 MediaX Agent。本仓目前为私有维护；若你有权限提交改动，请按下面约定。

## 本地开发

见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。

## 提改动

1. 在功能分支上开发，不要把发版相关改动只直推 `main`。
2. 开 PR → Review → **merge 进 `main`**。
3. 对用户可见的 CLI / Skill 实质变化，**同一批提交**抬 `package.json` 的 `version`，并视需要同步 Skill frontmatter `version`。
4. 若需发二进制 / Release：在已合并的 `main` 上打并推送与 version 一致的 `v*` 标签。

GitHub Release 的自动 What's Changed 只汇总合并进默认分支的 **PR**。

## 写代码时

给自动化助手 / Agent 的详细约定见 [AGENTS.md](AGENTS.md)。人审 PR 时也可对照同一份。

## 不要做的事

- 不要编造尚未实现的 CLI 子命令（Skill 文案同样禁止）。
- 不要手写第二套 HTTP 类型；契约变更后跑 `bun run generate:api`。
- 日志与 JSON 不要打印完整 token。
