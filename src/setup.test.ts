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
    expect(mcp.mcpServers["luno-stg"].args).toEqual(["-y", "@luno-cms/mcp@latest", "run", "stg"]);
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
  it("is a single trust step and does not ask to paste a key", () => {
    for (const agent of ["claude", "cursor", "codex"] as const) {
      const steps = nextSteps(agent);
      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatch(/trust|許可|Approve/i);
      expect(steps.join("\n")).not.toMatch(/\/luno/);
      expect(steps.join("\n")).not.toMatch(/paste|貼/i);
      expect(steps.join("\n")).not.toMatch(/luno-stg/);
    }
  });

  it("asks a read or draft first prompt, not publish (luno#214)", () => {
    for (const agent of ["claude", "cursor", "codex"] as const) {
      const step = nextSteps(agent)[0] ?? "";
      expect(step).toMatch(/list the form sets|draft one entry/i);
      expect(step).toMatch(/don't publish|do not publish/i);
      expect(step).not.toMatch(/publish (this|it|now|to prod)|go live|approve this/i);
    }
  });
});

describe("parseSetupFlags", () => {
  it("reads --key and defaults env to prod", async () => {
    const { parseSetupFlags } = await import("./setup.js");
    expect(parseSetupFlags(["--agent", "cursor", "--key", "sk-agent-abc"])).toEqual({
      agent: "cursor",
      yes: false,
      overwrite: true,
      key: "sk-agent-abc",
      env: "prod",
      noBrowser: false,
    });
  });

  it("accepts explicit --env stg", async () => {
    const { parseSetupFlags } = await import("./setup.js");
    expect(parseSetupFlags(["--env", "stg", "--yes"]).env).toBe("stg");
  });
});

describe("runSetup", () => {
  it("writes the key to prod, healthchecks, and prints one next step", async () => {
    const { runSetup } = await import("./setup.js");
    const { getActiveEnv, hasRealKey, readProjectEnv } = await import("./env-files.js");
    const root = tempProject();
    let log = "";
    const checks: Array<{ url: string; key: string }> = [];
    await runSetup({
      projectRoot: root,
      agent: "claude",
      key: "sk-agent-test-key",
      healthcheck: async ({ url, key }) => {
        checks.push({ url, key });
        return { ok: true };
      },
      output: { write: (s: string) => { log += s; } },
    });
    expect(hasRealKey(root, "prod")).toBe(true);
    expect(readProjectEnv(root, "prod").key).toBe("sk-agent-test-key");
    expect(getActiveEnv(root)).toBe("prod");
    expect(checks).toEqual([{ url: "https://api.luno.rest/admin", key: "sk-agent-test-key" }]);
    expect(log).toMatch(/prod OK/);
    expect(log).not.toMatch(/sk-agent-test-key/);
    expect(log).not.toMatch(/(?:Type:|run) \/luno/i);
    expect(log).not.toMatch(/Paste your agent API key/i);
    const next = log.split("Next step:")[1] ?? log.split("Next steps:")[1] ?? "";
    expect(next.trim().split("\n").filter((l) => l.trim().startsWith("•"))).toHaveLength(1);
    expect(next).toMatch(/list the form sets|draft one entry/i);
    expect(next).not.toMatch(/publish this|go live/i);
    expect(log).toMatch(/npx @luno-cms\/mcp login/);
    expect(log).toMatch(/--env stg/);
  });

  it("refuses a placeholder key", async () => {
    const { runSetup } = await import("./setup.js");
    const root = tempProject();
    await expect(
      runSetup({
        projectRoot: root,
        agent: "claude",
        key: "sk-agent-xxxxxxxx",
        healthcheck: async () => ({ ok: true }),
        output: { write: () => {} },
      })
    ).rejects.toThrow(/placeholder|sk-agent/i);
  });

  it("requires --key when non-interactive and no existing key", async () => {
    const { runSetup } = await import("./setup.js");
    const root = tempProject();
    await expect(
      runSetup({
        projectRoot: root,
        agent: "claude",
        yes: true,
        healthcheck: async () => ({ ok: true }),
        output: { write: () => {} },
      })
    ).rejects.toThrow(/--key/);
  });

  it("fails closed when healthcheck cannot reach LUNO", async () => {
    const { runSetup } = await import("./setup.js");
    const { hasRealKey } = await import("./env-files.js");
    const root = tempProject();
    await expect(
      runSetup({
        projectRoot: root,
        agent: "claude",
        key: "sk-agent-test-key",
        healthcheck: async () => ({ ok: false, message: "401 unauthorized" }),
        output: { write: () => {} },
      })
    ).rejects.toThrow(/401|unreachable|health/i);
    expect(hasRealKey(root, "prod")).toBe(true);
  });

  it("stops when no agent is detected and --agent was not passed", async () => {
    const { runSetup } = await import("./setup.js");
    const root = tempProject();
    await expect(
      runSetup({
        projectRoot: root,
        yes: true,
        key: "sk-agent-test-key",
        detectAgents: () => [],
        healthcheck: async () => ({ ok: true }),
        output: { write: () => {} },
      })
    ).rejects.toThrow(/Claude Code|npx @luno-cms\/mcp setup/);
  });

  it("honors --agent even when detection is empty", async () => {
    const { runSetup } = await import("./setup.js");
    const root = tempProject();
    await runSetup({
      projectRoot: root,
      agent: "cursor",
      key: "sk-agent-test-key",
      detectAgents: () => [],
      healthcheck: async () => ({ ok: true }),
      output: { write: () => {} },
    });
    expect(existsSync(join(root, ".cursor", "mcp.json"))).toBe(true);
  });

  it("can set an explicit stg key without making stg the public default", async () => {
    const { runSetup } = await import("./setup.js");
    const { getActiveEnv, hasRealKey } = await import("./env-files.js");
    const root = tempProject();
    await runSetup({
      projectRoot: root,
      agent: "claude",
      env: "stg",
      key: "sk-agent-stg-key",
      healthcheck: async () => ({ ok: true }),
      output: { write: () => {} },
    });
    expect(hasRealKey(root, "stg")).toBe(true);
    expect(getActiveEnv(root)).toBe("stg");
  });

  it("skips browser login when an existing key already healthchecks", async () => {
    const { runSetup } = await import("./setup.js");
    const { setKey, readProjectEnv } = await import("./env-files.js");
    const root = tempProject();
    bootstrapEnvFiles(root);
    setKey(root, "prod", "sk-agent-already-good");
    let browserCalls = 0;

    await runSetup({
      projectRoot: root,
      agent: "claude",
      yes: true,
      browserLogin: async () => {
        browserCalls += 1;
        return "sk-agent-should-not-run";
      },
      healthcheck: async () => ({ ok: true }),
      output: { write: () => {} },
    });

    expect(browserCalls).toBe(0);
    expect(readProjectEnv(root, "prod").key).toBe("sk-agent-already-good");
  });

  it("uses browser login when no key is stored", async () => {
    const { runSetup } = await import("./setup.js");
    const { readProjectEnv } = await import("./env-files.js");
    const root = tempProject();
    let opened = 0;

    await runSetup({
      projectRoot: root,
      agent: "claude",
      browserLogin: async () => {
        opened += 1;
        return "sk-agent-browser-key";
      },
      healthcheck: async () => ({ ok: true }),
      output: { write: () => {} },
    });

    expect(opened).toBe(1);
    expect(readProjectEnv(root, "prod").key).toBe("sk-agent-browser-key");
  });
});
