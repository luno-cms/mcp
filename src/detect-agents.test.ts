import { mkdirSync, mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  detectInstalledAgents,
  noAgentInstallHint,
  selectDetectedAgent,
} from "./detect-agents.js";

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length) {
    const d = dirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "luno-detect-"));
  dirs.push(d);
  return d;
}

function fakeBin(dir: string, name: string): void {
  const path = join(dir, name);
  writeFileSync(path, "#!/bin/sh\n", { mode: 0o755 });
  chmodSync(path, 0o755);
}

describe("detectInstalledAgents", () => {
  it("finds claude and codex on PATH, not cursor", () => {
    const bin = tempDir();
    fakeBin(bin, "claude");
    fakeBin(bin, "codex");
    expect(
      detectInstalledAgents({
        pathEnv: bin,
        pathDelimiter: ":",
        platform: "linux",
        homedir: tempDir(),
      })
    ).toEqual(["claude", "codex"]);
  });

  it("treats Cursor.app as installed even without a cursor binary", () => {
    const home = tempDir();
    const apps = join(home, "Applications");
    mkdirSync(join(apps, "Cursor.app"), { recursive: true });
    expect(
      detectInstalledAgents({
        pathEnv: tempDir(),
        pathDelimiter: ":",
        platform: "darwin",
        homedir: home,
      })
    ).toEqual(["cursor"]);
  });

  it("returns empty when nothing is present", () => {
    expect(
      detectInstalledAgents({
        pathEnv: tempDir(),
        pathDelimiter: ":",
        platform: "linux",
        homedir: tempDir(),
      })
    ).toEqual([]);
  });
});

describe("selectDetectedAgent", () => {
  it("maps 1 to the first detected agent", () => {
    expect(selectDetectedAgent("", ["cursor", "codex"])).toBe("cursor");
    expect(selectDetectedAgent("1", ["cursor", "codex"])).toBe("cursor");
    expect(selectDetectedAgent("2", ["cursor", "codex"])).toBe("codex");
    expect(selectDetectedAgent("cursor", ["cursor", "codex"])).toBe("cursor");
  });

  it("rejects a choice that was not detected", () => {
    expect(() => selectDetectedAgent("3", ["cursor"])).toThrow(/Unknown choice/);
    expect(() => selectDetectedAgent("claude", ["cursor"])).toThrow(/Unknown choice/);
  });
});

describe("noAgentInstallHint", () => {
  it("names one agent to install", () => {
    expect(noAgentInstallHint()).toMatch(/Claude Code/);
    expect(noAgentInstallHint()).toMatch(/npx @luno-cms\/mcp setup/);
  });
});
