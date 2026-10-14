import { generateFetchers, generateSchemaTypes } from "@openapi-codegen/typescript";
import { defineConfig } from "@openapi-codegen/cli";

/**
 * Generate typed client from MediaX desktop OpenAPI.
 *
 * Default: checked-in fixture `openapi/control.openapi.json` (desktop API not shipped yet).
 * Live desktop (Hono typically serves JSON at `/doc`):
 *   MEDIAX_OPENAPI_URL=http://127.0.0.1:<port>/doc bun run generate:api
 */
const from = process.env.MEDIAX_OPENAPI_URL?.trim()
  ? { source: "url" as const, url: process.env.MEDIAX_OPENAPI_URL.trim() }
  : { source: "file" as const, relativePath: "./openapi/control.openapi.json" };

export default defineConfig({
  desktop: {
    from,
    outputDir: "src/lib/api",
    to: async (context) => {
      normalizeOpenApiForCodegen(context.openAPIDocument);
      const filenamePrefix = "desktop";
      const { schemasFiles } = await generateSchemaTypes(context, {
        filenamePrefix,
        useEnums: true,
      });
      await generateFetchers(context, {
        filenamePrefix,
        schemasFiles,
      });
    },
  },
});

/**
 * Some emitters (e.g. OAS 3.1 `type: [T, "null"]`) are only partially understood by
 * `@openapi-codegen` and otherwise emit `void`. Normalize to OAS 3.0 nullable.
 */
function normalizeOpenApiForCodegen(document: Record<string, unknown>) {
  rewriteNullableUnions(document);
}

function rewriteNullableUnions(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(rewriteNullableUnions);
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  const node = value as Record<string, unknown>;
  const types = node.type;
  if (Array.isArray(types)) {
    const nonNull = types.filter((item) => item !== "null");
    if (types.includes("null") && nonNull.length === 1 && typeof nonNull[0] === "string") {
      node.type = nonNull[0];
      node.nullable = true;
    }
  }
  for (const child of Object.values(node)) {
    rewriteNullableUnions(child);
  }
}
