# MediaX Agent 共享规则

## CLI 入口

- 命令：`mediax-cli`（短命令 `mxc`）
- 仓库：`csdog/mediax-agent`
- 桌面：`csdog/mediax`（Electron；控制面规划为 Hono + OpenAPI，仅 `127.0.0.1`）

## 配置

| 来源 | 说明 |
| --- | --- |
| `MEDIAX_CONTROL_URL` + `MEDIAX_CONTROL_TOKEN` | 环境变量，须成对出现 |
| `~/.mediax/agent/control.json` | 桌面 Eventually 阶段写入（约启动后 3s）；退出时删除 |
| `MEDIAX_HOME` | 覆盖产品根目录（默认 `~/.mediax`；其下 `agent/` 为 Agent 树） |
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
mediax-cli doctor
mediax-cli doctor --json
# 或 mxc doctor
```

- 人类可读默认；Agent 解析用 `--json`。
- 会探测 `GET {baseUrl}/health`（Bearer token）。
- 桌面尚未提供控制面时：`ok: false`、exit code `1` 属正常，不要假装已连通。

## 输出协议

`--json` 时顶层字段包括：`ok`、`action`、`version`、`data`。  
`doctor` 的 `data.readiness.blockers` 列出未就绪原因。

## 本机布局

| 路径 | 说明 |
| --- | --- |
| `~/.mediax/agent/control.json` | 桌面控制面配置 |
| `~/.mediax/agent/bin/mediax-cli` | 已安装 CLI 真文件 |
| `~/.mediax/agent/skills/mediax` | 已安装 Skill 真源 |
| `~/.mediax/agent/skills/mx` | 短名入口 Skill（Skill 名仍为 `mx`） |
| `~/.mediax/agent/backups/<version>/` | 升级备份（最多保留 3 份） |
| `~/.mediax/agent/update.json` | 更新检查缓存 |
| `~/.local/bin/mediax-cli`、`mxc` | → `~/.mediax/agent/bin/mediax-cli`（PATH 软链） |
| `~/.agents/skills/mediax`、`mx` 等 | → 对应 `~/.mediax/agent/skills/…`（Agent 发现软链） |

## Skill 同步

仓内源文件：`skills/mediax/` + `skills/mx/`。`mediax-cli skill sync` 刷新家目录 Skill，并维护 Agent 软链：

```bash
mediax-cli skill sync
mediax-cli skill sync --dir ~/.cursor/skills/mediax
```
