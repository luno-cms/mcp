import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = dirname(fileURLToPath(import.meta.url));

function collectTsImports(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    const importRe = /from\s+"(\.[^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = importRe.exec(src)) !== null) {
      const spec = match[1]!.replace(/\.js$/, ".ts");
      const next = resolve(dirname(file), spec);
      if (existsSync(next)) queue.push(next);
    }
  }
  return [...seen];
}

describe("stdio server import boundary (mcp#14)", () => {
  it("startLunoMcp graph does not include setup or shell registration", () => {
    const files = collectTsImports(resolve(srcDir, "server.ts"));
    const names = files.map((f) => f.slice(srcDir.length + 1));
    expect(names).not.toContain("setup.ts");
    expect(names).not.toContain("codex-home-register.ts");
    expect(names.some((n) => n.includes("cli.ts"))).toBe(false);
  });

  it("startLunoMcp graph does not call child_process", () => {
    const files = collectTsImports(resolve(srcDir, "server.ts"));
    const hits = files.filter((file) => {
      const src = readFileSync(file, "utf8");
      return /from\s+"node:child_process"|require\(["']child_process["']\)/.test(src);
    });
    expect(hits).toEqual([]);
  });
});
