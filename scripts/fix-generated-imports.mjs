/**
 * `@openapi-codegen` emits a value import for `*FetcherExtraProps` even though it is
 * only used as a type. Our tsconfig has `verbatimModuleSyntax`, so rewrite it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const file = join(import.meta.dirname, "../src/lib/api/desktopComponents.ts");
const before = readFileSync(file, "utf8");
const after = before.replace(
  /import \{ desktopFetch, DesktopFetcherExtraProps \} from "\.\/desktopFetcher";/,
  `import { desktopFetch } from "./desktopFetcher";\nimport type { DesktopFetcherExtraProps } from "./desktopFetcher";`,
);

if (after === before) {
  console.warn("fix-generated-imports: pattern not found — check desktopComponents.ts");
  process.exitCode = 1;
} else {
  writeFileSync(file, after);
}
