#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { formatDoctorHuman, runDoctor } from "./commands/doctor";
import { skillCommand } from "./commands/skill";
import { printJson, printLines } from "./lib/print";
import { cliVersion } from "./version";

const doctor = defineCommand({
  meta: {
    name: "doctor",
    description: "Check CLI environment and MediaX desktop control API connectivity",
  },
  args: {
    json: {
      type: "boolean",
      description: "Print machine-readable JSON (default for agents)",
      default: false,
    },
  },
  async run({ args }) {
    const report = await runDoctor();
    if (args.json) printJson(report);
    else printLines(formatDoctorHuman(report));
    process.exitCode = report.ok ? 0 : 1;
  },
});

const main = defineCommand({
  meta: {
    name: "mediax",
    version: cliVersion(),
    description: "MediaX Agent CLI — local desktop control (publish/schedule later)",
  },
  subCommands: {
    doctor,
    skill: skillCommand,
  },
});

await runMain(main);
