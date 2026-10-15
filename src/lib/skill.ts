import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultAgentHome } from "./config";

export type SkillInfo = {
  name: string;
  version: string;
  sourceDir: string;
  defaultSyncDir: string;
  description: string | null;
  aliasSourceDir: string | null;
  aliasSyncDir: string;
};

function repoRootFromModule(): string {
  // src/lib -> src -> repo root
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function skillsRootCandidates(): string[] {
  return [
    join(dirname(process.execPath), "skills"),
    join(repoRootFromModule(), "skills"),
    join(process.cwd(), "skills"),
  ];
}

export function skillSourceDir(): string {
  for (const root of skillsRootCandidates()) {
    const dir = join(root, "mediax");
    if (existsSync(join(dir, "SKILL.md"))) return dir;
  }
  return join(repoRootFromModule(), "skills", "mediax");
}

/** Short-name Skill source (`skills/mx`), if packaged. */
export function aliasSkillSourceDir(): string | null {
  for (const root of skillsRootCandidates()) {
    const dir = join(root, "mx");
    if (existsSync(join(dir, "SKILL.md"))) return dir;
  }
  return null;
}

/** Installed Skill tree under MEDIAX_HOME/agent. */
export function canonicalSkillDir(): string {
  return join(defaultAgentHome(), "skills", "mediax");
}

export function canonicalAliasSkillDir(): string {
  return join(defaultAgentHome(), "skills", "mx");
}

/** Default sync target = canonical home Skill (not an Agent discovery path). */
export function defaultSkillSyncDir(): string {
  return canonicalSkillDir();
}

function userHome(): string {
  // Prefer env so installers/tests can isolate with HOME=… (Bun/Node homedir may ignore it).
  return (
    process.env.HOME?.trim() ||
    process.env.USERPROFILE?.trim() ||
    homedir()
  );
}

/** Default Agent discovery symlink for the full Skill. */
export function defaultAgentSkillLinkDir(): string {
  return join(userHome(), ".agents", "skills", "mediax");
}

export function defaultAgentAliasSkillLinkDir(): string {
  return join(userHome(), ".agents", "skills", "mx");
}

function samePath(a: string, b: string): boolean {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return a === b;
  }
}

/** Ensure `linkPath` is a symlink/junction to `canonicalDir`. */
export function ensureSkillLink(linkPath: string, canonicalDir: string): void {
  mkdirSync(canonicalDir, { recursive: true });
  mkdirSync(dirname(linkPath), { recursive: true });
  if (samePath(linkPath, canonicalDir)) return;

  if (existsSync(linkPath) || existsSync(linkPath.replace(/[/\\]$/, ""))) {
    try {
      const st = lstatSync(linkPath);
      if (st.isSymbolicLink()) {
        if (samePath(linkPath, canonicalDir)) return;
        rmSync(linkPath, { force: true });
      } else {
        rmSync(linkPath, { recursive: true, force: true });
      }
    } catch {
      rmSync(linkPath, { recursive: true, force: true });
    }
  }

  const type = process.platform === "win32" ? "junction" : undefined;
  symlinkSync(canonicalDir, linkPath, type);
}

/** If link is `…/mediax`, return sibling `…/mx` (and vice versa). */
export function siblingSkillLink(linkPath: string): string | null {
  const normalized = linkPath.replace(/[/\\]+$/, "");
  if (/[/\\]mediax$/.test(normalized)) return join(dirname(normalized), "mx");
  if (/[/\\]mx$/.test(normalized)) return join(dirname(normalized), "mediax");
  return null;
}

function parseFrontmatter(markdown: string): { name?: string; version?: string; description?: string } {
  if (!markdown.startsWith("---\n")) return {};
  const end = markdown.indexOf("\n---\n", 4);
  if (end < 0) return {};
  const block = markdown.slice(4, end);
  const out: { name?: string; version?: string; description?: string } = {};
  for (const line of block.split("\n")) {
    const m = /^(\w+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    let value = m[2]?.trim() ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    )
      value = value.slice(1, -1);
    if (key === "name" || key === "version" || key === "description") out[key] = value;
  }
  return out;
}

function copySkillTree(sourceDir: string, targetDir: string) {
  mkdirSync(dirname(targetDir), { recursive: true });
  rmSync(targetDir, { recursive: true, force: true });
  cpSync(sourceDir, targetDir, { recursive: true });
}

export function readSkillInfo(): SkillInfo {
  const sourceDir = skillSourceDir();
  const skillMd = join(sourceDir, "SKILL.md");
  if (!existsSync(skillMd)) {
    throw new Error(`Skill not found at ${skillMd}`);
  }
  const fm = parseFrontmatter(readFileSync(skillMd, "utf8"));
  return {
    name: fm.name ?? "mediax",
    version: fm.version ?? "0.0.0",
    sourceDir,
    defaultSyncDir: defaultSkillSyncDir(),
    description: fm.description ?? null,
    aliasSourceDir: aliasSkillSourceDir(),
    aliasSyncDir: canonicalAliasSkillDir(),
  };
}

export type SyncSkillResult = {
  sourceDir: string;
  targetDir: string;
  aliasSourceDir: string | null;
  aliasTargetDir: string | null;
  agentLinkDir: string;
  agentAliasLinkDir: string | null;
  extraLinkDir: string | null;
  extraAliasLinkDir: string | null;
};

/**
 * Refresh `$MEDIAX_HOME/agent/skills/{mediax,mx}` from packaged sources, then
 * ensure Agent discovery symlinks (and optional `--dir` links).
 */
export function syncSkill(linkDir?: string): SyncSkillResult {
  const sourceDir = skillSourceDir();
  if (!existsSync(join(sourceDir, "SKILL.md"))) {
    throw new Error(`Skill source missing: ${sourceDir}`);
  }
  const targetDir = canonicalSkillDir();
  copySkillTree(sourceDir, targetDir);

  const aliasSource = aliasSkillSourceDir();
  let aliasTargetDir: string | null = null;
  if (aliasSource) {
    aliasTargetDir = canonicalAliasSkillDir();
    copySkillTree(aliasSource, aliasTargetDir);
  }

  const agentLinkDir = defaultAgentSkillLinkDir();
  ensureSkillLink(agentLinkDir, targetDir);

  let agentAliasLinkDir: string | null = null;
  if (aliasTargetDir) {
    agentAliasLinkDir = defaultAgentAliasSkillLinkDir();
    ensureSkillLink(agentAliasLinkDir, aliasTargetDir);
  }

  let extraLinkDir: string | null = null;
  let extraAliasLinkDir: string | null = null;
  if (linkDir?.trim()) {
    const resolved = linkDir.trim();
    if (!samePath(resolved, targetDir) && !samePath(resolved, agentLinkDir)) {
      // Allow `--dir …/mx` or `--dir …/mediax`
      if (/[/\\]mx$/.test(resolved.replace(/[/\\]+$/, "")) && aliasTargetDir) {
        ensureSkillLink(resolved, aliasTargetDir);
        extraAliasLinkDir = resolved;
        const mediaxSibling = siblingSkillLink(resolved);
        if (mediaxSibling) {
          ensureSkillLink(mediaxSibling, targetDir);
          extraLinkDir = mediaxSibling;
        }
      } else {
        ensureSkillLink(resolved, targetDir);
        extraLinkDir = resolved;
        if (aliasTargetDir) {
          const mxSibling = siblingSkillLink(resolved);
          if (mxSibling) {
            ensureSkillLink(mxSibling, aliasTargetDir);
            extraAliasLinkDir = mxSibling;
          }
        }
      }
    }
  }

  return {
    sourceDir,
    targetDir,
    aliasSourceDir: aliasSource,
    aliasTargetDir,
    agentLinkDir,
    agentAliasLinkDir,
    extraLinkDir,
    extraAliasLinkDir,
  };
}
