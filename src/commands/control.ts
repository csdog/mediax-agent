import { readFile } from "node:fs/promises";
import { defineCommand } from "citty";
import * as api from "../lib/api/desktopComponents";
import type { PublishInput } from "../lib/api/desktopSchemas";
import { printJson, printLines } from "../lib/print";
import { cliVersion } from "../version";

/** Read payload only from a file; content never enters shell quoting or command history. */
export async function readPublishInput(file: string): Promise<PublishInput> {
  let input: unknown;
  try {
    input = JSON.parse(await readFile(file, "utf8"));
  } catch {
    throw new Error("无法读取发布配置，请检查文件路径和 JSON 格式。");
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("发布配置必须是 JSON 对象。");
  // Business validation belongs to the desktop's versioned OpenAPI contract.
  return input as PublishInput;
}

export function controlError(error: unknown): string {
  if (error && typeof error === "object" && "payload" in error) {
    const payload = error.payload;
    if (payload && typeof payload === "object" && "error" in payload) {
      const detail = payload.error;
      if (
        detail &&
        typeof detail === "object" &&
        "message" in detail &&
        typeof detail.message === "string"
      )
        return detail.message;
    }
    if ("status" in error && error.status === 401)
      return "控制面认证失败，请重新启动 MediaX 后重试。";
    return "桌面未提供此操作，或请求未完成。请检查桌面版本和任务记录。";
  }
  return error instanceof Error && /[\u3400-\u9fff]/.test(error.message)
    ? error.message
    : "无法连接 MediaX 桌面。请检查桌面是否运行，并查询任务记录后再决定是否重试。";
}

const jsonArg = { type: "boolean" as const, description: "Print JSON", default: false };
const idArg = {
  type: "positional" as const,
  description: "Account / task / target ID",
  required: true as const,
};

export async function runControl(action: string, json: boolean, work: () => Promise<unknown>) {
  try {
    const data = await work();
    const result = { ok: true, action, version: cliVersion(), data };
    if (json) printJson(result);
    else printLines([`${action} 完成`, JSON.stringify(data, null, 2)]);
    return result;
  } catch (error) {
    process.exitCode = 1;
    const result = {
      ok: false,
      action,
      version: cliVersion(),
      data: null,
      error: { message: controlError(error) },
    };
    if (json) printJson(result);
    else printLines([result.error.message]);
    return result;
  }
}

export const accountsCommand = defineCommand({
  meta: { name: "accounts", description: "List accounts and verified publish identities" },
  subCommands: {
    list: defineCommand({
      args: { json: jsonArg },
      run: ({ args }) => runControl("accounts.list", args.json, () => api.accountsList()),
    }),
    refresh: defineCommand({
      args: { id: idArg, json: jsonArg },
      run: ({ args }) =>
        runControl("accounts.refresh", args.json, () =>
          api.accountRefresh({ pathParams: { id: args.id } }),
        ),
    }),
  },
});
export const publishCommand = defineCommand({
  meta: {
    name: "publish",
    description: "Create an immediate or scheduled task from a JSON file (executes publishing)",
  },
  args: {
    file: {
      type: "string",
      description: "PublishInput JSON file; local assets use absolute paths",
      required: true,
    },
    json: jsonArg,
  },
  run: ({ args }) =>
    runControl("publish", args.json, async () =>
      api.taskCreate({ body: await readPublishInput(args.file) }),
    ),
});
export const tasksCommand = defineCommand({
  meta: {
    name: "tasks",
    description: "Inspect tasks, reschedule, retry, resume or verify targets",
  },
  subCommands: {
    list: defineCommand({
      args: { json: jsonArg },
      run: ({ args }) => runControl("tasks.list", args.json, () => api.tasksList()),
    }),
    get: defineCommand({
      args: { id: idArg, json: jsonArg },
      run: ({ args }) =>
        runControl("tasks.get", args.json, () => api.taskGet({ pathParams: { id: args.id } })),
    }),
    reschedule: defineCommand({
      args: {
        id: idArg,
        at: { type: "string", required: true, description: "ISO timestamp with timezone" },
        json: jsonArg,
      },
      run: ({ args }) =>
        runControl("tasks.reschedule", args.json, () =>
          api.taskReschedule({
            pathParams: { id: args.id },
            body: { scheduledAt: args.at },
          }),
        ),
    }),
    ...Object.fromEntries(
      (["retry", "resume", "verify"] as const).map((action) => [
        action,
        defineCommand({
          meta: { description: `${action} one target (ID from task.targets)` },
          args: { id: idArg, json: jsonArg },
          run: ({ args }) =>
            runControl(`tasks.${action}`, args.json, () =>
              api.targetAction({ pathParams: { id: args.id, action } }),
            ),
        }),
      ]),
    ),
  },
});
export const calendarCommand = defineCommand({
  meta: { name: "calendar", description: "List scheduled and published tasks in a time range" },
  args: {
    from: { type: "string", required: true, description: "ISO timestamp with timezone" },
    to: { type: "string", required: true, description: "ISO timestamp with timezone (exclusive)" },
    json: jsonArg,
  },
  run: ({ args }) =>
    runControl("calendar", args.json, () =>
      api.calendarList({ queryParams: { from: args.from, to: args.to } }),
    ),
});
