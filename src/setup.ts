import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as processStdout } from "node:process";
import {
  agentLabel,
  isAgentKind,
  afterFirstSuccessHint,
  nextSteps,
  type AgentKind,
  writeAgentConfig,
} from "./agent-configs.js";
import {
  bootstrapEnvFiles,
  ensureGitignore,
  envFilePath,
  hasRealKey,
  isLunoEnvName,
  readProjectEnv,
  setKey,
  switchEnv,
  type LunoEnvName,
} from "./env-files.js";
import { offerCodexHomeRegistration } from "./codex-home-register.js";
import {
  detectInstalledAgents,
  noAgentInstallHint,
  selectDetectedAgent,
} from "./detect-agents.js";
import { runBrowserLogin } from "./browser-login.js";
import {
  healthcheckLunoConnection,
  type HealthcheckResult,
} from "./setup-healthcheck.js";

export type SetupWriter = { write: (chunk: string) => void };

export type SetupOptions = {
  projectRoot: string;
  agent?: AgentKind;
  yes?: boolean;
  overwrite?: boolean;
  key?: string;
  env?: LunoEnvName;
  noBrowser?: boolean;
  promptKey?: () => Promise<string>;
  browserLogin?: () => Promise<string>;
  detectAgents?: () => AgentKind[];
  healthcheck?: (args: { url: string; key: string }) => Promise<HealthcheckResult>;
  output?: SetupWriter;
};

export type ParsedSetupFlags = {
  agent?: AgentKind;
  yes: boolean;
  overwrite: boolean;
  key?: string;
  env: LunoEnvName;
  noBrowser: boolean;
};

export function parseSetupFlags(argv: string[]): ParsedSetupFlags {
  let agent: AgentKind | undefined;
  let yes = false;
  let overwrite = true;
  let key: string | undefined;
  let env: LunoEnvName = "prod";
  let noBrowser = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes" || a === "-y") yes = true;
    else if (a === "--no-browser") noBrowser = true;
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
    } else if (a === "--key") {
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
      throw new Error(`Unknown setup option: ${a}`);
    }
  }
  return { agent, yes, overwrite, key, env, noBrowser };
}

async function promptAgent(output: SetupWriter, detected: AgentKind[]): Promise<AgentKind> {
  const rl = createInterface({ input, output: processStdout });
  try {
    output.write("Which agent will you use?\n");
    detected.forEach((kind, i) => {
      output.write(`  ${i + 1}) ${agentLabel(kind)}\n`);
    });
    const answer = (await rl.question(`Enter 1/${detected.length} [1]: `)).trim() || "1";
    return selectDetectedAgent(answer, detected);
  } finally {
    rl.close();
  }
}

function resolveDetectedAgents(opts: SetupOptions): AgentKind[] {
  return (opts.detectAgents ?? detectInstalledAgents)();
}

function resolveAgentWithoutPrompt(detected: AgentKind[]): AgentKind {
  if (detected.length === 0) throw new Error(noAgentInstallHint());
  if (detected.includes("claude")) return "claude";
  return detected[0]!;
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
    throw new Error("Non-interactive setup requires --key sk-agent-…");
  }
  processStdout.write("Agent API key (sk-agent-…, input hidden): ");
  return readHiddenLine();
}

async function resolveAgentKey(
  opts: SetupOptions,
  env: LunoEnvName,
  check: (args: { url: string; key: string }) => Promise<HealthcheckResult>,
): Promise<string> {
  if (opts.key !== undefined) return opts.key;
  if (hasRealKey(opts.projectRoot, env)) {
    const existing = readProjectEnv(opts.projectRoot, env);
    const health = await check({ url: existing.url, key: existing.key });
    if (health.ok) return existing.key;
  }
  if (opts.promptKey) return opts.promptKey();
  if (opts.browserLogin) return opts.browserLogin();
  if (!opts.noBrowser && !opts.yes && input.isTTY) {
    const { url } = readProjectEnv(opts.projectRoot, env);
    return runBrowserLogin({ apiUrl: url, output: opts.output });
  }
  if (opts.yes || !input.isTTY) {
    throw new Error("Non-interactive setup requires --key sk-agent-…");
  }
  return defaultPromptMaskedKey();
}

export async function runSetup(opts: SetupOptions): Promise<void> {
  const output = opts.output ?? processStdout;
  const projectRoot = opts.projectRoot;
  const env = opts.env ?? "prod";
  let agent = opts.agent;
  if (!agent) {
    const detected = resolveDetectedAgents(opts);
    if (opts.yes) {
      agent = resolveAgentWithoutPrompt(detected);
    } else if (!input.isTTY) {
      throw new Error("Non-interactive setup requires --agent claude|cursor|codex");
    } else {
      if (detected.length === 0) throw new Error(noAgentInstallHint());
      agent = await promptAgent(output, detected);
    }
  }
  if (!isAgentKind(agent)) {
    throw new Error(`Unknown agent: ${agent}`);
  }

  bootstrapEnvFiles(projectRoot);
  ensureGitignore(projectRoot);
  const check =
    opts.healthcheck ??
    (async ({ url: apiUrl, key: agentKey }) =>
      healthcheckLunoConnection({ apiUrl, agentKey }));
  const key = await resolveAgentKey(opts, env, check);
  setKey(projectRoot, env, key);
  switchEnv(projectRoot, env);
  const result = writeAgentConfig(projectRoot, agent, {
    overwrite: opts.overwrite ?? true,
  });

  const { url } = readProjectEnv(projectRoot, env);
  const health = await check({ url, key });
  if (!health.ok) {
    throw new Error(`${env} unreachable: ${health.message}`);
  }

  output.write("\n");
  output.write(`LUNO setup → ${agentLabel(agent)}\n`);
  output.write(`\nConnected: ${env} OK\n`);
  output.write(`Env file: ${envFilePath(projectRoot, env)}\n`);
  output.write("\nAgent files:\n");
  for (const f of result.files) {
    output.write(`  [${f.action}] ${f.path}\n`);
  }
  output.write("\nNext step:\n");
  for (const step of nextSteps(agent)) {
    output.write(`  • ${step}\n`);
  }
  output.write(`\n${afterFirstSuccessHint()}\n`);
  output.write("\nKeys stay in .agents/luno/ (gitignored).\n");

  if (agent === "codex") {
    await offerCodexHomeRegistration({
      projectRoot,
      yes: Boolean(opts.yes),
    });
  }
}
