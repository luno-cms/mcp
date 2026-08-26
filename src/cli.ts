#!/usr/bin/env node
import { cwd } from "node:process";
import { isAgentKind, type AgentKind } from "./agent-configs.js";
import {
  bootstrapEnvFiles,
  getActiveEnv,
  hasRealKey,
  requireEnvName,
  setKey,
  setUrl,
  statusLines,
  switchEnv,
  applyEnvToProcess,
  resolveMcpProjectRoot,
} from "./env-files.js";
import { startLunoMcp } from "./server.js";

function printHelp(): void {
  console.log(`Usage: luno-mcp <command> [args]

Commands:
  (default)              Start MCP server (uses LUNO_API_URL / LUNO_AGENT_KEY)
  run <env>              Start MCP with .agents/luno/<env>.env (dev|stg|prod)
  serve-http [--port N]  Streamable HTTP MCP (Bearer sk-agent-…). Default 127.0.0.1:3333
  setup [--agent NAME]   Register skill + MCP for one agent in this project
  env bootstrap          Create .agents/luno/{dev,stg,prod}.env if missing
  env status             Show active env and key status
  env active             Print active env
  env set-key <env> KEY  Save agent API key
  env set-url <env> URL  Save API URL
  env switch <env>       Set active env (+ .agents/luno/env)
  env has-key <env>      Exit 0 if a real key is set
  help                   Show this help

Examples:
  npx @luno-cms/mcp setup
  npx @luno-cms/mcp setup --agent claude --yes
  npx @luno-cms/mcp env set-key stg sk-agent-…
  npx @luno-cms/mcp run stg
`);
}

function parseSetupFlags(argv: string[]): {
  agent?: AgentKind;
  yes: boolean;
  overwrite: boolean;
} {
  let agent: AgentKind | undefined;
  let yes = false;
  let overwrite = true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes" || a === "-y") yes = true;
    else if (a === "--no-overwrite") overwrite = false;
    else if (a === "--agent") {
      const v = argv[++i];
      if (!v || !isAgentKind(v)) {
        throw new Error("--agent requires claude|cursor|codex");
      }
      agent = v;
    } else if (a.startsWith("--agent=")) {
      const v = a.slice("--agent=".length);
      if (!isAgentKind(v)) throw new Error("--agent requires claude|cursor|codex");
      agent = v;
    } else {
      throw new Error(`Unknown setup option: ${a}`);
    }
  }
  return { agent, yes, overwrite };
}

async function runEnvCommand(argv: string[], projectRoot: string): Promise<void> {
  const sub = argv[0] ?? "help";
  switch (sub) {
    case "bootstrap": {
      for (const p of bootstrapEnvFiles(projectRoot)) {
        console.log(`ok  ${p}`);
      }
      return;
    }
    case "status": {
      console.log(statusLines(projectRoot).join("\n"));
      return;
    }
    case "active": {
      console.log(getActiveEnv(projectRoot));
      return;
    }
    case "set-key": {
      const env = requireEnvName(argv[1]);
      const key = argv[2];
      if (!key) throw new Error("usage: env set-key <env> <key>");
      console.log(`updated ${setKey(projectRoot, env, key)} (key set)`);
      return;
    }
    case "set-url": {
      const env = requireEnvName(argv[1]);
      const url = argv[2];
      if (!url) throw new Error("usage: env set-url <env> <url>");
      console.log(`updated ${setUrl(projectRoot, env, url)} (url set)`);
      return;
    }
    case "switch": {
      const env = requireEnvName(argv[1]);
      switchEnv(projectRoot, env);
      console.log(`active → ${env}`);
      console.log(`Prefer MCP server: luno-${env}`);
      return;
    }
    case "has-key": {
      const env = requireEnvName(argv[1]);
      if (hasRealKey(projectRoot, env)) {
        console.log("yes");
        process.exitCode = 0;
      } else {
        console.log("no");
        process.exitCode = 1;
      }
      return;
    }
    case "help":
    case "-h":
    case "--help":
      printHelp();
      return;
    default:
      throw new Error(`Unknown env command: ${sub}`);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const projectRoot = cwd();
  const cmd = argv[0];

  if (!cmd || cmd === "serve") {
    await startLunoMcp();
    return;
  }

  if (cmd === "help" || cmd === "-h" || cmd === "--help") {
    printHelp();
    return;
  }

  if (cmd === "serve-http") {
    const portFlag = argv.indexOf("--port");
    const port = portFlag >= 0 ? Number(argv[portFlag + 1]) : undefined;
    if (portFlag >= 0 && (!port || Number.isNaN(port))) {
      throw new Error("serve-http --port requires a number");
    }
    const { startMcpHttpServer } = await import("./http-mcp.js");
    startMcpHttpServer({ port });
    return;
  }

  if (cmd === "run") {
    const env = requireEnvName(argv[1]);
    const projectRoot = resolveMcpProjectRoot(cwd());
    applyEnvToProcess(projectRoot, env);
    await startLunoMcp();
    return;
  }

  if (cmd === "setup") {
    const flags = parseSetupFlags(argv.slice(1));
    const { runSetup } = await import("./setup.js");
    await runSetup({
      projectRoot,
      agent: flags.agent,
      yes: flags.yes,
      overwrite: flags.overwrite,
    });
    return;
  }

  if (cmd === "env") {
    await runEnvCommand(argv.slice(1), projectRoot);
    return;
  }

  // Backward compatible: unknown first arg → try MCP (no-op) or error
  throw new Error(`Unknown command: ${cmd}\n\nRun: luno-mcp help`);
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
