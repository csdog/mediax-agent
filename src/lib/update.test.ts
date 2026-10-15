import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CHECK_INTERVAL_SECONDS,
  formatUpdateMessage,
  newerVersion,
  normalizeVersion,
  notifyUpdateAvailable,
  parseGithubLatestTag,
  refreshUpdateCache,
  UPDATE_PROMPT,
} from "./update";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  delete process.env.MEDIAX_NO_UPDATE_CHECK;
  delete process.env.MEDIAX_UPDATE_URL;
});

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "mediax-update-"));
  dirs.push(dir);
  return dir;
}

describe("normalizeVersion / newerVersion", () => {
  test("strips v prefix", () => {
    expect(normalizeVersion("v1.2.3")).toBe("1.2.3");
    expect(normalizeVersion("1.2.3")).toBe("1.2.3");
    expect(normalizeVersion("nope")).toBeNull();
  });

  test("compares core triples", () => {
    expect(newerVersion("0.0.5", "0.0.4")).toBe(true);
    expect(newerVersion("0.0.4", "0.0.4")).toBe(false);
    expect(newerVersion("0.0.3", "0.0.4")).toBe(false);
    expect(newerVersion("v1.0.0", "0.9.9")).toBe(true);
  });
});

describe("parseGithubLatestTag", () => {
  test("reads tag_name", () => {
    expect(parseGithubLatestTag({ tag_name: "v0.1.0" })).toBe("0.1.0");
    expect(parseGithubLatestTag({ tag_name: 1 })).toBeNull();
  });
});

describe("formatUpdateMessage", () => {
  test("includes AI one-liner", () => {
    const text = formatUpdateMessage("0.0.4", "0.0.5");
    expect(text).toContain("0.0.4 → 0.0.5");
    expect(text).toContain(UPDATE_PROMPT);
  });
});

describe("refreshUpdateCache", () => {
  test("caches and respects interval", async () => {
    const dir = tempDir();
    const path = join(dir, "update.json");
    const site = "https://example.test/releases/latest";
    let hits = 0;
    const fetchImpl = async () => {
      hits += 1;
      return new Response(JSON.stringify({ tag_name: hits === 1 ? "v99.0.0" : "v100.0.0" }), {
        status: 200,
      });
    };

    expect(
      await refreshUpdateCache({ path, siteUrl: site, now: 100, fetchImpl }),
    ).toBe("99.0.0");
    expect(hits).toBe(1);
    expect(
      await refreshUpdateCache({ path, siteUrl: site, now: 101, fetchImpl }),
    ).toBe("99.0.0");
    expect(hits).toBe(1);
    expect(
      await refreshUpdateCache({
        path,
        siteUrl: site,
        now: 100 + CHECK_INTERVAL_SECONDS,
        fetchImpl,
      }),
    ).toBe("100.0.0");
    expect(hits).toBe(2);
  });
});

describe("notifyUpdateAvailable", () => {
  test("prints from cache on TTY and skips help argv", async () => {
    const dir = tempDir();
    const path = join(dir, "update.json");
    const site = "https://example.test/releases/latest";
    writeFileSync(
      path,
      JSON.stringify({ site_url: site, checked_at: 0, latest_version: "99.0.0" }),
    );
    const chunks: string[] = [];
    const stderr = { write: (s: string) => (chunks.push(s), true) } as NodeJS.WritableStream;

    notifyUpdateAvailable({
      argv: ["--help"],
      currentVersion: "0.0.1",
      siteUrl: site,
      path,
      stderr,
      isTTY: true,
      fetchImpl: async () => new Response("{}", { status: 404 }),
    });
    expect(chunks.join("")).toBe("");

    notifyUpdateAvailable({
      argv: ["doctor"],
      currentVersion: "0.0.1",
      siteUrl: site,
      path,
      stderr,
      isTTY: true,
      fetchImpl: async () => new Response("{}", { status: 404 }),
    });
    expect(chunks.join("")).toContain("99.0.0");

    process.env.MEDIAX_NO_UPDATE_CHECK = "1";
    chunks.length = 0;
    notifyUpdateAvailable({
      argv: ["doctor"],
      currentVersion: "0.0.1",
      siteUrl: site,
      path,
      stderr,
      isTTY: true,
    });
    expect(chunks.join("")).toBe("");
  });

  test("skips when not a TTY", () => {
    const dir = tempDir();
    const path = join(dir, "update.json");
    const site = "https://example.test/releases/latest";
    writeFileSync(
      path,
      JSON.stringify({ site_url: site, checked_at: 0, latest_version: "99.0.0" }),
    );
    const chunks: string[] = [];
    const stderr = { write: (s: string) => (chunks.push(s), true) } as NodeJS.WritableStream;
    notifyUpdateAvailable({
      argv: ["doctor"],
      currentVersion: "0.0.1",
      siteUrl: site,
      path,
      stderr,
      isTTY: false,
    });
    expect(chunks.join("")).toBe("");
    expect(readFileSync(path, "utf8")).toContain("99.0.0");
  });
});
