import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  bootstrapEnvFiles,
  hasRealKey,
  migrateLegacyCursorEnv,
  parseEnvFile,
  resolveMcpProjectRoot,
  setKey,
  statusLines,
  switchEnv,
  applyEnvToProcess,
  envFilePath,
  agentsLunoDir,
} from "./env-files.js";

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length) {
    const d = dirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

function tempProject(): string {
  const d = mkdtempSync(join(tmpdir(), "luno-mcp-env-"));
  dirs.push(d);
  return d;
}

it("resolveMcpProjectRoot prefers LUNO_PROJECT_ROOT", () => {
  expect(resolveMcpProjectRoot("/tmp/cwd", { LUNO_PROJECT_ROOT: "/abs/site" })).toBe("/abs/site");
  expect(resolveMcpProjectRoot("/tmp/cwd", {})).toBe("/tmp/cwd");
});

it("resolveMcpProjectRoot strips surrounding quotes (0.2.15 compat)", () => {
  expect(resolveMcpProjectRoot("/tmp/cwd", { LUNO_PROJECT_ROOT: '"/abs/site"' })).toBe("/abs/site");
  expect(resolveMcpProjectRoot("/tmp/cwd", { LUNO_PROJECT_ROOT: "'/abs/site'" })).toBe("/abs/site");
});

describe("parseEnvFile", () => {
  it("parses key=value and ignores comments", () => {
    expect(
      parseEnvFile("# x\nLUNO_API_URL=http://a/admin\nLUNO_AGENT_KEY=sk-agent-abc\n")
    ).toEqual({
      LUNO_API_URL: "http://a/admin",
      LUNO_AGENT_KEY: "sk-agent-abc",
    });
  });
});

describe("project env lifecycle", () => {
  it("bootstraps under .agents/luno and set-key / switch", () => {
    const root = tempProject();
    bootstrapEnvFiles(root);
    expect(existsSync(join(agentsLunoDir(root), "dev.env"))).toBe(true);
    expect(hasRealKey(root, "stg")).toBe(false);

    setKey(root, "stg", "sk-agent-test-key");
    expect(hasRealKey(root, "stg")).toBe(true);

    switchEnv(root, "stg");
    const shared = readFileSync(join(agentsLunoDir(root), "env"), "utf8");
    expect(shared).toContain("sk-agent-test-key");
    expect(existsSync(join(root, ".cursor", "luno.env"))).toBe(true);
    expect(statusLines(root).join("\n")).toContain("active: stg");
    expect(statusLines(root).join("\n")).toContain(".agents/luno/");
    expect(statusLines(root).join("\n")).toContain("luno-stg ok");
    expect(statusLines(root).join("\n")).toMatch(/luno-dev fail/);
  });

  it("applyEnvToProcess loads into process.env", () => {
    const root = tempProject();
    bootstrapEnvFiles(root);
    setKey(root, "dev", "sk-agent-dev-1");
    applyEnvToProcess(root, "dev");
    expect(process.env.LUNO_AGENT_KEY).toBe("sk-agent-dev-1");
    expect(process.env.LUNO_API_URL).toBe("http://127.0.0.1:8787/admin");
  });

  it("rejects switch without key", () => {
    const root = tempProject();
    bootstrapEnvFiles(root);
    expect(() => switchEnv(root, "prod")).toThrow(/key missing/);
  });

  it("migrates legacy .cursor/luno.*.env into .agents/luno", () => {
    const root = tempProject();
    mkdirSync(join(root, ".cursor"), { recursive: true });
    writeFileSync(
      join(root, ".cursor", "luno.stg.env"),
      "LUNO_API_URL=https://stg-api.luno.rest/admin\nLUNO_AGENT_KEY=sk-agent-legacy\n",
      "utf8"
    );
    const migrated = migrateLegacyCursorEnv(root);
    expect(migrated.some((p) => p.includes(`${join("luno", "stg.env")}`) || p.endsWith("stg.env"))).toBe(
      true
    );
    expect(readFileSync(envFilePath(root, "stg"), "utf8")).toContain("sk-agent-legacy");
    expect(hasRealKey(root, "stg")).toBe(true);
  });
});
