import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeAgentConfig } from "./agent-configs.js";
import { bootstrapEnvFiles, getActiveEnv, hasRealKey, readProjectEnv, setKey } from "./env-files.js";

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length) {
    const d = dirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

function tempProject(): string {
  const d = mkdtempSync(join(tmpdir(), "luno-mcp-login-"));
  dirs.push(d);
  return d;
}

function seedCommittedMcp(root: string): string {
  writeAgentConfig(root, "claude");
  return readFileSync(join(root, ".mcp.json"), "utf8");
}

describe("parseLoginFlags", () => {
  it("reads --key and defaults env to unset (active or prod)", async () => {
    const { parseLoginFlags } = await import("./login.js");
    expect(parseLoginFlags(["--key", "sk-agent-abc"])).toEqual({
      key: "sk-agent-abc",
      env: undefined,
      yes: false,
    });
  });

  it("accepts explicit --env stg", async () => {
    const { parseLoginFlags } = await import("./login.js");
    expect(parseLoginFlags(["--env", "stg"]).env).toBe("stg");
  });
});

describe("runLogin", () => {
  it("updates the key without rewriting MCP config", async () => {
    const { runLogin } = await import("./login.js");
    const root = tempProject();
    const before = seedCommittedMcp(root);
    let log = "";
    const checks: Array<{ url: string; key: string }> = [];

    await runLogin({
      projectRoot: root,
      key: "sk-agent-login-key",
      healthcheck: async ({ url, key }) => {
        checks.push({ url, key });
        return { ok: true };
      },
      output: { write: (s: string) => { log += s; } },
    });

    expect(hasRealKey(root, "prod")).toBe(true);
    expect(readProjectEnv(root, "prod").key).toBe("sk-agent-login-key");
    expect(getActiveEnv(root)).toBe("prod");
    expect(checks).toEqual([{ url: "https://api.luno.rest/admin", key: "sk-agent-login-key" }]);
    expect(readFileSync(join(root, ".mcp.json"), "utf8")).toBe(before);
    expect(log).toMatch(/prod OK/);
    expect(log).toMatch(/unchanged|再生成しない|config unchanged/i);
    expect(log).not.toMatch(/sk-agent-login-key/);
    expect(existsSync(join(root, ".cursor", "mcp.json"))).toBe(false);
  });

  it("after clone (config only, no env files) writes the key and leaves mcp.json alone", async () => {
    const { runLogin } = await import("./login.js");
    const root = tempProject();
    mkdirSync(join(root, ".claude"), { recursive: true });
    writeFileSync(
      join(root, ".mcp.json"),
      JSON.stringify({ mcpServers: { "luno-prod": { command: "npx" } } }),
      "utf8",
    );
    const before = readFileSync(join(root, ".mcp.json"), "utf8");

    await runLogin({
      projectRoot: root,
      key: "sk-agent-clone-key",
      healthcheck: async () => ({ ok: true }),
      output: { write: () => {} },
    });

    expect(hasRealKey(root, "prod")).toBe(true);
    expect(readFileSync(join(root, ".mcp.json"), "utf8")).toBe(before);
    expect(existsSync(join(root, ".claude", "skills", "luno", "SKILL.md"))).toBe(false);
  });

  it("refuses a placeholder key", async () => {
    const { runLogin } = await import("./login.js");
    const root = tempProject();
    seedCommittedMcp(root);
    await expect(
      runLogin({
        projectRoot: root,
        key: "sk-agent-xxxxxxxx",
        healthcheck: async () => ({ ok: true }),
        output: { write: () => {} },
      }),
    ).rejects.toThrow(/placeholder|sk-agent/i);
  });

  it("requires setup first when no agent MCP config exists", async () => {
    const { runLogin } = await import("./login.js");
    const root = tempProject();
    await expect(
      runLogin({
        projectRoot: root,
        key: "sk-agent-login-key",
        healthcheck: async () => ({ ok: true }),
        output: { write: () => {} },
      }),
    ).rejects.toThrow(/setup/i);
  });

  it("requires --key when non-interactive", async () => {
    const { runLogin } = await import("./login.js");
    const root = tempProject();
    seedCommittedMcp(root);
    await expect(
      runLogin({
        projectRoot: root,
        yes: true,
        healthcheck: async () => ({ ok: true }),
        output: { write: () => {} },
      }),
    ).rejects.toThrow(/--key/);
  });

  it("fails closed when healthcheck cannot reach LUNO", async () => {
    const { runLogin } = await import("./login.js");
    const root = tempProject();
    seedCommittedMcp(root);
    await expect(
      runLogin({
        projectRoot: root,
        key: "sk-agent-login-key",
        healthcheck: async () => ({ ok: false, message: "401 unauthorized" }),
        output: { write: () => {} },
      }),
    ).rejects.toThrow(/401|unreachable|health/i);
  });

  it("updates an explicit stg key and keeps existing claude config", async () => {
    const { runLogin } = await import("./login.js");
    const root = tempProject();
    bootstrapEnvFiles(root);
    setKey(root, "prod", "sk-agent-old-prod");
    const before = seedCommittedMcp(root);

    await runLogin({
      projectRoot: root,
      env: "stg",
      key: "sk-agent-login-stg",
      healthcheck: async () => ({ ok: true }),
      output: { write: () => {} },
    });

    expect(hasRealKey(root, "stg")).toBe(true);
    expect(readProjectEnv(root, "stg").key).toBe("sk-agent-login-stg");
    expect(readProjectEnv(root, "prod").key).toBe("sk-agent-old-prod");
    expect(getActiveEnv(root)).toBe("stg");
    expect(readFileSync(join(root, ".mcp.json"), "utf8")).toBe(before);
  });
});
