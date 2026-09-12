import { existsSync } from "node:fs";
import { join } from "node:path";
import { type AgentKind, isAgentKind } from "./agent-configs.js";

export type DetectAgentsOptions = {
  pathEnv?: string;
  pathDelimiter?: string;
  platform?: NodeJS.Platform;
  homedir?: string;
};

function commandOnPath(
  name: string,
  pathEnv: string,
  delim: string,
  platform: NodeJS.Platform
): boolean {
  const exts = platform === "win32" ? ["", ".cmd", ".exe", ".bat"] : [""];
  for (const dir of pathEnv.split(delim)) {
    if (!dir) continue;
    for (const ext of exts) {
      if (existsSync(join(dir, `${name}${ext}`))) return true;
    }
  }
  return false;
}

function cursorAppPresent(platform: NodeJS.Platform, homedir: string): boolean {
  if (platform !== "darwin") return false;
  return (
    existsSync("/Applications/Cursor.app") ||
    existsSync(join(homedir, "Applications", "Cursor.app"))
  );
}

export function detectInstalledAgents(opts: DetectAgentsOptions = {}): AgentKind[] {
  const pathEnv = opts.pathEnv ?? process.env.PATH ?? "";
  const delim = opts.pathDelimiter ?? (process.platform === "win32" ? ";" : ":");
  const platform = opts.platform ?? process.platform;
  const homedir = opts.homedir ?? process.env.HOME ?? "";
  const found: AgentKind[] = [];
  if (commandOnPath("claude", pathEnv, delim, platform) || existsSync(join(homedir, ".claude"))) {
    found.push("claude");
  }
  if (commandOnPath("cursor", pathEnv, delim, platform) || cursorAppPresent(platform, homedir)) {
    found.push("cursor");
  }
  if (commandOnPath("codex", pathEnv, delim, platform) || existsSync(join(homedir, ".codex"))) {
    found.push("codex");
  }
  return found;
}

export function noAgentInstallHint(): string {
  return [
    "No supported agent found on this machine.",
    "Install Claude Code: https://code.claude.com/docs/en/overview",
    "Then re-run: npx @luno-cms/mcp setup",
    "Or pass --agent claude|cursor|codex if it is already installed.",
  ].join("\n");
}

export function selectDetectedAgent(answer: string, detected: AgentKind[]): AgentKind {
  if (detected.length === 0) throw new Error(noAgentInstallHint());
  const raw = answer.trim().toLowerCase() || "1";
  const asIndex = Number(raw);
  if (Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= detected.length) {
    return detected[asIndex - 1]!;
  }
  if (isAgentKind(raw) && detected.includes(raw)) return raw;
  throw new Error(`Unknown choice: ${answer}`);
}
