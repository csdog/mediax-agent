import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { cliVersion } from "../version";
import { defaultAgentHome } from "./config";

export const CHECK_INTERVAL_SECONDS = 24 * 60 * 60;
export const DEFAULT_RELEASES_URL =
  "https://api.github.com/repos/csdog/mediax-agent/releases/latest";
export const INSTALL_DOC_URL =
  "https://raw.githubusercontent.com/csdog/mediax-agent/main/skills/install.md";
export const UPDATE_PROMPT = `请根据 ${INSTALL_DOC_URL}，安装 mediax`;

type UpdateCache = {
  site_url: string;
  checked_at: number;
  latest_version: string | null;
};

export function normalizeVersion(raw: string): string | null {
  const trimmed = raw.trim().replace(/^v/i, "");
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(trimmed)) return null;
  return trimmed;
}

/** Semver compare for x.y.z(+prerelease ignored for ordering simplicity of core triple). */
export function newerVersion(latest: string, current: string): boolean {
  const a = normalizeVersion(latest);
  const b = normalizeVersion(current);
  if (!a || !b) return false;
  const pa = a.split("-")[0]!.split(".").map((n) => Number(n));
  const pb = b.split("-")[0]!.split(".").map((n) => Number(n));
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

/** Update-check cache lives under MEDIAX_HOME/agent (next to CLI/Skill). */
export function updateCachePath(): string | null {
  const dir = defaultAgentHome();
  if (!dir) return null;
  return join(dir, "update.json");
}

export function formatUpdateMessage(current: string, latest: string): string {
  return [
    `WARN [Update available] : ${current} → ${latest}.`,
    `Changelog: ${INSTALL_DOC_URL}`,
    "Copy and chat with AI to update:",
    UPDATE_PROMPT,
  ].join("\n");
}

export function parseGithubLatestTag(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const tag = (payload as { tag_name?: unknown }).tag_name;
  if (typeof tag !== "string") return null;
  return normalizeVersion(tag);
}

function readCache(path: string, site: string): UpdateCache | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as UpdateCache;
    if (parsed.site_url !== site) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(path: string, cache: UpdateCache) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(cache, null, 2)}\n`);
  renameSync(temporary, path);
}

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export async function fetchLatestVersion(
  url: string,
  fetchImpl: FetchLike = fetch,
): Promise<string | null> {
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return null;
    const host = parsed.hostname;
    const okHttp =
      parsed.protocol === "https:" ||
      (parsed.protocol === "http:" &&
        (host === "localhost" || host === "127.0.0.1" || host === "[::1]"));
    if (!okHttp) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1000);
    try {
      const response = await fetchImpl(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": `mediax-agent/${cliVersion()}`,
        },
        redirect: "manual",
      });
      if (!response.ok) return null;
      return parseGithubLatestTag(await response.json());
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

export async function refreshUpdateCache(options?: {
  path?: string | null;
  siteUrl?: string;
  now?: number;
  fetchImpl?: FetchLike;
}): Promise<string | null> {
  const site = (options?.siteUrl ?? DEFAULT_RELEASES_URL).replace(/\/+$/, "");
  const path = options?.path === undefined ? updateCachePath() : options.path;
  if (!path) return null;
  const now = options?.now ?? Math.floor(Date.now() / 1000);
  const previous = readCache(path, site);
  if (
    previous &&
    now >= previous.checked_at &&
    now - previous.checked_at < CHECK_INTERVAL_SECONDS
  ) {
    return previous.latest_version;
  }
  const latest =
    (await fetchLatestVersion(site, options?.fetchImpl)) ?? previous?.latest_version ?? null;
  writeCache(path, { site_url: site, checked_at: now, latest_version: latest });
  return readCache(path, site)?.latest_version ?? latest;
}

function shouldSkipArgv(argv: string[]): boolean {
  if (argv.length === 0) return true;
  const meta = new Set(["--help", "-h", "--version", "-v"]);
  return argv.every((arg) => meta.has(arg));
}

/**
 * AngryEcho-style update reminder: print from cache on stderr (TTY only),
 * refresh in the background. Disabled by MEDIAX_NO_UPDATE_CHECK.
 */
export function notifyUpdateAvailable(options?: {
  argv?: string[];
  currentVersion?: string;
  siteUrl?: string;
  path?: string | null;
  stderr?: NodeJS.WritableStream;
  isTTY?: boolean;
  fetchImpl?: FetchLike;
}): void {
  if (process.env.MEDIAX_NO_UPDATE_CHECK != null) return;
  const argv = options?.argv ?? process.argv.slice(2);
  if (shouldSkipArgv(argv)) return;
  const isTTY = options?.isTTY ?? Boolean(process.stderr.isTTY);
  if (!isTTY) return;

  const site = (options?.siteUrl ?? process.env.MEDIAX_UPDATE_URL ?? DEFAULT_RELEASES_URL).replace(
    /\/+$/,
    "",
  );
  const path = options?.path === undefined ? updateCachePath() : options.path;
  if (!path) return;
  const current = options?.currentVersion ?? cliVersion();
  const cached = readCache(path, site)?.latest_version;
  if (cached && newerVersion(cached, current)) {
    const stream = options?.stderr ?? process.stderr;
    stream.write(`${formatUpdateMessage(current, cached)}\n`);
  }
  void refreshUpdateCache({
    path,
    siteUrl: site,
    fetchImpl: options?.fetchImpl,
  }).catch(() => {});
}
