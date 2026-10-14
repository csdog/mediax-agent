# MediaX Agent 共享规则

## CLI 入口

- 命令：`mediax`（别名 `mx`）
- 仓库：`csdog/mediax-agent`
- 桌面：`csdog/mediax`（Electron；控制面规划为 Hono + OpenAPI，仅 `127.0.0.1`）

## 配置

| 来源 | 说明 |
| --- | --- |
| `MEDIAX_CONTROL_URL` + `MEDIAX_CONTROL_TOKEN` | 环境变量，须成对出现 |
| `~/.mediax/control.json` | 桌面 Eventually 阶段写入（约启动后 3s）；退出时删除 |
| `MEDIAX_HOME` | 覆盖配置目录（默认 `~/.mediax`） |
| `MEDIAX_CONTROL_CONFIG` | 覆盖 control.json 路径 |

`control.json` 形状：

```json
{
  "baseUrl": "http://127.0.0.1:<port>",
  "token": "<secret>",
  "apiVersion": 1
}
```

`baseUrl` 主机名必须是 `127.0.0.1` 或 `localhost`。

## doctor

```bash
mediax doctor
mediax doctor --json
```

- 人类可读默认；Agent 解析用 `--json`。
- 会探测 `GET {baseUrl}/health`（Bearer token）。
- 桌面尚未提供控制面时：`ok: false`、exit code `1` 属正常，不要假装已连通。

## 输出协议

`--json` 时顶层字段包括：`ok`、`action`、`version`、`data`。  
`doctor` 的 `data.readiness.blockers` 列出未就绪原因。

## Skill 同步

Skill 源文件在本仓 `skills/mediax/`。同步到本机后供 Cursor / Claude 等加载：

```bash
mediax skill sync
# 默认目标：~/.agents/skills/mediax
mediax skill sync --dir /path/to/skills/mediax
```
