---
name: mediax-bootstrap
description: "用于安装或升级 MediaX CLI、同步正式 Skill，并完成基础配置与环境自检。"
metadata:
  version: "0.0.9"
  category: productivity
---

# MediaX CLI 安装助手

以下步骤面向 AI Agent。本 bootstrap 只负责安装 CLI、同步正式 `mediax` Skill 和本地自检；完成后停止，不要替用户操作桌面发布。

## 发给 Agent 的一句话

```
请根据 https://raw.githubusercontent.com/csdog/mediax-agent/main/install.md，安装 mediax
```

## 核心原则

- Agent 优先：通过 CLI（`mediax-cli` / `mxc`）使用 MediaX Agent 能力。
- **使用 GitHub Release 已编译客户端**，不引导普通用户安装 Bun / 从源码构建。
- 安装与桌面登录分开：需另启 [MediaX 桌面](https://github.com/csdog/mediax) 写出 `~/.mediax/control.json`。

## 环境要求

- macOS / Linux：Bash、curl、tar、unzip。
- Windows：PowerShell 5.1 或以上。
- **无需 Bun、Node、管理员权限。**

## 本机目录（统一家目录）

真源一律在 `MEDIAX_HOME`（默认 `~/.mediax` / `%USERPROFILE%\.mediax`）：

```text
~/.mediax/
├── bin/mediax-cli             # CLI 真文件（Windows: mediax-cli.exe + mxc.cmd）
├── skills/mediax/             # Skill 真源
├── skills/mx/                 # Skill 短名入口（Skill 名仍为 mx）
├── backups/<旧版本>/…         # 升级前备份（同版本再装会覆盖该目录；最多保留 3 份）
├── control.json               # 桌面写入；安装脚本不碰
└── update.json                # CLI 更新检查缓存
```

Agent / PATH 侧为**软链**（Windows Skill 优先 junction，失败则复制并警告）：

| 链接 | 指向 |
| --- | --- |
| `~/.local/bin/mediax-cli`、`mxc` | `~/.mediax/bin/mediax-cli` |
| `<skills-dir>/mediax` | `~/.mediax/skills/mediax` |
| `<skills-dir>/mx` | `~/.mediax/skills/mx` |
| `~/.agents/skills/mediax`、`mx`（始终维护） | 对应 `~/.mediax/skills/…` |

先确定当前 Agent 的技能**父目录**，将下方 `<skills-dir>` 替换为实际路径：

- Cursor：`~/.cursor/skills/` 或 `~/.agents/skills/`
- Codex：`~/.codex/skills/` 或 `~/.agents/skills/`
- Claude Code：`~/.claude/skills/`

## 第 1 步 安装 CLI 与 Skill

选择当前系统对应的方式，在临时工作目录下载并执行安装脚本。脚本自动识别平台并拉取最新 Release 二进制。

**macOS / Linux（Shell）**

```bash
curl -f --connect-timeout 10 --max-time 120 \
  'https://raw.githubusercontent.com/csdog/mediax-agent/main/install.sh' \
  -o install-mediax.sh &&
bash install-mediax.sh --skills-dir '<skills-dir>'
```

CLI 真文件装入 `$HOME/.mediax/bin/mediax-cli`；默认在 `$HOME/.local/bin` 创建 `mediax-cli` / `mxc` 软链（`--bin-dir` 可改链接目录）。Skill 装入 `$HOME/.mediax/skills/{mediax,mx}`，并软链到 `--skills-dir/{mediax,mx}` 与 `~/.agents/skills/{mediax,mx}`（Skill 短名仍为 `mx`）。仅同步 Skill 用 `--skill-only`。指定版本用 `--ref v0.0.9`。开发者从源码编译用 `--from-source`（此时才需要 Bun）。目录不在 PATH 中时按脚本提示处理，不自动改 shell 配置。

**Windows（PowerShell）**

```powershell
$ErrorActionPreference = 'Stop'
Invoke-WebRequest 'https://raw.githubusercontent.com/csdog/mediax-agent/main/install.ps1' `
  -OutFile install-mediax.ps1 -UseBasicParsing -TimeoutSec 120 -MaximumRedirection 0
& .\install-mediax.ps1 -SkillsDir '<skills-dir>' -AddToPath
```

CLI 装入 `%USERPROFILE%\.mediax\bin`（`mediax-cli.exe` + `mxc.cmd`）。`-AddToPath` 将该目录加入当前用户 PATH。Skill 真源在 `%USERPROFILE%\.mediax\skills\{mediax,mx}`，并对 `-SkillsDir` 与 `%USERPROFILE%\.agents\skills` 建目录链接。仅同步 Skill 用 `-SkillOnly`。指定版本用 `-Ref v0.0.9`。已打开的终端或 Agent 需重启后生效。若执行策略阻止脚本，报告限制，不自动修改系统策略。

Windows ARM64 目前使用 `mediax-windows-x64.zip`（在 ARM 上仿真运行；若后续 Release 提供 arm64 资产再改脚本）。

## 第 2 步 验证 CLI

```shell
mediax-cli --version
mediax-cli doctor
# 或 mxc doctor
```

Windows 若尚未刷新 PATH，可使用安装目录下的绝对路径，例如：

```powershell
& "$env:USERPROFILE\.mediax\bin\mediax-cli.exe" --version
& "$env:USERPROFILE\.mediax\bin\mediax-cli.exe" doctor
```

`doctor` 在桌面未启动或控制面未就绪时失败是预期；先启动 MediaX 桌面并等待 Eventually 写出 `%USERPROFILE%\.mediax\control.json`（或 macOS / Linux 的 `~/.mediax/control.json`）。

## 第 3 步 确认 Skill

确认 `<skills-dir>/mediax/SKILL.md` 与 `<skills-dir>/mx/SKILL.md` 可解析，刷新 Agent 技能列表或重启 Agent。Skill 短名仍为 `mx`（与 CLI 短命令 `mxc` 不同）。

## 更新

已安装的 CLI 在交互终端运行子命令时，若检测到 GitHub Release 有更新版本，会在 stderr 提示，并给出与上方相同的一句话安装指令。设置 `MEDIAX_NO_UPDATE_CHECK=1` 可关闭检查。升级时重新执行第 1 步即可：旧 `bin` / `skills` 会进入 `~/.mediax/backups/<旧版本>/`，并最多保留 3 个备份目录。

## 完成后

停止。不要登录云服务、不要替用户发帖。业务操作交给正式 `mediax` Skill；当前阶段以 `doctor` / `skill` 为主。
