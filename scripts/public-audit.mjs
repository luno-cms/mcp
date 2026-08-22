#!/usr/bin/env node
/**
 * Fail if this package is not safe to publish as a standalone public repo.
 * Usage: node scripts/public-audit.mjs
 */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FIXTURE_KEYS = new Set([
  "sk-agent-xxxxxxxx",
  "sk-agent-abc",
  "sk-agent-test-key",
  "sk-agent-dev-1",
  "sk-agent-legacy",
]);

const FORBIDDEN_SUBSTRINGS = [
  "@luno/",
  "DATABASE_URL",
  "workers.dev",
  "HYPERDRIVE",
  "NPM_TOKEN",
  "docs/product/",
  "docs/marketing/",
  "plugins/luno-mcp",
];

const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);

/** @param {Record<string, unknown>} deps */
function assertNoPrivateDeps(deps, label) {
  if (!deps || typeof deps !== "object") return;
  for (const [name, spec] of Object.entries(deps)) {
    if (name.startsWith("@luno/")) {
      throw new Error(`${label} includes private package ${name}`);
    }
    if (String(spec).includes("workspace:")) {
      throw new Error(`${label} ${name} uses workspace: protocol`);
    }
  }
}

function assertNoRealAgentKey(text, file) {
  const re = /sk-agent-[a-zA-Z0-9]{8,}/g;
  for (const match of text.match(re) ?? []) {
    if (FIXTURE_KEYS.has(match)) continue;
    throw new Error(`${file}: forbidden agent-key-shaped token ${match.slice(0, 16)}…`);
  }
}

async function walk(dir, out) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      await walk(full, out);
    } else if (ent.isFile()) {
      if (ent.name === "public-audit.mjs") continue;
      out.push(full);
    }
  }
}

const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
const serverJson = JSON.parse(await readFile(path.join(ROOT, "server.json"), "utf8"));
if (serverJson.version !== pkg.version) {
  throw new Error(
    `server.json version (${serverJson.version}) must match package.json (${pkg.version}) for MCP Registry publish`
  );
}
const npmPkg = serverJson.packages?.[0];
if (npmPkg?.version !== pkg.version) {
  throw new Error(
    `server.json packages[0].version (${npmPkg?.version}) must match package.json (${pkg.version})`
  );
}
assertNoPrivateDeps(pkg.dependencies, "dependencies");
assertNoPrivateDeps(pkg.devDependencies, "devDependencies");
assertNoPrivateDeps(pkg.peerDependencies, "peerDependencies");

const files = [];
for (const rel of ["src", "templates", "scripts"]) {
  const abs = path.join(ROOT, rel);
  try {
    const s = await stat(abs);
    if (s.isDirectory()) await walk(abs, files);
  } catch {
    /* optional */
  }
}
for (const name of ["README.md", "server.json", "package.json", "CONTRIBUTING.md", "SECURITY.md"]) {
  files.push(path.join(ROOT, name));
}

const problems = [];
for (const file of files) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch {
    continue;
  }
  const rel = path.relative(ROOT, file);
  try {
    assertNoRealAgentKey(text, rel);
  } catch (e) {
    problems.push(e instanceof Error ? e.message : String(e));
  }
  for (const needle of FORBIDDEN_SUBSTRINGS) {
    if (text.includes(needle)) {
      problems.push(`${rel}: forbidden substring ${JSON.stringify(needle)}`);
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log("public-audit OK");
