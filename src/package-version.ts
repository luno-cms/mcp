import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPackageRoot } from "./package-root.js";

const VERSION_COMMANDS = new Set(["version", "--version", "-v"]);

export function isVersionCommand(argv: string[]): boolean {
  const cmd = argv[0];
  return typeof cmd === "string" && VERSION_COMMANDS.has(cmd);
}

/** Installed / published package version (not the hosted LUNO API). */
export function readPackageVersion(): string {
  const pkg = JSON.parse(readFileSync(join(getPackageRoot(), "package.json"), "utf8")) as {
    version?: string;
  };
  const version = pkg.version?.trim();
  if (!version) {
    throw new Error("package.json is missing version");
  }
  return version;
}
