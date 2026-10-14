import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Written by MediaX desktop when the control API is enabled. */
export type ControlConfig = {
  baseUrl: string;
  token: string;
  apiVersion?: number;
};

export type ResolvedControl = {
  configPath: string;
  configDir: string;
  source: "env" | "file" | "none";
  config: ControlConfig | null;
  filePresent: boolean;
  parseError: string | null;
};

export function defaultConfigDir(): string {
  return process.env.MEDIAX_HOME?.trim() || join(homedir(), ".mediax");
}

export function defaultControlConfigPath(): string {
  return process.env.MEDIAX_CONTROL_CONFIG?.trim() || join(defaultConfigDir(), "control.json");
}

function fromEnv(): ControlConfig | null {
  const baseUrl = process.env.MEDIAX_CONTROL_URL?.trim();
  const token = process.env.MEDIAX_CONTROL_TOKEN?.trim();
  if (!baseUrl && !token) return null;
  if (!baseUrl || !token) {
    throw new Error("MEDIAX_CONTROL_URL and MEDIAX_CONTROL_TOKEN must be set together");
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), token, apiVersion: 1 };
}

function readFileConfig(path: string): { config: ControlConfig | null; parseError: string | null } {
  if (!existsSync(path)) return { config: null, parseError: null };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<ControlConfig>;
    if (typeof raw.baseUrl !== "string" || !raw.baseUrl.trim())
      return { config: null, parseError: "control.json missing baseUrl" };
    if (typeof raw.token !== "string" || !raw.token.trim())
      return { config: null, parseError: "control.json missing token" };
    let baseUrl = raw.baseUrl.trim().replace(/\/$/, "");
    try {
      const u = new URL(baseUrl);
      if (u.hostname !== "127.0.0.1" && u.hostname !== "localhost")
        return { config: null, parseError: "baseUrl must be loopback (127.0.0.1 or localhost)" };
    } catch {
      return { config: null, parseError: "baseUrl is not a valid URL" };
    }
    return {
      config: {
        baseUrl,
        token: raw.token.trim(),
        apiVersion: typeof raw.apiVersion === "number" ? raw.apiVersion : 1,
      },
      parseError: null,
    };
  } catch (error) {
    return {
      config: null,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

export function resolveControlConfig(): ResolvedControl {
  const configPath = defaultControlConfigPath();
  const configDir = defaultConfigDir();
  try {
    const envConfig = fromEnv();
    if (envConfig) {
      return {
        configPath,
        configDir,
        source: "env",
        config: envConfig,
        filePresent: existsSync(configPath),
        parseError: null,
      };
    }
  } catch (error) {
    return {
      configPath,
      configDir,
      source: "none",
      config: null,
      filePresent: existsSync(configPath),
      parseError: error instanceof Error ? error.message : String(error),
    };
  }

  const file = readFileConfig(configPath);
  if (file.config) {
    return {
      configPath,
      configDir,
      source: "file",
      config: file.config,
      filePresent: true,
      parseError: null,
    };
  }
  return {
    configPath,
    configDir,
    source: "none",
    config: null,
    filePresent: existsSync(configPath),
    parseError: file.parseError,
  };
}
