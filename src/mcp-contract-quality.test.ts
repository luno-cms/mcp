/**
 * MCP contract quality — input descriptions, outputSchema, structuredContent.
 * Not a Smithery score test. Agents must Discover / Understand / Call / Chain.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lunoJson = vi.hoisted(() => vi.fn());
const lunoFormData = vi.hoisted(() => vi.fn());

vi.mock("./luno-api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./luno-api.js")>();
  return {
    ...actual,
    lunoJson,
    lunoFormData,
    getLunoApiBase: () => "http://127.0.0.1:8787/admin",
    getLunoAgentKey: () => "sk-agent-test",
  };
});

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createLunoMcpServer } from "./server.js";
import { TOOL_REGISTRY } from "./tool-registry.js";
import { TOOL_OUTPUT_SCHEMAS } from "./mcp-output-schemas.js";
import { resetActiveAgentRunIdForTests } from "./luno-api.js";
import { lunoMcpConnectionConfigSchema } from "./mcp-config-schema.js";

const FS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ENTRY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REV = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type JsonSchema = {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
};

function missingPropertyDescriptions(schema: JsonSchema | undefined, path: string): string[] {
  if (!schema) return [];
  const missing: string[] = [];
  for (const [key, child] of Object.entries(schema.properties ?? {})) {
    const childPath = path ? `${path}.${key}` : key;
    if (!child.description?.trim()) {
      missing.push(childPath);
    }
    missing.push(...missingPropertyDescriptions(child, childPath));
    if (child.items) {
      missing.push(...missingPropertyDescriptions(child.items, `${childPath}[]`));
    }
  }
  return missing;
}

async function connectClient() {
  const server = createLunoMcpServer();
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "contract", version: "test" });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  return { client, server };
}

describe("MCP input / output contracts", () => {
  let client: Client;
  let server: ReturnType<typeof createLunoMcpServer>;

  beforeEach(async () => {
    lunoJson.mockReset();
    lunoFormData.mockReset();
    lunoJson.mockResolvedValue({
      ok: true,
      id: FS,
      slug: "mock",
      name: "mock",
      status: "draft",
      revision: 1,
      items: [],
      steps: ["submit_for_review"],
      url: "https://pub.example/preview",
      pendingHumanApproval: false,
      agentRun: { id: "88888888-8888-4888-8888-888888888888", status: "running" },
      changePlan: { id: "99999999-9999-4999-8999-999999999999", status: "pending_approval" },
    });
    lunoFormData.mockResolvedValue({ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" });
    resetActiveAgentRunIdForTests();
    const pair = await connectClient();
    client = pair.client;
    server = pair.server;
  });

  afterEach(async () => {
    await client.close();
    await server.close();
    resetActiveAgentRunIdForTests();
  });

  it("covers all 51 tools in TOOL_OUTPUT_SCHEMAS", () => {
    const names = TOOL_REGISTRY.map((r) => r.name).sort();
    expect(Object.keys(TOOL_OUTPUT_SCHEMAS).sort()).toEqual(names);
  });

  it("every inputSchema property has a description", async () => {
    const listed = await client.listTools();
    const failures: string[] = [];
    for (const tool of listed.tools) {
      const missing = missingPropertyDescriptions(tool.inputSchema as JsonSchema, tool.name);
      failures.push(...missing.map((p) => `${tool.name}: ${p}`));
    }
    expect(failures).toEqual([]);
  });

  it("every tool advertises outputSchema", async () => {
    const listed = await client.listTools();
    expect(listed.tools).toHaveLength(51);
    const missing = listed.tools
      .filter((t) => !t.outputSchema || (t.outputSchema as { type?: string }).type !== "object")
      .map((t) => t.name);
    expect(missing).toEqual([]);
  });

  it("representative tools return structuredContent that matches outputSchema", async () => {
    const cases: Array<{ name: string; args: Record<string, unknown>; fixture?: unknown }> = [
      {
        name: "get_project_overview",
        args: {},
      },
      {
        name: "get_form_set_schema",
        args: { formSetId: FS },
        fixture: {
          formSet: { id: FS, slug: "blog", name: "Blog" },
          forms: [{ key: "main", fields: [{ field_key: "title", type: "text" }] }],
          masters: [],
        },
      },
      {
        name: "create_entry",
        args: { formSetId: FS, slug: "hello" },
      },
      {
        name: "save_revision",
        args: { formSetId: FS, entryId: ENTRY, snapshot: { main: { title: "Hi" } } },
        fixture: { id: REV, revision: 1, status: "draft" },
      },
      {
        name: "get_pub_preview_url",
        args: { formSetId: FS, entryId: ENTRY, revisionRowId: REV },
        fixture: { url: "https://pub.example/preview" },
      },
      {
        name: "propose_change",
        args: {
          goal: "Add a blog",
          risk: "low",
          steps: [
            {
              action: "apply_form_blueprint",
              dry_run: { status: "ok", raw: { operations: [] } },
              mutation: { body: { blueprint: { version: "2026-05-12" } } },
            },
          ],
        },
        fixture: {
          changePlan: { id: "99999999-9999-4999-8999-999999999999", status: "pending_approval" },
        },
      },
      {
        name: "publish_revision",
        args: { formSetId: FS, entryId: ENTRY, revisionRowId: REV, revision: 1 },
        fixture: {
          steps: ["submit_for_review", "approve"],
          pendingHumanApproval: false,
          revision: { id: REV, revision: 2, status: "published" },
        },
      },
    ];

    const failures: string[] = [];
    for (const c of cases) {
      if (c.fixture !== undefined) lunoJson.mockResolvedValueOnce(c.fixture);
      const result = await client.callTool({ name: c.name, arguments: c.args });
      if (result.isError) {
        failures.push(`${c.name}: isError ${JSON.stringify(result.content)}`);
        continue;
      }
      const structured = result.structuredContent;
      if (!structured || typeof structured !== "object") {
        failures.push(`${c.name}: missing structuredContent`);
        continue;
      }
      const parsed = TOOL_OUTPUT_SCHEMAS[c.name as keyof typeof TOOL_OUTPUT_SCHEMAS].safeParse(
        structured
      );
      if (!parsed.success) {
        failures.push(`${c.name}: ${parsed.error.message}`);
      }
      const text = (result.content as Array<{ text?: string }>)[0]?.text ?? "";
      expect(text.length).toBeGreaterThan(0);
    }
    expect(failures).toEqual([]);
  });

  it("keeps text JSON compatible with structuredContent for delete_console_login_ip_allowlist", async () => {
    const result = await client.callTool({
      name: "delete_console_login_ip_allowlist",
      arguments: { ruleId: "77777777-7777-4777-8777-777777777777" },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      deleted: "77777777-7777-4777-8777-777777777777",
    });
    const text = (result.content as Array<{ text?: string }>)[0]?.text ?? "";
    expect(JSON.parse(text)).toEqual(result.structuredContent);
  });

  it("rejects invalid enum / UUID input", async () => {
    const result = await client.callTool({
      name: "end_agent_run",
      arguments: { runId: "not-a-uuid", status: "done" },
    });
    expect(result.isError).toBeTruthy();
  });

  it("advertises intentCapabilities, purposeLabels, and kind=update", async () => {
    const listed = await client.listTools();
    const byName = Object.fromEntries(listed.tools.map((t) => [t.name, t.description ?? ""]));
    expect(byName.get_project_overview).toContain("intentCapabilities");
    expect(byName.get_project_overview).toContain("create_contact_form");
    expect(byName.list_builtin_form_templates).toContain("purposeLabels");
    expect(byName.apply_form_blueprint).toContain("kind=update");
    expect(byName.apply_form_blueprint).toContain("migrate_field_to_master_reference");
    expect(byName.create_contact_form).toContain("お問い合わせ");
    expect(byName.create_contact_form).toMatch(/dryRun/);
    expect(byName.apply_builtin_form_template).toContain("お問い合わせには使わない");
    expect(byName.migrate_field_to_master_reference).toMatch(/dryRun/);
    expect(byName.rename_master_record_slug).toMatch(/dryRun/);
    expect(byName.propose_change).toContain("migrate_field_to_master_reference");
    expect(byName.propose_change).toContain("rename_master_record_slug");
  });
});

describe("connection config contract", () => {
  it("requires secret agent key and Admin URL; funnel is optional", () => {
    const required = lunoMcpConnectionConfigSchema.safeParse({
      LUNO_API_URL: "https://api.luno.rest/admin",
      LUNO_AGENT_KEY: "sk-agent-example",
    });
    expect(required.success).toBe(true);

    const missingKey = lunoMcpConnectionConfigSchema.safeParse({
      LUNO_API_URL: "https://api.luno.rest/admin",
    });
    expect(missingKey.success).toBe(false);

    const emptyKey = lunoMcpConnectionConfigSchema.safeParse({
      LUNO_API_URL: "https://api.luno.rest/admin",
      LUNO_AGENT_KEY: "",
    });
    expect(emptyKey.success).toBe(false);

    expect(lunoMcpConnectionConfigSchema.shape.LUNO_AGENT_KEY.description).toMatch(/secret/i);
    expect(lunoMcpConnectionConfigSchema.shape.LUNO_API_URL.description).toMatch(/\/admin/);
  });
});
