import packageJson from "../package.json" with { type: "json" };

export function cliVersion(): string {
  return packageJson.version ?? "0.0.0";
}
