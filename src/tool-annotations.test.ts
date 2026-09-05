/**
 * mcp#13 — every registered tool must expose behavior-accurate MCP annotations.
 * Do not stamp one hint tuple on all tools.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  TOOL_ANNOTATIONS,
  type ToolHintSet,
} from "./tool-annotations.js";

const serverPath = resolve(dirname(fileURLToPath(import.meta.url)), "server.ts");
const source = readFileSync(serverPath, "utf8");

const HINT_KEYS = [
  "readOnlyHint",
  "destructiveHint",
  "idempotentHint",
  "openWorldHint",
] as const;

function extractToolNames(src: string): string[] {
  return [...src.matchAll(/mcp\.registerTool\(\s*"([^"]+)"/g)].map((m) => m[1]!);
}

function hintTuple(h: ToolHintSet): string {
  return [
    h.readOnlyHint,
    h.destructiveHint,
    h.idempotentHint,
    h.openWorldHint,
  ].join(",");
}

describe("MCP tool annotations (mcp#13)", () => {
  const names = extractToolNames(source);

  it("parses all 51 registered tools", () => {
    expect(names).toHaveLength(51);
  });

  it("exports annotations for exactly the registered tool names", () => {
    expect(Object.keys(TOOL_ANNOTATIONS).sort()).toEqual([...names].sort());
  });

  it("wires annotations: TOOL_ANNOTATIONS.<name> on every registerTool", () => {
    const missing: string[] = [];
    for (const name of names) {
      const re = new RegExp(
        `mcp\\.registerTool\\(\\s*"${name}"\\s*,\\s*\\{[\\s\\S]*?annotations:\\s*TOOL_ANNOTATIONS\\.${name}\\b`
      );
      if (!re.test(source)) missing.push(name);
    }
    expect(missing).toEqual([]);
  });

  it("sets all four hints to booleans on every tool", () => {
    const failures: string[] = [];
    for (const name of names) {
      const hints = TOOL_ANNOTATIONS[name as keyof typeof TOOL_ANNOTATIONS];
      if (!hints) {
        failures.push(`${name}: missing`);
        continue;
      }
      for (const key of HINT_KEYS) {
        if (typeof hints[key] !== "boolean") {
          failures.push(`${name}.${key}: ${String(hints[key])}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("does not stamp one hint tuple on every tool", () => {
    const tuples = new Set(
      names.map((name) =>
        hintTuple(TOOL_ANNOTATIONS[name as keyof typeof TOOL_ANNOTATIONS])
      )
    );
    expect(tuples.size).toBeGreaterThanOrEqual(4);
  });

  it("classifies representative tools from the #13 audit", () => {
    expect(TOOL_ANNOTATIONS.get_tenant_schema).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(TOOL_ANNOTATIONS.validate_master_blueprint.readOnlyHint).toBe(true);
    expect(TOOL_ANNOTATIONS.migrate_field_to_master_reference.readOnlyHint).toBe(true);
    expect(TOOL_ANNOTATIONS.rename_master_record_slug.readOnlyHint).toBe(true);
    expect(TOOL_ANNOTATIONS.get_login_branding).toMatchObject({
      readOnlyHint: true,
      openWorldHint: false,
    });
    expect(TOOL_ANNOTATIONS.create_entry).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    });
    expect(TOOL_ANNOTATIONS.save_revision.idempotentHint).toBe(true);
    expect(TOOL_ANNOTATIONS.bulk_create_entries.idempotentHint).toBe(true);
    expect(TOOL_ANNOTATIONS.publish_revision).toMatchObject({
      readOnlyHint: false,
      idempotentHint: false,
    });
    expect(TOOL_ANNOTATIONS.archive_form_set).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    });
    expect(TOOL_ANNOTATIONS.delete_console_login_ip_allowlist.destructiveHint).toBe(
      true
    );
    expect(TOOL_ANNOTATIONS.propose_change).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
    });
    expect(TOOL_ANNOTATIONS.upload_media.openWorldHint).toBe(true);
    expect(TOOL_ANNOTATIONS.ask_admin_help.openWorldHint).toBe(true);
    expect(TOOL_ANNOTATIONS.translate_entry_locales.openWorldHint).toBe(true);
    expect(TOOL_ANNOTATIONS.update_master_record.readOnlyHint).toBe(false);
    expect(TOOL_ANNOTATIONS.update_master_tree.readOnlyHint).toBe(false);
    expect(TOOL_ANNOTATIONS.patch_project_content_locales.readOnlyHint).toBe(false);
  });
});
