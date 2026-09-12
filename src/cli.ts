#!/usr/bin/env node
import { cwd } from "node:process";
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
import { isVersionCommand, readPackageVersion } from "./package-version.js";
import { startLunoMcp } from "./server.js";

function printHelp(): void {
  console.log(`Usage: luno-mcp <command> [args]

Required env (secrets stay required; do not omit for directory scores):
  LUNO_API_URL           Admin API base ending in /admin
                         e.g. https://api.luno.rest/admin
  LUNO_AGENT_KEY         Secret sk-agent-… from Console → MCP / API / Hook → API / MCP
  LUNO_FUNNEL_ID         Optional measurement funnel UUID

Commands:
  (default)              Start MCP server (uses LUNO_API_URL / LUNO_AGENT_KEY)
  run <env>              Start MCP with .agents/luno/<env>.env (dev|stg|prod)
  serve-http [--port N]  Streamable HTTP MCP (Bearer sk-agent-…). Default 127.0.0.1:3333
  setup [--agent NAME] [--key KEY] [--env prod|stg|dev] [--no-browser]
                         Register skill + MCP, browser login or --key, healthcheck (default env: prod).
                         Interactive agent list is detected CLIs / apps only.
  login [--key KEY] [--env prod|stg|dev] [--no-browser]
                         Refresh the agent key only. Does not rewrite MCP config.
                         After clone or 401, prefer this over setup. Browser login by default.
  env bootstrap          Create .agents/luno/{dev,stg,prod}.env if missing
  env status             Show active env and key status
  env active             Print active env
  env set-key <env> KEY  Save agent API key
  env set-url <env> URL  Save API URL
  env switch <env>       Set active env (+ .agents/luno/env)
  env has-key <env>      Exit 0 if a real key is set
  help                   Show this help
  version | --version    Print @luno-cms/mcp version (does not start MCP)

Examples:
  npx @luno-cms/mcp setup
  npx @luno-cms/mcp login
  npx @luno-cms/mcp login --key sk-agent-…
  npx @luno-cms/mcp setup --agent claude --yes --key sk-agent-…
  npx @luno-cms/mcp env set-key stg sk-agent-…   # explicit staging
  npx @luno-cms/mcp run prod
`);
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

  if (isVersionCommand(argv)) {
    console.log(readPackageVersion());
    return;
  }

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
    const { startMcpHttpServer } = await import("./http-mcp-node.js");
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
    const { runSetup, parseSetupFlags } = await import("./setup.js");
    const flags = parseSetupFlags(argv.slice(1));
    await runSetup({
      projectRoot,
      agent: flags.agent,
      yes: flags.yes,
      overwrite: flags.overwrite,
      key: flags.key,
      env: flags.env,
      noBrowser: flags.noBrowser,
    });
    return;
  }

  if (cmd === "login") {
    const { runLogin, parseLoginFlags } = await import("./login.js");
    const flags = parseLoginFlags(argv.slice(1));
    await runLogin({
      projectRoot,
      key: flags.key,
      env: flags.env,
      yes: flags.yes,
      noBrowser: flags.noBrowser,
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
