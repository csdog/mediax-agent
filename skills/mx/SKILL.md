---
name: mx
description: MediaX 的简短入口。通过 mediax-cli / mxc CLI 操作本机 MediaX 桌面（doctor 等）；复用 mediax Skill 的工作流。
---

# MediaX 简短入口

读取同一技能目录中的 [mediax/SKILL.md](../mediax/SKILL.md)，按其中的意图分流和规则执行用户任务。

主工作流内的相对链接以 `mediax/` 目录为基准；按需读取对应参考文件。Skill 短名 `mx` 与完整 Skill `mediax` 使用同一个 CLI（`mediax-cli` / `mxc`）、配置和业务流程，无需重复安装。

如果同级 `mediax/SKILL.md` 缺失，报告安装不完整，先按 [install.md](https://raw.githubusercontent.com/csdog/mediax-agent/main/install.md) 同步完整 Skill 包。
