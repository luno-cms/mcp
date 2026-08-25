/**
 * Codex ~/.codex registration — setup/CLI only.
 *
 * Threat model:
 * - Not imported by startLunoMcp. cli.ts loads this only via dynamic import on `setup`
 * - No shell: `which` via spawnSync argv; `codex mcp add` via spawn({ shell: false })
 * - Interactive consent (TTY + Y/n) before any process is spawned
 * - projectRoot is resolved and rejected (NUL / excessive length) before it is
 *   embedded in `--env LUNO_PROJECT_ROOT=…`
 */
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { codexMcpAddArgv, formatCodexHomeRegisterHint } from "./agent-configs.js";

export type OfferCodexHomeRegistrationOpts = {
  projectRoot: string;
  yes: boolean;
  isTTY?: boolean;
  runCommand?: (argv: string[]) => Promise<{ ok: boolean; detail: string }>;
  whichCodex?: () => string | null;
  prompt?: (q: string) => Promise<string>;
  write?: (s: string) => void;
};

function defaultWhichCodex(): string | null {
  try {
    const result = spawnSync("which", ["codex"], { encoding: "utf8", shell: false });
    if (result.status !== 0) return null;
    const found = result.stdout.trim();
    return found || null;
  } catch {
    return null;
  }
}

async function defaultRunCommand(argv: string[]): Promise<{ ok: boolean; detail: string }> {
  return new Promise((resolve) => {
    const child = spawn(argv[0], argv.slice(1), { shell: false, stdio: "pipe" });
    let detail = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      detail += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      detail += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, detail: detail.trim() });
    });
    child.on("error", (err) => {
      resolve({ ok: false, detail: err.message });
    });
  });
}

function isAffirmative(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();
  return normalized === "" || normalized === "y" || normalized === "yes";
}

export async function offerCodexHomeRegistration(
  opts: OfferCodexHomeRegistrationOpts
): Promise<void> {
  const write = opts.write ?? ((s: string) => output.write(s));
  const isTTY = opts.isTTY ?? input.isTTY;

  write("\n");
  write(formatCodexHomeRegisterHint(opts.projectRoot));
  write("\n");

  if (opts.yes) {
    return;
  }

  if (!isTTY) {
    return;
  }

  const promptFn =
    opts.prompt ??
    (async (q: string) => {
      const rl = createInterface({ input, output });
      try {
        return await rl.question(q);
      } finally {
        rl.close();
      }
    });

  const answer = await promptFn("Register into ~/.codex now? [Y/n] ");
  if (!isAffirmative(answer)) {
    return;
  }

  const codexPath = (opts.whichCodex ?? defaultWhichCodex)();
  if (!codexPath) {
    write("\nWarning: `codex` was not found on PATH. Run the commands above manually.\n");
    return;
  }

  const runCommand = opts.runCommand ?? defaultRunCommand;
  const adds = codexMcpAddArgv(opts.projectRoot);

  for (const add of adds) {
    const argv = [codexPath, ...add.argv];
    const result = await runCommand(argv);
    if (!result.ok) {
      write(`\nWarning: codex mcp add ${add.name} failed: ${result.detail}\n`);
    }
  }
}
