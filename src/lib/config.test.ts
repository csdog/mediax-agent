import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultAgentHome,
  defaultControlConfigPath,
  resolveControlConfig,
} from "./config";

const envKeys = [
  "MEDIAX_HOME",
  "MEDIAX_CONTROL_CONFIG",
  "MEDIAX_CONTROL_URL",
  "MEDIAX_CONTROL_TOKEN",
] as const;

const saved: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};

function stashEnv() {
  for (const key of envKeys) saved[key] = process.env[key];
}

function restoreEnv() {
  for (const key of envKeys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

afterEach(() => {
  restoreEnv();
});

describe("control paths", () => {
  test("default control.json is under MEDIAX_HOME/agent", () => {
    stashEnv();
    const dir = mkdtempSync(join(tmpdir(), "mediax-home-"));
    process.env.MEDIAX_HOME = dir;
    delete process.env.MEDIAX_CONTROL_CONFIG;
    expect(defaultAgentHome()).toBe(join(dir, "agent"));
    expect(defaultControlConfigPath()).toBe(join(dir, "agent", "control.json"));
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("resolveControlConfig", () => {
  test("reads loopback file config", () => {
    stashEnv();
    const dir = mkdtempSync(join(tmpdir(), "mediax-agent-"));
    const path = join(dir, "control.json");
    writeFileSync(
      path,
      JSON.stringify({
        baseUrl: "http://127.0.0.1:39201",
        token: "secret",
        apiVersion: 1,
      }),
    );
    process.env.MEDIAX_CONTROL_CONFIG = path;
    delete process.env.MEDIAX_CONTROL_URL;
    delete process.env.MEDIAX_CONTROL_TOKEN;

    const resolved = resolveControlConfig();
    expect(resolved.source).toBe("file");
    expect(resolved.config).toEqual({
      baseUrl: "http://127.0.0.1:39201",
      token: "secret",
      apiVersion: 1,
    });
    rmSync(dir, { recursive: true, force: true });
  });

  test("rejects non-loopback baseUrl", () => {
    stashEnv();
    const dir = mkdtempSync(join(tmpdir(), "mediax-agent-"));
    const path = join(dir, "control.json");
    writeFileSync(
      path,
      JSON.stringify({ baseUrl: "http://example.com:1", token: "x" }),
    );
    process.env.MEDIAX_CONTROL_CONFIG = path;
    delete process.env.MEDIAX_CONTROL_URL;
    delete process.env.MEDIAX_CONTROL_TOKEN;

    const resolved = resolveControlConfig();
    expect(resolved.config).toBeNull();
    expect(resolved.parseError).toMatch(/loopback/);
    rmSync(dir, { recursive: true, force: true });
  });

  test("env overrides file", () => {
    stashEnv();
    process.env.MEDIAX_CONTROL_URL = "http://127.0.0.1:9";
    process.env.MEDIAX_CONTROL_TOKEN = "from-env";
    const resolved = resolveControlConfig();
    expect(resolved.source).toBe("env");
    expect(resolved.config?.token).toBe("from-env");
  });
});
