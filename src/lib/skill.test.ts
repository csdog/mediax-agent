import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSkillInfo, syncSkill } from "./skill";

describe("skill", () => {
  test("reads in-repo skill frontmatter", () => {
    const info = readSkillInfo();
    expect(info.name).toBe("mediax");
    expect(info.version).toBe("0.0.1");
    expect(info.sourceDir).toContain("skills/mediax");
  });

  test("syncs skill tree to a temp directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "mediax-skill-"));
    const target = join(dir, "mediax");
    const result = syncSkill(target);
    expect(result.targetDir).toBe(target);
    const again = readSkillInfo();
    expect(again.name).toBe("mediax");
    rmSync(dir, { recursive: true, force: true });
  });
});
