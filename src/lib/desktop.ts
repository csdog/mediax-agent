import type { ControlConfig } from "./config";

export type DesktopProbe = {
  ok: boolean;
  url: string;
  status: number | null;
  latencyMs: number | null;
  error: string | null;
  bodyPreview: string | null;
};

/** Probe desktop control health. Desktop API may not exist yet — treat connection errors as offline. */
export async function probeDesktop(config: ControlConfig, timeoutMs = 1500): Promise<DesktopProbe> {
  const url = `${config.baseUrl}/health`;
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      ok: response.ok,
      url,
      status: response.status,
      latencyMs: Math.round(performance.now() - started),
      error: response.ok ? null : `HTTP ${response.status}`,
      bodyPreview: text.slice(0, 200) || null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? `timeout after ${timeoutMs}ms`
          : error.message
        : String(error);
    return {
      ok: false,
      url,
      status: null,
      latencyMs: Math.round(performance.now() - started),
      error: message,
      bodyPreview: null,
    };
  } finally {
    clearTimeout(timer);
  }
}
