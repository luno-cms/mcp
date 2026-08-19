/**
 * Ensures every MCP tool's required Zod fields are mentioned in its description
 * (Issue #55 — agents must not need to introspect inputSchema alone).
 *
 * Heuristic: parse registerTool blocks in server.ts; for each key in inputSchema
 * whose property chain has no `.optional()`, require the key name to appear in description.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const serverPath = resolve(dirname(fileURLToPath(import.meta.url)), "server.ts");

type ToolBlock = {
  name: string;
  description: string;
  requiredKeys: string[];
};

function extractToolBlocks(source: string): ToolBlock[] {
  const tools: ToolBlock[] = [];
  const toolRe =
    /mcp\.registerTool\(\s*"([^"]+)"\s*,\s*\{([\s\S]*?)\}\s*,\s*(?:async\s*)?\(/g;
  let match: RegExpExecArray | null;
  while ((match = toolRe.exec(source)) !== null) {
    const name = match[1]!;
    const config = match[2]!;
    const descMatch = /description:\s*((?:`[\s\S]*?`)|(?:"(?:\\.|[^"\\])*")|(?:'(?:\\.|[^'\\])*'))/.exec(
      config
    );
    if (!descMatch) {
      throw new Error(`Tool ${name}: missing description`);
    }
    const raw = descMatch[1]!;
    const description = raw.startsWith("`")
      ? raw.slice(1, -1)
      : JSON.parse(raw.replace(/^'/, '"').replace(/'$/, '"'));

    const schemaMatch = /inputSchema:\s*\{([\s\S]*?)\n\s*\}/.exec(config);
    const requiredKeys: string[] = [];
    if (schemaMatch) {
      const schemaBody = schemaMatch[1]!;
      // Top-level keys: "key:" at indent of schema properties (skip nested object keys roughly)
      const keyRe = /^\s{6,10}([a-zA-Z_][a-zA-Z0-9_]*)\s*:/gm;
      let keyMatch: RegExpExecArray | null;
      while ((keyMatch = keyRe.exec(schemaBody)) !== null) {
        const key = keyMatch[1]!;
        const start = keyMatch.index + keyMatch[0].length;
        const nextKey = schemaBody.slice(start).search(/^\s{6,10}[a-zA-Z_][a-zA-Z0-9_]*\s*:/m);
        const propSrc =
          nextKey === -1 ? schemaBody.slice(start) : schemaBody.slice(start, start + nextKey);
        // Treat as required if this property assignment has no .optional( before end
        // (nullable unions with optional still have .optional())
        if (!/\.optional\s*\(/.test(propSrc)) {
          requiredKeys.push(key);
        }
      }
    }

    tools.push({ name, description, requiredKeys });
  }
  return tools;
}

describe("MCP tool descriptions (Issue #55)", () => {
  const source = readFileSync(serverPath, "utf8");
  const tools = extractToolBlocks(source);

  it("parses a substantial set of tools", () => {
    expect(tools.length).toBeGreaterThanOrEqual(35);
  });

  it("mentions every required inputSchema key in the tool description", () => {
    const failures: string[] = [];
    for (const tool of tools) {
      for (const key of tool.requiredKeys) {
        if (!tool.description.includes(key)) {
          failures.push(`${tool.name}: required "${key}" missing from description`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("documents UUID provenance for revision publish/save tools", () => {
    const publish = tools.find((t) => t.name === "publish_revision");
    const save = tools.find((t) => t.name === "save_revision");
    const applyBuiltin = tools.find((t) => t.name === "apply_builtin_form_template");
    const getSchema = tools.find((t) => t.name === "get_form_set_schema");
    expect(publish?.description).toMatch(/revisionRowId/);
    expect(publish?.description).toMatch(/save_revision/);
    expect(save?.description).toMatch(/revisionRowId|publish_revision/);
    expect(applyBuiltin?.description).toMatch(/slug/);
    expect(applyBuiltin?.description).toMatch(/name/);
    expect(getSchema?.description).toMatch(/formSetId/);
    expect(getSchema?.description).toMatch(/slug/);
  });
});
