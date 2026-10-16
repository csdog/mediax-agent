import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readPublishInput } from "./control";
import { resolveControlConfig } from "../lib/config";

let directory: string | undefined;
afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("CLI commands use generated routes, auth, payload files and JSON failure envelopes", async () => {
  const calls: Array<{ path: string; method: string; body: unknown }> = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      expect(req.headers.get("authorization")).toBe("Bearer cli-test");
      const url = new URL(req.url);
      calls.push({
        path: url.pathname + url.search,
        method: req.method,
        body: req.method === "GET" ? null : await req.json().catch(() => null),
      });
      if (url.pathname === "/tasks/missing")
        return Response.json(
          { error: { code: "NOT_FOUND", message: "任务不存在" } },
          { status: 404 },
        );
      return Response.json(
        url.pathname === "/accounts" ? [] : { task: { id: "task-1" }, targets: [] },
        { status: req.method === "POST" && url.pathname === "/tasks" ? 201 : 200 },
      );
    },
  });
  directory = await mkdtemp(join(tmpdir(), "mediax-cli-"));
  const file = join(directory, "payload.json");
  const payload = {
    kind: "moment",
    body: "保留换行\n中文及 $() 字符",
    targets: [{ accountId: "a1", identityId: "1", kind: "profile" }],
    scheduledAt: "2099-01-01T08:00:00+08:00",
  };
  await writeFile(file, JSON.stringify(payload));
  const run = async (args: string[]) => {
    const proc = Bun.spawn([process.execPath, "run", "src/cli.ts", ...args, "--json"], {
      cwd: import.meta.dir + "/../..",
      env: {
        ...process.env,
        MEDIAX_NO_UPDATE_CHECK: "1",
        MEDIAX_CONTROL_URL: `http://127.0.0.1:${server.port}`,
        MEDIAX_CONTROL_TOKEN: "cli-test",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exit = await proc.exited;
    expect(stderr).not.toContain("cli-test");
    expect(output).not.toContain("cli-test");
    return { exit, result: JSON.parse(output) };
  };
  try {
    for (const args of [
      ["accounts", "list"],
      ["accounts", "refresh", "a1"],
      ["tasks", "list"],
      ["tasks", "get", "task-1"],
      ["publish", "--file", file],
      ["tasks", "reschedule", "task-1", "--at", "2099-02-01T00:00:00Z"],
      ["tasks", "retry", "target-1"],
      ["tasks", "resume", "target-1"],
      ["tasks", "verify", "target-1"],
      ["calendar", "--from", "2099-01-01T00:00:00Z", "--to", "2099-02-01T00:00:00Z"],
    ]) {
      const { exit, result } = await run(args);
      expect(exit).toBe(0);
      expect(result.ok).toBe(true);
    }
    expect(calls.find((c) => c.method === "POST" && c.path === "/tasks")?.body).toEqual(payload);
    expect(calls.some((c) => c.path === "/targets/target-1/resume")).toBe(true);
    expect(calls.some((c) => c.path.startsWith("/calendar?from="))).toBe(true);
    const failed = await run(["tasks", "get", "missing"]);
    expect(failed.exit).toBe(1);
    expect(failed.result.error.message).toBe("任务不存在");
    expect(calls.filter((c) => c.path === "/tasks/missing")).toHaveLength(1);
  } finally {
    server.stop(true);
  }
});

test("invalid JSON input is rejected before a publish request", async () => {
  directory = await mkdtemp(join(tmpdir(), "mediax-input-"));
  const file = join(directory, "payload.json");
  await writeFile(file, "[");
  await expect(readPublishInput(file)).rejects.toThrow("JSON");
  await writeFile(file, "[]");
  await expect(readPublishInput(file)).rejects.toThrow("对象");
});

test("environment config rejects remote hosts before sending the local token", () => {
  const previous = { url: process.env.MEDIAX_CONTROL_URL, token: process.env.MEDIAX_CONTROL_TOKEN };
  try {
    process.env.MEDIAX_CONTROL_URL = "https://example.com";
    process.env.MEDIAX_CONTROL_TOKEN = "local-token";
    expect(resolveControlConfig().config).toBeNull();
  } finally {
    if (previous.url === undefined) delete process.env.MEDIAX_CONTROL_URL;
    else process.env.MEDIAX_CONTROL_URL = previous.url;
    if (previous.token === undefined) delete process.env.MEDIAX_CONTROL_TOKEN;
    else process.env.MEDIAX_CONTROL_TOKEN = previous.token;
  }
});
