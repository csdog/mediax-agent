import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type SkillInfo = {
  name: string;
  version: string;
  sourceDir: string;
  defaultSyncDir: string;
  description: string | null;
};

function repoRootFromModule(): string {
  // src/lib -> src -> repo root
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

export function skillSourceDir(): string {
  const candidates = [
    join(dirname(process.execPath), "skills", "mediax"),
    join(repoRootFromModule(), "skills", "mediax"),
    join(process.cwd(), "skills", "mediax"),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "SKILL.md"))) return dir;
  }
  return join(repoRootFromModule(), "skills", "mediax");
}

export function defaultSkillSyncDir(): string {
  return join(homedir(), ".agents", "skills", "mediax");
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
  };
}

export function syncSkill(targetDir = defaultSkillSyncDir()): { sourceDir: string; targetDir: string } {
  const sourceDir = skillSourceDir();
  if (!existsSync(join(sourceDir, "SKILL.md"))) {
    throw new Error(`Skill source missing: ${sourceDir}`);
  }
  mkdirSync(dirname(targetDir), { recursive: true });
  rmSync(targetDir, { recursive: true, force: true });
  cpSync(sourceDir, targetDir, { recursive: true });
  return { sourceDir, targetDir };
}
