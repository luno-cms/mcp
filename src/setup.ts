import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  agentLabel,
  isAgentKind,
  nextSteps,
  type AgentKind,
  writeAgentConfig,
} from "./agent-configs.js";
import { bootstrapEnvFiles, ensureGitignore } from "./env-files.js";
import { offerCodexHomeRegistration } from "./codex-home-register.js";

export type SetupOptions = {
  projectRoot: string;
  agent?: AgentKind;
  yes?: boolean;
  overwrite?: boolean;
};

async function promptAgent(): Promise<AgentKind> {
  const rl = createInterface({ input, output });
  try {
    output.write("Which agent will you use?\n");
    output.write("  1) Claude Code\n");
    output.write("  2) Cursor\n");
    output.write("  3) Codex\n");
    const answer = (await rl.question("Enter 1/2/3 [1]: ")).trim() || "1";
    if (answer === "1" || answer.toLowerCase() === "claude") return "claude";
    if (answer === "2" || answer.toLowerCase() === "cursor") return "cursor";
    if (answer === "3" || answer.toLowerCase() === "codex") return "codex";
    throw new Error(`Unknown choice: ${answer}`);
  } finally {
    rl.close();
  }
}

export async function runSetup(opts: SetupOptions): Promise<void> {
  const projectRoot = opts.projectRoot;
  let agent = opts.agent;
  if (!agent) {
    if (opts.yes) {
      agent = "claude";
    } else if (!input.isTTY) {
      throw new Error("Non-interactive setup requires --agent claude|cursor|codex");
    } else {
      agent = await promptAgent();
    }
  }
  if (!isAgentKind(agent)) {
    throw new Error(`Unknown agent: ${agent}`);
  }

  const envPaths = bootstrapEnvFiles(projectRoot);
  ensureGitignore(projectRoot);
  const result = writeAgentConfig(projectRoot, agent, {
    overwrite: opts.overwrite ?? true,
  });

  output.write("\n");
  output.write(`LUNO setup → ${agentLabel(agent)}\n`);
  output.write("\nEnv files:\n");
  for (const p of envPaths) {
    output.write(`  ${p}\n`);
  }
  output.write("\nAgent files:\n");
  for (const f of result.files) {
    output.write(`  [${f.action}] ${f.path}\n`);
  }
  output.write("\nNext steps:\n");
  for (const step of nextSteps(agent)) {
    output.write(`  • ${step}\n`);
  }
  output.write("\nKeys stay in .agents/luno/ (gitignored).\n");

  if (agent === "codex") {
    await offerCodexHomeRegistration({
      projectRoot,
      yes: Boolean(opts.yes),
    });
  }
}
