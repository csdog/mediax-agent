import { afterEach, describe, expect, test } from "bun:test";
import { formatDoctorHuman, runDoctor } from "./doctor";

const envKeys = ["MEDIAX_CONTROL_URL", "MEDIAX_CONTROL_TOKEN", "MEDIAX_CONTROL_CONFIG"] as const;

function snapshotEnv() {
  return Object.fromEntries(envKeys.map((key) => [key, process.env[key]])) as Record<
    (typeof envKeys)[number],
    string | undefined
  >;
}

function restoreEnv(prev: ReturnType<typeof snapshotEnv>) {
  for (const key of envKeys) {
    if (prev[key] === undefined) delete process.env[key];
    else process.env[key] = prev[key];
  }
}

describe("doctor", () => {
  const prev = snapshotEnv();
  afterEach(() => restoreEnv(prev));

  test("reports not ready without desktop config", async () => {
    delete process.env.MEDIAX_CONTROL_URL;
    delete process.env.MEDIAX_CONTROL_TOKEN;
    process.env.MEDIAX_CONTROL_CONFIG = "/tmp/mediax-agent-missing-control.json";

    const report = await runDoctor();
    expect(report.ok).toBe(false);
    expect(report.action).toBe("doctor");
    expect(report.data.desktop.configured).toBe(false);
    expect(report.data.readiness.canCallControlApi).toBe(false);
    expect(report.data.readiness.blockers.length).toBeGreaterThan(0);

    const human = formatDoctorHuman(report).join("\n");
    expect(human).toContain("Not ready");
  });

  test("reports ready against a loopback /health desktop", async () => {
    const token = "doctor-test-token";
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(req) {
        const { pathname } = new URL(req.url);
        if (pathname !== "/health") return new Response("not found", { status: 404 });
        if (req.headers.get("authorization") !== `Bearer ${token}`) {
          return new Response("unauthorized", { status: 401 });
        }
        return Response.json({ ok: true, version: "0.2.0" });
      },
    });

    try {
      delete process.env.MEDIAX_CONTROL_CONFIG;
      process.env.MEDIAX_CONTROL_URL = `http://127.0.0.1:${server.port}`;
      process.env.MEDIAX_CONTROL_TOKEN = token;

      const report = await runDoctor();
      expect(report.ok).toBe(true);
      expect(report.data.desktop.configured).toBe(true);
      expect(report.data.desktop.reachable).toBe(true);
      expect(report.data.readiness.canCallControlApi).toBe(true);
      expect(report.data.readiness.blockers).toEqual([]);
      expect(formatDoctorHuman(report).join("\n")).toContain("OK — control API reachable");
    } finally {
      server.stop(true);
    }
  });
});
