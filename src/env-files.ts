import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type LunoEnvName = "dev" | "stg" | "prod";

export const LUNO_ENVS: LunoEnvName[] = ["dev", "stg", "prod"];

/** Canonical project dir for LUNO agent keys (tool-agnostic). */
export const AGENTS_LUNO_DIR = join(".agents", "luno");

const PLACEHOLDER_KEY = "sk-agent-xxxxxxxx";

const DEFAULT_URL: Record<LunoEnvName, string> = {
  dev: "http://127.0.0.1:8787/admin",
  stg: "https://stg-api.luno.rest/admin",
  prod: "https://api.luno.rest/admin",
};

export function isLunoEnvName(v: string): v is LunoEnvName {
  return v === "dev" || v === "stg" || v === "prod";
}

function stripSurroundingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function resolveMcpProjectRoot(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const fromEnv = env.LUNO_PROJECT_ROOT?.trim();
  if (!fromEnv || fromEnv.length === 0) return cwd;
  return stripSurroundingQuotes(fromEnv);
}

export function requireEnvName(v: string | undefined): LunoEnvName {
  if (!v || !isLunoEnvName(v)) {
    throw new Error(`env must be dev|stg|prod (got: ${v ?? "<empty>"})`);
  }
  return v;
}

export function agentsLunoDir(projectRoot: string): string {
  return join(projectRoot, ".agents", "luno");
}

/** @deprecated Prefer agentsLunoDir — kept for callers that still reference the old name */
export function cursorDir(projectRoot: string): string {
  return join(projectRoot, ".cursor");
}

export function envFilePath(projectRoot: string, env: LunoEnvName): string {
  return join(agentsLunoDir(projectRoot), `${env}.env`);
}

function legacyEnvFilePath(projectRoot: string, env: LunoEnvName): string {
  return join(projectRoot, ".cursor", `luno.${env}.env`);
}

export function activeFilePath(projectRoot: string): string {
  return join(agentsLunoDir(projectRoot), "active");
}

function legacyActiveFilePath(projectRoot: string): string {
  return join(projectRoot, ".cursor", "luno.active");
}

export function sharedEnvFilePath(projectRoot: string): string {
  return join(agentsLunoDir(projectRoot), "env");
}

function legacySharedEnvFilePath(projectRoot: string): string {
  return join(projectRoot, ".cursor", "luno.env");
}

export function isPlaceholderKey(key: string): boolean {
  const k = key.trim();
  return !k || k === PLACEHOLDER_KEY || !k.startsWith("sk-agent-");
}

export function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    out[key] = value;
  }
  return out;
}

export function formatEnvFile(vars: Record<string, string>): string {
  const comments: Record<string, string> = {
    LUNO_API_URL: "# Required. Admin API base ending in /admin",
    LUNO_AGENT_KEY:
      "# Required secret. sk-agent-… from Console → MCP / API / Hook → API / MCP. Never optional.",
  };
  return Object.entries(vars)
    .map(([k, v]) => {
      const comment = comments[k];
      return comment ? `${comment}\n${k}=${v}` : `${k}=${v}`;
    })
    .join("\n")
    .concat("\n");
}

function resolveEnvFileForRead(projectRoot: string, env: LunoEnvName): string | null {
  const canonical = envFilePath(projectRoot, env);
  if (existsSync(canonical)) return canonical;
  const legacy = legacyEnvFilePath(projectRoot, env);
  if (existsSync(legacy)) return legacy;
  return null;
}

/** Copy legacy `.cursor/luno.*` into `.agents/luno/` when canonical files are missing. */
export function migrateLegacyCursorEnv(projectRoot: string): string[] {
  const migrated: string[] = [];
  mkdirSync(agentsLunoDir(projectRoot), { recursive: true });
  for (const env of LUNO_ENVS) {
    const dest = envFilePath(projectRoot, env);
    const src = legacyEnvFilePath(projectRoot, env);
    if (!existsSync(dest) && existsSync(src)) {
      copyFileSync(src, dest);
      migrated.push(dest);
    }
  }
  const activeDest = activeFilePath(projectRoot);
  const activeSrc = legacyActiveFilePath(projectRoot);
  if (!existsSync(activeDest) && existsSync(activeSrc)) {
    copyFileSync(activeSrc, activeDest);
    migrated.push(activeDest);
  }
  const sharedDest = sharedEnvFilePath(projectRoot);
  const sharedSrc = legacySharedEnvFilePath(projectRoot);
  if (!existsSync(sharedDest) && existsSync(sharedSrc)) {
    copyFileSync(sharedSrc, sharedDest);
    migrated.push(sharedDest);
  }
  return migrated;
}

export function readProjectEnv(
  projectRoot: string,
  env: LunoEnvName
): { url: string; key: string; exists: boolean } {
  const path = resolveEnvFileForRead(projectRoot, env);
  if (!path) {
    return { url: DEFAULT_URL[env], key: PLACEHOLDER_KEY, exists: false };
  }
  const parsed = parseEnvFile(readFileSync(path, "utf8"));
  return {
    url: (parsed.LUNO_API_URL ?? DEFAULT_URL[env]).trim(),
    key: (parsed.LUNO_AGENT_KEY ?? PLACEHOLDER_KEY).trim(),
    exists: true,
  };
}

export function writeProjectEnv(
  projectRoot: string,
  env: LunoEnvName,
  opts: { url?: string; key?: string }
): string {
  mkdirSync(agentsLunoDir(projectRoot), { recursive: true });
  const current = readProjectEnv(projectRoot, env);
  const url = (opts.url ?? current.url ?? DEFAULT_URL[env]).trim() || DEFAULT_URL[env];
  const key = (opts.key ?? current.key ?? PLACEHOLDER_KEY).trim() || PLACEHOLDER_KEY;
  const path = envFilePath(projectRoot, env);
  writeFileSync(path, formatEnvFile({ LUNO_API_URL: url, LUNO_AGENT_KEY: key }), "utf8");
  return path;
}

export function ensureEnvFile(projectRoot: string, env: LunoEnvName): string {
  migrateLegacyCursorEnv(projectRoot);
  const path = envFilePath(projectRoot, env);
  if (!existsSync(path)) {
    return writeProjectEnv(projectRoot, env, {});
  }
  return path;
}

export function bootstrapEnvFiles(projectRoot: string): string[] {
  migrateLegacyCursorEnv(projectRoot);
  return LUNO_ENVS.map((env) => ensureEnvFile(projectRoot, env));
}

export function hasRealKey(projectRoot: string, env: LunoEnvName): boolean {
  const { key } = readProjectEnv(projectRoot, env);
  return !isPlaceholderKey(key);
}

export function setKey(projectRoot: string, env: LunoEnvName, key: string): string {
  if (isPlaceholderKey(key)) {
    throw new Error("refusing placeholder or invalid key (expect sk-agent-…)");
  }
  return writeProjectEnv(projectRoot, env, { key: key.trim() });
}

export function setUrl(projectRoot: string, env: LunoEnvName, url: string): string {
  if (!url.trim()) throw new Error("url required");
  return writeProjectEnv(projectRoot, env, { url: url.trim() });
}

export function getActiveEnv(projectRoot: string): LunoEnvName {
  migrateLegacyCursorEnv(projectRoot);
  const path = activeFilePath(projectRoot);
  if (!existsSync(path)) return "stg";
  const raw = readFileSync(path, "utf8").trim();
  return isLunoEnvName(raw) ? raw : "stg";
}

export function switchEnv(projectRoot: string, env: LunoEnvName): void {
  ensureEnvFile(projectRoot, env);
  if (!hasRealKey(projectRoot, env)) {
    throw new Error(
      `key missing for ${env} — set with: npx @luno-cms/mcp env set-key ${env} sk-agent-…`
    );
  }
  mkdirSync(agentsLunoDir(projectRoot), { recursive: true });
  writeFileSync(activeFilePath(projectRoot), `${env}\n`, "utf8");
  const src = envFilePath(projectRoot, env);
  copyFileSync(src, sharedEnvFilePath(projectRoot));
  // Keep legacy Cursor plugin path in sync when .cursor exists or for envFile consumers
  mkdirSync(join(projectRoot, ".cursor"), { recursive: true });
  copyFileSync(src, legacySharedEnvFilePath(projectRoot));
}

export function applyEnvToProcess(projectRoot: string, env: LunoEnvName): void {
  ensureEnvFile(projectRoot, env);
  const { url, key } = readProjectEnv(projectRoot, env);
  if (isPlaceholderKey(key)) {
    throw new Error(
      `Set a real LUNO_AGENT_KEY in ${envFilePath(projectRoot, env)} (or run /luno ${env})`
    );
  }
  process.env.LUNO_API_URL = url;
  process.env.LUNO_AGENT_KEY = key;
}

export function statusLines(projectRoot: string): string[] {
  const active = getActiveEnv(projectRoot);
  const lines = [
    `active: ${active}`,
    `dir: ${AGENTS_LUNO_DIR}/`,
    "",
    "ENV    KEY      MCP              LUNO_API_URL",
  ];
  for (const env of LUNO_ENVS) {
    const { url, key } = readProjectEnv(projectRoot, env);
    const mark = isPlaceholderKey(key) ? "missing" : "set";
    const mcp =
      mark === "set" ? `luno-${env} ok` : `luno-${env} fail*`;
    lines.push(
      `${env.padEnd(6)} ${mark.padEnd(8)} ${mcp.padEnd(16)} ${url || "(empty)"}`
    );
  }
  lines.push("");
  lines.push("MCP servers: luno-dev / luno-stg / luno-prod (always defined)");
  lines.push(`Prefer tools from luno-${active} when active is set.`);
  lines.push(
    "* fail = key missing — server may show failed in the client until env set-key."
  );
  lines.push(
    "If tools are missing: reopen the project / reload MCP after setup; confirm .mcp.json points at `npx -y @luno-cms/mcp run <env>`."
  );
  return lines;
}

export function defaultUrl(env: LunoEnvName): string {
  return DEFAULT_URL[env];
}

/** Ensure common gitignore entries for LUNO env secrets. */
export function ensureGitignore(projectRoot: string): void {
  const path = join(projectRoot, ".gitignore");
  const block = [
    "# LUNO MCP agent keys",
    ".agents/luno/*",
    "!.agents/luno/*.example",
    "# legacy (pre-.agents/luno)",
    ".cursor/luno.env",
    ".cursor/luno.active",
    ".cursor/luno.dev.env",
    ".cursor/luno.stg.env",
    ".cursor/luno.prod.env",
  ].join("\n");
  if (!existsSync(path)) {
    writeFileSync(path, `${block}\n`, "utf8");
    return;
  }
  const current = readFileSync(path, "utf8");
  if (current.includes(".agents/luno/*")) return;
  const sep = current.endsWith("\n") ? "\n" : "\n\n";
  writeFileSync(path, `${current}${sep}${block}\n`, "utf8");
}
