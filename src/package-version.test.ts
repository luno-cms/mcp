import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getPackageRoot } from "./package-root.js";
import { isVersionCommand, readPackageVersion } from "./package-version.js";

describe("CLI version (#46)", () => {
  it("reads the same version as package.json", () => {
    const pkg = JSON.parse(readFileSync(join(getPackageRoot(), "package.json"), "utf8")) as {
      version: string;
    };
    expect(readPackageVersion()).toBe(pkg.version);
    expect(readPackageVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("treats --version and version as version commands", () => {
    expect(isVersionCommand(["--version"])).toBe(true);
    expect(isVersionCommand(["version"])).toBe(true);
    expect(isVersionCommand(["-v"])).toBe(true);
    expect(isVersionCommand(["run", "stg"])).toBe(false);
    expect(isVersionCommand([])).toBe(false);
  });
});
