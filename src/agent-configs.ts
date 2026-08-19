import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import quote from "shell-quote/quote.js";
import { skillTemplatePath } from "./package-root.js";

export type AgentKind = "claude" | "cursor" | "codex";

export const AGENT_KINDS: AgentKind[] = ["claude", "cursor", "codex"];

export function isAgentKind(v: string): v is AgentKind {
  return v === "claude" || v === "cursor" || v === "codex";
}

function mcpJsonContent(): string {
  return `${JSON.stringify(
    {
      mcpServers: {
        "luno-dev": {
          command: "npx",
          args: ["-y", "@luno-cms/mcp", "run", "dev"],
        },
        "luno-stg": {
          command: "npx",
          args: ["-y", "@luno-cms/mcp", "run", "stg"],
        },
        "luno-prod": {
          command: "npx",
          args: ["-y", "@luno-cms/mcp", "run", "prod"],
        },
      },
    },
    null,
    2
  )}\n`;
}

const CODEX_MCP_ENVS = ["dev", "stg", "prod"] as const;

function quoteTomlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function codexTomlFragment(projectRoot: string): string {
  const abs = resolve(projectRoot);
  const lines: string[] = ["", "# LUNO MCP (managed by: npx @luno-cms/mcp setup)"];
  for (const env of CODEX_MCP_ENVS) {
    lines.push(
      "",
      `[mcp_servers.luno-${env}]`,
      'command = "npx"',
      `args = ["-y", "@luno-cms/mcp", "run", "${env}"]`,
      `cwd = "${quoteTomlString(abs)}"`
    );
  }
  lines.push("");
  return lines.join("\n");
}

export type CodexMcpAdd = { name: string; argv: string[] };

export function codexMcpAddArgv(projectRoot: string): CodexMcpAdd[] {
  const abs = resolve(projectRoot);
  const envArg = `LUNO_PROJECT_ROOT=${abs}`;
  return CODEX_MCP_ENVS.map((env) => ({
    name: `luno-${env}`,
    argv: [
      "mcp",
      "add",
      `luno-${env}`,
      "--env",
      envArg,
      "--",
      "npx",
      "-y",
      "@luno-cms/mcp",
      "run",
      env,
    ],
  }));
}

export function codexMcpAddShellLine(argv: string[]): string {
  return `codex ${quote(argv)}`;
}

export function codexMcpAddCommands(projectRoot: string): string[] {
  return codexMcpAddArgv(projectRoot).map((add) => codexMcpAddShellLine(add.argv));
}

export function formatCodexHomeRegisterHint(projectRoot: string): string {
  const cmds = codexMcpAddCommands(projectRoot);
  return [
    "Register MCP into ~/.codex (if needed):",
    "",
    ...cmds.map((line) => `  ${line}`),
    "",
    "Verify: codex mcp list  →  expect luno-dev, luno-stg, luno-prod",
  ].join("\n");
}

function writeTextFile(
  path: string,
  contents: string,
  overwrite: boolean
): { path: string; action: "created" | "updated" | "skipped" } {
  const existed = existsSync(path);
  if (existed && !overwrite) {
    return { path, action: "skipped" };
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
  return { path, action: existed ? "updated" : "created" };
}

function writeSkill(
  projectRoot: string,
  relativeDir: string,
  overwrite: boolean
): { path: string; action: "created" | "updated" | "skipped" } {
  const dest = join(projectRoot, relativeDir, "SKILL.md");
  const template = readFileSync(skillTemplatePath(), "utf8");
  return writeTextFile(dest, template, overwrite);
}

function mergeCodexToml(
  projectRoot: string,
  overwrite: boolean
): { path: string; action: "created" | "updated" | "skipped" } {
  const path = join(projectRoot, ".codex", "config.toml");
  const fragment = codexTomlFragment(projectRoot);
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${fragment.trimStart()}`, "utf8");
    return { path, action: "created" };
  }
  const current = readFileSync(path, "utf8");
  if (current.includes("[mcp_servers.luno-stg]")) {
    if (!overwrite) return { path, action: "skipped" };
    const withoutManaged = current
      .replace(/# LUNO MCP \(managed by: npx @luno-cms\/mcp setup\)\n?/g, "")
      .replace(
        /\[mcp_servers\.luno-(?:dev|stg|prod)\]\n(?:command = .*\n)(?:args = .*\n)(?:cwd = .*\n)?/g,
        ""
      )
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd();
    writeFileSync(path, `${withoutManaged}\n${fragment}`, "utf8");
    return { path, action: "updated" };
  }
  const sep = current.endsWith("\n") ? "" : "\n";
  writeFileSync(path, `${current}${sep}${fragment}`, "utf8");
  return { path, action: "updated" };
}

export type SetupWriteResult = {
  agent: AgentKind;
  files: Array<{ path: string; action: "created" | "updated" | "skipped" }>;
};

export function writeAgentConfig(
  projectRoot: string,
  agent: AgentKind,
  opts?: { overwrite?: boolean }
): SetupWriteResult {
  const overwrite = opts?.overwrite ?? true;
  const files: SetupWriteResult["files"] = [];

  if (agent === "claude") {
    files.push(writeSkill(projectRoot, join(".claude", "skills", "luno"), overwrite));
    files.push(writeTextFile(join(projectRoot, ".mcp.json"), mcpJsonContent(), overwrite));
  } else if (agent === "cursor") {
    files.push(writeSkill(projectRoot, join(".cursor", "skills", "luno"), overwrite));
    files.push(
      writeTextFile(join(projectRoot, ".cursor", "mcp.json"), mcpJsonContent(), overwrite)
    );
  } else {
    files.push(writeSkill(projectRoot, join(".agents", "skills", "luno"), overwrite));
    files.push(mergeCodexToml(projectRoot, overwrite));
  }

  return { agent, files };
}

export function agentLabel(agent: AgentKind): string {
  switch (agent) {
    case "claude":
      return "Claude Code";
    case "cursor":
      return "Cursor";
    case "codex":
      return "Codex";
  }
}

export function nextSteps(agent: AgentKind): string[] {
  switch (agent) {
    case "claude":
      return [
        "Run: claude",
        "Approve workspace trust if prompted",
        "Type: /luno",
        "Paste your agent API key when asked",
      ];
    case "cursor":
      return [
        "Open this folder in Cursor",
        "Reload Window if MCP servers do not appear",
        "In Agent chat, run /luno (or select the luno skill)",
        "Paste your agent API key when asked",
      ];
    case "codex":
      return [
        "If needed, register MCP into ~/.codex (commands printed below)",
        "Verify: codex mcp list  →  expect luno-stg",
        "Trust this project; start Codex in this folder",
        "Prefer MCP server luno-stg when that env is active",
        "Approve the first MCP tool call if Codex prompts",
        "Invoke the luno skill; paste sk-agent-… when asked",
      ];
  }
}
