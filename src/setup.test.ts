import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { codexMcpAddCommands, nextSteps, writeAgentConfig } from "./agent-configs.js";
import { bootstrapEnvFiles } from "./env-files.js";

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length) {
    const d = dirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

function tempProject(): string {
  const d = mkdtempSync(join(tmpdir(), "luno-mcp-setup-"));
  dirs.push(d);
  return d;
}

describe("writeAgentConfig", () => {
  it("writes Claude skill + .mcp.json", () => {
    const root = tempProject();
    bootstrapEnvFiles(root);
    writeAgentConfig(root, "claude");
    expect(existsSync(join(root, ".claude", "skills", "luno", "SKILL.md"))).toBe(true);
    const mcp = JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8"));
    expect(mcp.mcpServers["luno-stg"].args).toContain("stg");
  });

  it("writes Cursor skill + mcp.json", () => {
    const root = tempProject();
    writeAgentConfig(root, "cursor");
    expect(existsSync(join(root, ".cursor", "skills", "luno", "SKILL.md"))).toBe(true);
    expect(existsSync(join(root, ".cursor", "mcp.json"))).toBe(true);
  });

  it("appends Codex mcp_servers to config.toml", () => {
    const root = tempProject();
    writeAgentConfig(root, "codex");
    const toml = readFileSync(join(root, ".codex", "config.toml"), "utf8");
    expect(toml).toContain("[mcp_servers.luno-stg]");
    expect(existsSync(join(root, ".agents", "skills", "luno", "SKILL.md"))).toBe(true);
  });

  it("Codex toml includes absolute cwd", () => {
    const root = tempProject();
    writeAgentConfig(root, "codex");
    const toml = readFileSync(join(root, ".codex", "config.toml"), "utf8");
    expect(toml).toContain(`cwd = "${root}"`);
    expect(toml).toContain("[mcp_servers.luno-stg]");
  });

  it("Codex overwrite refreshes cwd on re-run", () => {
    const root = tempProject();
    writeAgentConfig(root, "codex");
    const configPath = join(root, ".codex", "config.toml");
    const stale = readFileSync(configPath, "utf8").replace(
      `cwd = "${root}"`,
      'cwd = "/stale/old/path"'
    );
    writeFileSync(configPath, stale, "utf8");
    writeAgentConfig(root, "codex", { overwrite: true });
    const toml = readFileSync(configPath, "utf8");
    expect(toml).toContain(`cwd = "${root}"`);
    expect(toml).not.toContain('cwd = "/stale/old/path"');
  });
});

describe("codexMcpAddCommands", () => {
  it("include LUNO_PROJECT_ROOT", () => {
    const cmds = codexMcpAddCommands("/tmp/site");
    expect(cmds).toHaveLength(3);
    expect(cmds[1]).toContain("LUNO_PROJECT_ROOT\\=/tmp/site");
    expect(cmds[1]).toContain("luno-stg");
    expect(cmds[1]).toContain("run stg");
  });
});

describe("nextSteps", () => {
  it("codex mentions home registration and luno-stg", () => {
    const steps = nextSteps("codex");
    expect(steps.some((s) => s.includes("~/.codex"))).toBe(true);
    expect(steps.some((s) => s.includes("luno-stg"))).toBe(true);
    expect(steps.some((s) => s.includes("codex mcp list"))).toBe(true);
  });
});
