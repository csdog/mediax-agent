#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { formatDoctorHuman, runDoctor } from "./commands/doctor";
import { accountsCommand, publishCommand, tasksCommand, calendarCommand } from "./commands/control";
import { skillCommand } from "./commands/skill";
import { printJson, printLines } from "./lib/print";
import { notifyUpdateAvailable } from "./lib/update";
import { cliVersion } from "./version";

notifyUpdateAvailable();

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
    name: "mediax-cli",
    version: cliVersion(),
    description: "MediaX Agent CLI — local desktop publishing and scheduling",
  },
  subCommands: {
    doctor,
    accounts: accountsCommand,
    publish: publishCommand,
    tasks: tasksCommand,
    calendar: calendarCommand,
    skill: skillCommand,
  },
});

await runMain(main);
