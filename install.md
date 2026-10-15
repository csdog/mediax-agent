---
name: mediax-bootstrap
description: "用于安装或升级 MediaX CLI、同步正式 Skill，并完成基础配置与环境自检。"
metadata:
  version: "0.0.6"
  category: productivity
---

# MediaX CLI 安装助手

以下步骤面向 AI Agent。本 bootstrap 只负责安装 CLI、同步正式 `mediax` Skill 和本地自检；完成后停止，不要替用户操作桌面发布。

## 发给 Agent 的一句话

```
请根据 https://raw.githubusercontent.com/csdog/mediax-agent/main/install.md，安装 mediax
```

## 核心原则

- Agent 优先：通过 CLI（`mediax` / `mx`）使用 MediaX Agent 能力。
- **使用 GitHub Release 已编译客户端**，不引导普通用户安装 Bun / 从源码构建。
- 安装与桌面登录分开：需另启 [MediaX 桌面](https://github.com/csdog/mediax) 写出 `~/.mediax/control.json`。

## 环境要求

- macOS / Linux：Bash、curl、tar、unzip。
- **无需 Bun、Node、管理员权限。**
- Windows：可从 [Releases](https://github.com/csdog/mediax-agent/releases) 下载 `mediax-windows-x64.zip`；shell 安装脚本以 macOS / Linux 为主。

## 安装目录

先确定当前 Agent 的技能目录，将下方 `<skills-dir>` 替换为实际**父目录**（脚本会写入 `<skills-dir>/mediax`）。

常用路径：

- Cursor：`~/.cursor/skills/` 或 `~/.agents/skills/`
- Codex：`~/.codex/skills/` 或 `~/.agents/skills/`
- Claude Code：`~/.claude/skills/`

## 第 1 步 安装 CLI 与 Skill

在临时目录下载并执行安装脚本（自动识别平台并拉取最新 Release 二进制）：

```bash
curl -f --connect-timeout 10 --max-time 120 \
  'https://raw.githubusercontent.com/csdog/mediax-agent/main/install.sh' \
  -o install-mediax.sh &&
bash install-mediax.sh --skills-dir '<skills-dir>'
```

仅同步 Skill（不装 CLI）时追加 `--skill-only`。自定义 CLI 目录用 `--bin-dir`。指定版本用 `--ref v0.0.6`。

开发者若需从源码编译，追加 `--from-source`（此时才需要 [Bun](https://bun.sh)）。

客户端默认安装到 `$HOME/.local/bin`，并创建 `mx` → `mediax` 软链接。目录不在 PATH 中时按脚本提示处理，不自动改 shell 配置。

## 第 2 步 验证 CLI

```shell
mediax --version
mediax doctor
```

`doctor` 在桌面未启动或控制面未就绪时失败是预期；先启动 MediaX 桌面并等待 Eventually 写出 `~/.mediax/control.json`。

## 第 3 步 确认 Skill

确认 `<skills-dir>/mediax/SKILL.md` 存在，刷新 Agent 技能列表或重启 Agent。

## 更新

已安装的 CLI 在交互终端运行子命令时，若检测到 GitHub Release 有更新版本，会在 stderr 提示，并给出与上方相同的一句话安装指令。设置 `MEDIAX_NO_UPDATE_CHECK=1` 可关闭检查。升级时重新执行第 1 步即可。

## 完成后

停止。不要登录云服务、不要替用户发帖。业务操作交给正式 `mediax` Skill；当前阶段以 `doctor` / `skill` 为主。
