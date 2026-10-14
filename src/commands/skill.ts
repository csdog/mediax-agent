import { defineCommand } from "citty";
import { printJson, printLines } from "../lib/print";
import { defaultSkillSyncDir, readSkillInfo, syncSkill } from "../lib/skill";
import { cliVersion } from "../version";

export const skillCommand = defineCommand({
  meta: {
    name: "skill",
    description: "Show or sync the MediaX Agent Skill packaged in this repo",
  },
  subCommands: {
    show: defineCommand({
      meta: { name: "show", description: "Show skill metadata and paths" },
      args: {
        json: { type: "boolean", description: "JSON output", default: false },
      },
      run({ args }) {
        const info = readSkillInfo();
        const payload = {
          ok: true,
          action: "skill.show",
          version: cliVersion(),
          data: info,
        };
        if (args.json) printJson(payload);
        else
          printLines([
            `Skill   ${info.name} v${info.version}`,
            `Source  ${info.sourceDir}`,
            `Sync to ${info.defaultSyncDir}`,
            info.description ? `About   ${info.description}` : "",
          ].filter(Boolean));
      },
    }),
    sync: defineCommand({
      meta: {
        name: "sync",
        description: "Copy skills/mediax into a local Agent skills directory",
      },
      args: {
        dir: {
          type: "string",
          description: `Target directory (default: ${defaultSkillSyncDir()})`,
        },
        json: { type: "boolean", description: "JSON output", default: false },
      },
      run({ args }) {
        const target = args.dir?.trim() || defaultSkillSyncDir();
        const result = syncSkill(target);
        const info = readSkillInfo();
        const payload = {
          ok: true,
          action: "skill.sync",
          version: cliVersion(),
          data: { ...result, name: info.name, skillVersion: info.version },
        };
        if (args.json) printJson(payload);
        else printLines([`Synced ${info.name} v${info.version}`, `  from ${result.sourceDir}`, `  to   ${result.targetDir}`]);
      },
    }),
  },
});
