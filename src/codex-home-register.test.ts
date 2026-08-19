import { describe, expect, it } from "vitest";
import { codexMcpAddArgv, codexMcpAddCommands } from "./agent-configs.js";
import { offerCodexHomeRegistration } from "./codex-home-register.js";

describe("codexMcpAddArgv", () => {
  it("returns three adds with structured argv", () => {
    const adds = codexMcpAddArgv("/tmp/site");
    expect(adds).toHaveLength(3);
    expect(adds[1]).toEqual({
      name: "luno-stg",
      argv: [
        "mcp",
        "add",
        "luno-stg",
        "--env",
        "LUNO_PROJECT_ROOT=/tmp/site",
        "--",
        "npx",
        "-y",
        "@luno-cms/mcp",
        "run",
        "stg",
      ],
    });
  });

  it("shell lines derive from argv", () => {
    const cmds = codexMcpAddCommands("/tmp/site");
    expect(cmds[0]).toMatch(/^codex mcp add luno-dev/);
    expect(cmds[1]).toContain("LUNO_PROJECT_ROOT\\=/tmp/site");
  });
});

describe("offerCodexHomeRegistration", () => {
  it("with yes does not run codex", async () => {
    const runs: string[][] = [];
    const lines: string[] = [];
    await offerCodexHomeRegistration({
      projectRoot: "/tmp/site",
      yes: true,
      whichCodex: () => "/usr/bin/codex",
      runCommand: async (argv) => {
        runs.push(argv);
        return { ok: true, detail: "" };
      },
      write: (s) => lines.push(s),
    });
    expect(runs).toEqual([]);
    expect(lines.some((l) => l.includes("codex mcp add luno-dev"))).toBe(true);
    expect(lines.some((l) => l.includes("codex mcp add luno-stg"))).toBe(true);
    expect(lines.some((l) => l.includes("codex mcp add luno-prod"))).toBe(true);
  });

  it("interactive Yes runs three codex mcp add commands", async () => {
    const runs: string[][] = [];
    await offerCodexHomeRegistration({
      projectRoot: "/tmp/site",
      yes: false,
      isTTY: true,
      whichCodex: () => "/usr/bin/codex",
      prompt: async () => "y",
      runCommand: async (argv) => {
        runs.push(argv);
        return { ok: true, detail: "" };
      },
      write: () => {},
    });
    expect(runs).toHaveLength(3);
    expect(runs[0][0]).toBe("/usr/bin/codex");
    expect(runs[0].slice(1)).toEqual(codexMcpAddArgv("/tmp/site")[0].argv);
    expect(runs[1][1]).toBe("mcp");
    expect(runs[2][3]).toBe("luno-prod");
  });

  it("interactive Yes without codex warns and does not run", async () => {
    const runs: string[][] = [];
    const lines: string[] = [];
    await offerCodexHomeRegistration({
      projectRoot: "/tmp/site",
      yes: false,
      isTTY: true,
      whichCodex: () => null,
      prompt: async () => "y",
      runCommand: async (argv) => {
        runs.push(argv);
        return { ok: true, detail: "" };
      },
      write: (s) => lines.push(s),
    });
    expect(runs).toEqual([]);
    expect(lines.some((l) => l.toLowerCase().includes("codex") && l.toLowerCase().includes("path"))).toBe(
      true
    );
  });

  it("interactive No does not run codex", async () => {
    const runs: string[][] = [];
    await offerCodexHomeRegistration({
      projectRoot: "/tmp/site",
      yes: false,
      isTTY: true,
      whichCodex: () => "/usr/bin/codex",
      prompt: async () => "n",
      runCommand: async (argv) => {
        runs.push(argv);
        return { ok: true, detail: "" };
      },
      write: () => {},
    });
    expect(runs).toEqual([]);
  });

  it("non-TTY without yes prints only", async () => {
    const runs: string[][] = [];
    let prompted = false;
    await offerCodexHomeRegistration({
      projectRoot: "/tmp/site",
      yes: false,
      isTTY: false,
      whichCodex: () => "/usr/bin/codex",
      prompt: async () => {
        prompted = true;
        return "y";
      },
      runCommand: async (argv) => {
        runs.push(argv);
        return { ok: true, detail: "" };
      },
      write: () => {},
    });
    expect(prompted).toBe(false);
    expect(runs).toEqual([]);
  });
});
