# 发布与排期

先执行 `doctor --json`，然后查询 `accounts list --json`。账号列表包括登录状态、`supportedKinds` 与 `targets`。`targets` 中的 `accountId`、`identityId` 和 `kind` 原样用于发布。

将配置写入本地 JSON 文件，通过 `--file` 读取，不把正文拼接进 shell 命令：

```json
{
  "kind": "moment",
  "body": "用户确认的发布正文",
  "paths": ["/absolute/path/image.png"],
  "targets": [{ "accountId": "从账号列表获取", "identityId": "1", "kind": "profile" }],
  "scheduledAt": "2099-01-01T08:00:00+08:00"
}
```

```sh
mediax-cli publish --file publish.json --json
```

- `kind`：`article | moment | video | audio`。文章需要标题 `title` 和正文，最多一张封面；动态需要正文，附件只能是图片；视频 / 音频需各一个对应文件，正文可省略。
- `paths` 可省略，素材必须为本机绝对路径，沿用桌面 20MB 单文件限制。桌面复制素材保存任务快照。
- 定时必须使用晚于当前时间、包含时区的 ISO 时间。省略 `scheduledAt` 或传 `null` **立即执行发布**。用户只要求排期时不能省略。
- 目标名称由桌面按已验证身份解析。不要伪造身份或绕过平台发布类型限制。
- 201 / `ok: true` 只表示任务已创建。读取 `data.task.id`，通过 `tasks get TASK_ID --json` 查询最终 `targets[].status`。
- 排期需要桌面保持运行；应用退出或电脑关机无法按时执行。

## 处理任务

```sh
mediax-cli tasks list --json
mediax-cli tasks get TASK_ID --json
mediax-cli tasks reschedule TASK_ID --at '2099-01-01T08:00:00+08:00' --json
mediax-cli calendar --from '2099-01-01T00:00:00+08:00' --to '2099-02-01T00:00:00+08:00' --json
```

日历范围含开始、不含结束；只可更改全部目标仍是 `scheduled` 的任务。

以下参数是 `data.targets[].id`，不是任务 ID：

```sh
mediax-cli tasks retry TARGET_ID --json
mediax-cli tasks resume TARGET_ID --json
mediax-cli tasks verify TARGET_ID --json
```

- `failed`：明确失败，可重试；先修复错误原因。
- `awaiting_user`：用户在桌面完成登录、验证码或身份处理后恢复。
- `submitted` / `unknown`：可能已发出，只核验，不重复提交。
- `verified`：已核验成功，不重试。

网络中断或调用超时不能证明发布失败。先查任务记录，避免再次创建相同任务；当前接口没有幂等键。操作拒绝时读取 `error.message`。
