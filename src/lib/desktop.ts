import { requireControlConfig } from "./config";
import { healthGet } from "./api/desktopComponents";

export type DesktopProbe = {
  ok: boolean;
  url: string;
  status: number | null;
  latencyMs: number | null;
  error: string | null;
  bodyPreview: string | null;
};

/** Probe desktop control health via generated OpenAPI client. Offline / missing API → not ok. */
export async function probeDesktop(timeoutMs = 1500): Promise<DesktopProbe> {
  const url = `${requireControlConfig().baseUrl}/health`;
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = await healthGet(controller.signal);
    return {
      ok: body.ok === true,
      url,
      status: 200,
      latencyMs: Math.round(performance.now() - started),
      error: body.ok === true ? null : "health.ok is not true",
      bodyPreview: JSON.stringify(body).slice(0, 200),
    };
  } catch (error) {
    const message = formatProbeError(error, timeoutMs);
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof (error as { status: unknown }).status === "number"
        ? (error as { status: number }).status
        : null;
    const payload =
      typeof error === "object" && error !== null && "payload" in error
        ? (error as { payload: unknown }).payload
        : null;
    return {
      ok: false,
      url,
      status,
      latencyMs: Math.round(performance.now() - started),
      error: message,
      bodyPreview:
        payload === null || payload === undefined
          ? null
          : typeof payload === "string"
            ? payload.slice(0, 200)
            : JSON.stringify(payload).slice(0, 200),
    };
  } finally {
    clearTimeout(timer);
  }
}

function formatProbeError(error: unknown, timeoutMs: number): string {
  if (error instanceof Error) {
    return error.name === "AbortError" ? `timeout after ${timeoutMs}ms` : error.message;
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (status === "unknown") {
      const payload = (error as { payload?: unknown }).payload;
      return typeof payload === "string" ? payload : "unknown error";
    }
    if (typeof status === "number") return `HTTP ${status}`;
  }
  return String(error);
}
