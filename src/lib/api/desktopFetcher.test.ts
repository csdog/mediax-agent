import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { healthGet } from "./desktopComponents";

const envKeys = ["MEDIAX_CONTROL_URL", "MEDIAX_CONTROL_TOKEN", "MEDIAX_CONTROL_CONFIG"] as const;
const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
let directory: string | undefined;
afterEach(async () => {
  for (const key of envKeys) {
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("generated client reads current connection and token for every request", async () => {
  const received: string[] = [];
  const first = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(req) {
      received.push(req.headers.get("authorization") ?? "");
      return Response.json({ ok: true, version: "first" });
    },
  });
  const second = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(req) {
      received.push(req.headers.get("authorization") ?? "");
      return Response.json({ ok: true, version: "second" });
    },
  });
  directory = await mkdtemp(join(tmpdir(), "mediax-fetcher-"));
  const file = join(directory, "control.json");
  delete process.env.MEDIAX_CONTROL_URL;
  delete process.env.MEDIAX_CONTROL_TOKEN;
  process.env.MEDIAX_CONTROL_CONFIG = file;
  try {
    await writeFile(
      file,
      JSON.stringify({ baseUrl: `http://127.0.0.1:${first.port}`, token: "first-token" }),
    );
    expect((await healthGet()).version).toBe("first");
    await writeFile(
      file,
      JSON.stringify({ baseUrl: `http://127.0.0.1:${second.port}`, token: "second-token" }),
    );
    expect((await healthGet()).version).toBe("second");
    expect(received).toEqual(["Bearer first-token", "Bearer second-token"]);
    const controller = new AbortController();
    controller.abort();
    await expect(healthGet(controller.signal)).rejects.toHaveProperty("name", "AbortError");
    expect(received).toHaveLength(2);
    await rm(file);
    await expect(healthGet()).rejects.toThrow("请启动 MediaX");
    expect(received).toHaveLength(2);
  } finally {
    first.stop(true);
    second.stop(true);
  }
});
