import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, lstatSync, mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cliVersion } from "../version";
import {
  canonicalSkillDir,
  defaultAgentSkillLinkDir,
  defaultSkillSyncDir,
  ensureSkillLink,
  readSkillInfo,
  syncSkill,
} from "./skill";

const dirs: string[] = [];
const savedMediaxHome = process.env.MEDIAX_HOME;
const savedHome = process.env.HOME;

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  if (savedMediaxHome === undefined) delete process.env.MEDIAX_HOME;
  else process.env.MEDIAX_HOME = savedMediaxHome;
  if (savedHome === undefined) delete process.env.HOME;
  else process.env.HOME = savedHome;
});

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "mediax-skill-"));
  dirs.push(dir);
  return dir;
}

describe("skill", () => {
  test("reads in-repo skill frontmatter", () => {
    const info = readSkillInfo();
    expect(info.name).toBe("mediax");
    expect(info.version).toBe(cliVersion());
    expect(info.sourceDir).toContain("skills/mediax");
  });

  test("default sync dir is MEDIAX_HOME/skills/mediax", () => {
    const home = tempDir();
    process.env.MEDIAX_HOME = home;
    expect(defaultSkillSyncDir()).toBe(join(home, "skills", "mediax"));
    expect(canonicalSkillDir()).toBe(join(home, "skills", "mediax"));
  });

  test("syncs to canonical home and links agent + extra dirs", () => {
    const root = tempDir();
    process.env.MEDIAX_HOME = join(root, ".mediax");
    process.env.HOME = root;
    const extra = join(root, ".cursor", "skills", "mediax");

    const result = syncSkill(extra);
    expect(result.targetDir).toBe(join(root, ".mediax", "skills", "mediax"));
    expect(existsSync(join(result.targetDir, "SKILL.md"))).toBe(true);
    expect(result.aliasTargetDir).toBe(join(root, ".mediax", "skills", "mx"));
    expect(existsSync(join(result.aliasTargetDir!, "SKILL.md"))).toBe(true);

    const agentLink = defaultAgentSkillLinkDir();
    expect(agentLink).toBe(join(root, ".agents", "skills", "mediax"));
    expect(lstatSync(agentLink).isSymbolicLink()).toBe(true);
    expect(realpathSync(agentLink)).toBe(realpathSync(result.targetDir));
    expect(lstatSync(result.agentAliasLinkDir!).isSymbolicLink()).toBe(true);
    expect(realpathSync(result.agentAliasLinkDir!)).toBe(realpathSync(result.aliasTargetDir!));

    expect(result.extraLinkDir).toBe(extra);
    expect(lstatSync(extra).isSymbolicLink()).toBe(true);
    expect(realpathSync(extra)).toBe(realpathSync(result.targetDir));
    expect(result.extraAliasLinkDir).toBe(join(root, ".cursor", "skills", "mx"));
    expect(lstatSync(result.extraAliasLinkDir!).isSymbolicLink()).toBe(true);
  });

  test("readSkillInfo exposes mx alias source", () => {
    const info = readSkillInfo();
    expect(info.aliasSourceDir).toContain("skills/mx");
    expect(info.aliasSyncDir).toContain("skills/mx");
  });

  test("ensureSkillLink replaces a copied directory with a symlink", () => {
    const root = tempDir();
    const canonical = join(root, "canonical");
    const link = join(root, "agents", "mediax");
    mkdirSync(canonical, { recursive: true });
    writeFileSync(join(canonical, "SKILL.md"), "---\nname: mediax\n---\n");
    mkdirSync(link, { recursive: true });
    writeFileSync(join(link, "SKILL.md"), "old copy");

    ensureSkillLink(link, canonical);
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(realpathSync(link)).toBe(realpathSync(canonical));
  });
});
