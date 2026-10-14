/**
 * `@openapi-codegen` → `tsutils` calls `ts.ScriptTarget.Latest`, which TypeScript 7
 * no longer exposes on the CJS shim. Force resolution to the nested 4.8.2 that
 * `@openapi-codegen/typescript` already depends on.
 */
const path = require("node:path");
const Module = require("node:module");

const ts48 = path.resolve(
  __dirname,
  "../node_modules/@openapi-codegen/typescript/node_modules/typescript",
);

const original = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "typescript") {
    return original.call(this, ts48, parent, isMain, options);
  }
  return original.call(this, request, parent, isMain, options);
};
