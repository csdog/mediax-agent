import { defineCommand } from "citty";
import { printJson, printLines } from "../lib/print";
import { readSkillInfo, syncSkill } from "../lib/skill";
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
            info.aliasSourceDir ? `Alias   mx → ${info.aliasSyncDir}` : "",
            info.description ? `About   ${info.description}` : "",
          ].filter(Boolean));
      },
    }),
    sync: defineCommand({
      meta: {
        name: "sync",
        description:
          "Refresh ~/.mediax/agent/skills/{mediax,mx} and symlink Agent skill dirs",
      },
      args: {
        dir: {
          type: "string",
          description:
            "Extra Agent skill path to symlink (also links sibling mx/mediax; default ~/.agents/skills/*)",
        },
        json: { type: "boolean", description: "JSON output", default: false },
      },
      run({ args }) {
        const result = syncSkill(args.dir?.trim() || undefined);
        const info = readSkillInfo();
        const payload = {
          ok: true,
          action: "skill.sync",
          version: cliVersion(),
          data: { ...result, name: info.name, skillVersion: info.version },
        };
        if (args.json) printJson(payload);
        else {
          const lines = [
            `Synced ${info.name} v${info.version}`,
            `  from ${result.sourceDir}`,
            `  to   ${result.targetDir}`,
            `  link ${result.agentLinkDir}`,
          ];
          if (result.aliasTargetDir) {
            lines.push(`  alias ${result.aliasTargetDir}`);
            if (result.agentAliasLinkDir) lines.push(`  link ${result.agentAliasLinkDir}`);
          }
          if (result.extraLinkDir) lines.push(`  link ${result.extraLinkDir}`);
          if (result.extraAliasLinkDir) lines.push(`  link ${result.extraAliasLinkDir}`);
          printLines(lines);
        }
      },
    }),
  },
});
