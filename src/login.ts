import { existsSync } from "node:fs";
import { join } from "node:path";
import { stdin as input, stdout as processStdout } from "node:process";
import {
  bootstrapEnvFiles,
  ensureGitignore,
  envFilePath,
  getActiveEnv,
  isLunoEnvName,
  readProjectEnv,
  setKey,
  switchEnv,
  type LunoEnvName,
} from "./env-files.js";
import {
  healthcheckLunoConnection,
  type HealthcheckResult,
} from "./setup-healthcheck.js";

export type LoginWriter = { write: (chunk: string) => void };

export type LoginOptions = {
  projectRoot: string;
  key?: string;
  env?: LunoEnvName;
  yes?: boolean;
  promptKey?: () => Promise<string>;
  healthcheck?: (args: { url: string; key: string }) => Promise<HealthcheckResult>;
  output?: LoginWriter;
};

export type ParsedLoginFlags = {
  key?: string;
  env?: LunoEnvName;
  yes: boolean;
};

const MCP_CONFIG_PATHS = [
  ".mcp.json",
  join(".cursor", "mcp.json"),
  join(".codex", "config.toml"),
];

export function hasAgentMcpConfig(projectRoot: string): boolean {
  return MCP_CONFIG_PATHS.some((rel) => existsSync(join(projectRoot, rel)));
}

export function parseLoginFlags(argv: string[]): ParsedLoginFlags {
  let key: string | undefined;
  let env: LunoEnvName | undefined;
  let yes = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes" || a === "-y") yes = true;
    else if (a === "--key") {
      const v = argv[++i];
      if (!v) throw new Error("--key requires sk-agent-…");
      key = v;
    } else if (a.startsWith("--key=")) {
      key = a.slice("--key=".length);
    } else if (a === "--env") {
      const v = argv[++i];
      if (!v || !isLunoEnvName(v)) throw new Error("--env requires prod|stg|dev");
      env = v;
    } else if (a.startsWith("--env=")) {
      const v = a.slice("--env=".length);
      if (!isLunoEnvName(v)) throw new Error("--env requires prod|stg|dev");
      env = v;
    } else {
      throw new Error(`Unknown login option: ${a}`);
    }
  }
  return { key, env, yes };
}

function readHiddenLine(): Promise<string> {
  return new Promise((resolve, reject) => {
    const wasRaw = input.isRaw;
    input.setRawMode?.(true);
    input.resume();
    let value = "";
    const onData = (chunk: Buffer | string) => {
      const ch = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      if (ch === "\n" || ch === "\r" || ch === "\u0004") {
        cleanup();
        processStdout.write("\n");
        resolve(value);
        return;
      }
      if (ch === "\u0003") {
        cleanup();
        reject(new Error("cancelled"));
        return;
      }
      if (ch === "\u007f" || ch === "\b") {
        value = value.slice(0, -1);
        return;
      }
      if (ch === "\u0015") {
        value = "";
        return;
      }
      value += ch;
    };
    const cleanup = () => {
      input.off("data", onData);
      if (input.setRawMode) input.setRawMode(Boolean(wasRaw));
      input.pause();
    };
    input.on("data", onData);
  });
}

async function defaultPromptMaskedKey(): Promise<string> {
  if (!input.isTTY) {
    throw new Error("Non-interactive login requires --key sk-agent-…");
  }
  processStdout.write("Agent API key (sk-agent-…, input hidden): ");
  return readHiddenLine();
}

async function resolveLoginKey(opts: LoginOptions): Promise<string> {
  if (opts.key !== undefined) return opts.key;
  if (opts.promptKey) return opts.promptKey();
  if (opts.yes || !input.isTTY) {
    throw new Error("Non-interactive login requires --key sk-agent-…");
  }
  return defaultPromptMaskedKey();
}

export async function runLogin(opts: LoginOptions): Promise<void> {
  const output = opts.output ?? processStdout;
  const projectRoot = opts.projectRoot;
  if (!hasAgentMcpConfig(projectRoot)) {
    throw new Error("No MCP config found. Run: npx @luno-cms/mcp setup");
  }

  const env = opts.env ?? getActiveEnv(projectRoot);
  bootstrapEnvFiles(projectRoot);
  ensureGitignore(projectRoot);
  const key = await resolveLoginKey(opts);
  setKey(projectRoot, env, key);
  switchEnv(projectRoot, env);

  const { url } = readProjectEnv(projectRoot, env);
  const check =
    opts.healthcheck ??
    (async ({ url: apiUrl, key: agentKey }) =>
      healthcheckLunoConnection({ apiUrl, agentKey }));
  const health = await check({ url, key });
  if (!health.ok) {
    throw new Error(`${env} unreachable: ${health.message}`);
  }

  output.write("\n");
  output.write("LUNO login\n");
  output.write(`\nConnected: ${env} OK\n`);
  output.write(`Env file: ${envFilePath(projectRoot, env)}\n`);
  output.write("MCP config unchanged. Reconnect the agent if tools still 401.\n");
  output.write("Keys stay in .agents/luno/ (gitignored).\n");
}
