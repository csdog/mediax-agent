import { describe, expect, test } from "bun:test";
import { formatDoctorHuman, runDoctor } from "./doctor";

describe("doctor", () => {
  test("reports not ready without desktop config", async () => {
    const prevUrl = process.env.MEDIAX_CONTROL_URL;
    const prevToken = process.env.MEDIAX_CONTROL_TOKEN;
    const prevConfig = process.env.MEDIAX_CONTROL_CONFIG;
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

    if (prevUrl === undefined) delete process.env.MEDIAX_CONTROL_URL;
    else process.env.MEDIAX_CONTROL_URL = prevUrl;
    if (prevToken === undefined) delete process.env.MEDIAX_CONTROL_TOKEN;
    else process.env.MEDIAX_CONTROL_TOKEN = prevToken;
    if (prevConfig === undefined) delete process.env.MEDIAX_CONTROL_CONFIG;
    else process.env.MEDIAX_CONTROL_CONFIG = prevConfig;
  });
});
