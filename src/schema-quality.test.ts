/**
 * Issue #92 — systematic MCP tool schema quality checks.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const serverPath = resolve(dirname(fileURLToPath(import.meta.url)), "server.ts");
const source = readFileSync(serverPath, "utf8");

/** P0 mutating tools that must link to Resources or admin-help agent articles. */
const P0_MUTATING_TOOLS = [
  "save_revision",
  "apply_form_blueprint",
  "apply_master_blueprint",
  "create_contact_form",
  "update_contact_form",
  "upload_media",
  "publish_revision",
  "apply_builtin_form_template",
] as const;

type ToolBlock = { name: string; description: string; schemaSrc: string };

function extractTools(src: string): ToolBlock[] {
  const tools: ToolBlock[] = [];
  const toolRe =
    /mcp\.registerTool\(\s*"([^"]+)"\s*,\s*\{([\s\S]*?)\}\s*,\s*(?:async\s*)?\(/g;
  let match: RegExpExecArray | null;
  while ((match = toolRe.exec(src)) !== null) {
    const name = match[1]!;
    const config = match[2]!;
    const descMatch = /description:\s*((?:`[\s\S]*?`)|(?:"(?:\\.|[^"\\])*")|(?:'(?:\\.|[^'\\])*'))/.exec(
      config
    );
    if (!descMatch) continue;
    const raw = descMatch[1]!;
    const description = raw.startsWith("`")
      ? raw.slice(1, -1)
      : JSON.parse(raw.replace(/^'/, '"').replace(/'$/, '"'));
    const schemaMatch = /inputSchema:\s*([\s\S]*?)\n\s*\}/.exec(config);
    tools.push({
      name,
      description,
      schemaSrc: schemaMatch?.[1] ?? "",
    });
  }
  return tools;
}

describe("MCP schema quality (#92)", () => {
  const tools = extractTools(source);

  it("parses all registered tools", () => {
    expect(tools.length).toBeGreaterThanOrEqual(40);
  });

  it("P0 mutating tools do not use z.record(z.string(), z.unknown()) for primary payloads", () => {
    const weak = ["save_revision", "apply_form_blueprint", "validate_master_blueprint", "apply_master_blueprint"];
    const failures: string[] = [];
    for (const name of weak) {
      const tool = tools.find((t) => t.name === name);
      if (!tool) {
        failures.push(`${name}: not found`);
        continue;
      }
      if (/z\.record\(\s*z\.string\(\)\s*,\s*z\.unknown\(\)\s*\)/.test(tool.schemaSrc)) {
        failures.push(`${name}: still uses weak z.record(string, unknown)`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("P0 mutating tools reference Resources or agent.* help in description", () => {
    const linkRe = /luno:\/\/|agent\.[a-z0-9-]+/i;
    const failures: string[] = [];
    for (const name of P0_MUTATING_TOOLS) {
      const tool = tools.find((t) => t.name === name);
      if (!tool) {
        failures.push(`${name}: not found`);
        continue;
      }
      if (!linkRe.test(tool.description)) {
        failures.push(`${name}: missing luno:// or agent.* cross-link in description`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("uses dedicated schema modules for P0 payloads", () => {
    expect(source).toContain("snapshotSchema");
    expect(source).toContain("formBlueprintSchema");
    expect(source).toContain("masterBlueprintEntitiesSchema");
    expect(source).toContain("uploadMediaInputSchema");
    expect(source).toContain("applyBuiltinFormTemplateSchema");
  });
});
