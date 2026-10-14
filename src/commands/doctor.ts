import { existsSync } from "node:fs";
import { resolveControlConfig } from "../lib/config";
import { probeDesktop } from "../lib/desktop";
import { cliVersion } from "../version";

export type DoctorReport = {
  ok: boolean;
  action: "doctor";
  version: string;
  data: {
    cli: {
      version: string;
      runtime: string;
      platform: string;
      arch: string;
    };
    config: {
      dir: string;
      dirPresent: boolean;
      path: string;
      filePresent: boolean;
      source: "env" | "file" | "none";
      parseError: string | null;
      baseUrl: string | null;
      tokenPresent: boolean;
      apiVersion: number | null;
    };
    desktop: {
      configured: boolean;
      reachable: boolean;
      probe: Awaited<ReturnType<typeof probeDesktop>> | null;
      note: string;
    };
    readiness: {
      canCallControlApi: boolean;
      blockers: string[];
    };
  };
};

export async function runDoctor(): Promise<DoctorReport> {
  const resolved = resolveControlConfig();
  const blockers: string[] = [];

  if (resolved.parseError) blockers.push(resolved.parseError);
  if (!resolved.config) {
    blockers.push(
      "No control config: start MediaX desktop (when Agent API ships) or set MEDIAX_CONTROL_URL + MEDIAX_CONTROL_TOKEN",
    );
  }

  let probe: Awaited<ReturnType<typeof probeDesktop>> | null = null;
  if (resolved.config) {
    probe = await probeDesktop(resolved.config);
    if (!probe.ok) {
      blockers.push(
        probe.error
          ? `Desktop control API unreachable: ${probe.error}`
          : "Desktop control API unreachable",
      );
    }
  }

  const canCall = Boolean(resolved.config && probe?.ok);
  const note = !resolved.config
    ? "Desktop has not written ~/.mediax/control.json yet (control API not implemented or not enabled)."
    : probe?.ok
      ? "Desktop control API responded OK."
      : "Config present but /health failed — is MediaX running with Agent control enabled?";

  return {
    ok: canCall && blockers.length === 0,
    action: "doctor",
    version: cliVersion(),
    data: {
      cli: {
        version: cliVersion(),
        runtime: typeof Bun !== "undefined" ? `bun ${Bun.version}` : `node ${process.version}`,
        platform: process.platform,
        arch: process.arch,
      },
      config: {
        dir: resolved.configDir,
        dirPresent: existsSync(resolved.configDir),
        path: resolved.configPath,
        filePresent: resolved.filePresent,
        source: resolved.source,
        parseError: resolved.parseError,
        baseUrl: resolved.config?.baseUrl ?? null,
        tokenPresent: Boolean(resolved.config?.token),
        apiVersion: resolved.config?.apiVersion ?? null,
      },
      desktop: {
        configured: Boolean(resolved.config),
        reachable: Boolean(probe?.ok),
        probe,
        note,
      },
      readiness: {
        canCallControlApi: canCall,
        blockers,
      },
    },
  };
}

export function formatDoctorHuman(report: DoctorReport): string[] {
  const { cli, config, desktop, readiness } = report.data;
  const lines = [
    `MediaX Agent doctor  v${report.version}`,
    "",
    `CLI     ${cli.runtime} · ${cli.platform}/${cli.arch}`,
    `Config  ${config.path}`,
    `        present=${config.filePresent} source=${config.source}` +
      (config.baseUrl ? ` baseUrl=${config.baseUrl}` : ""),
    `Desktop configured=${desktop.configured} reachable=${desktop.reachable}`,
    `        ${desktop.note}`,
  ];
  if (desktop.probe) {
    lines.push(
      `Probe   ${desktop.probe.url} status=${desktop.probe.status ?? "-"} latencyMs=${desktop.probe.latencyMs ?? "-"}` +
        (desktop.probe.error ? ` error=${desktop.probe.error}` : ""),
    );
  }
  lines.push("");
  if (readiness.canCallControlApi) lines.push("OK — control API reachable.");
  else {
    lines.push("Not ready:");
    for (const b of readiness.blockers) lines.push(`  - ${b}`);
  }
  return lines;
}
