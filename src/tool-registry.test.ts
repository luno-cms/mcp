/**
 * mcp#15 — per-tool contract baseline (T0–T4). Not 49× staging E2E.
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
import { TOOL_ANNOTATIONS } from "./tool-annotations.js";
import { TOOL_REGISTRY } from "./tool-registry.js";
import { resetActiveAgentRunIdForTests } from "./luno-api.js";

const FS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ENTRY = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REV = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ENTITY = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const RECORD = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const FORM = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const RUN = "88888888-8888-4888-8888-888888888888";
const RULE = "77777777-7777-4777-8777-777777777777";
const PROJECT = "66666666-6666-4666-8666-666666666666";

const BLUEPRINT = {
  version: "2026-05-12" as const,
  formSet: { slug: "blog", name: "Blog" },
  forms: [
    {
      key: "main",
      sortOrder: 0,
      fields: [{ fieldKey: "title", type: "text" as const, sortOrder: 0 }],
    },
  ],
};

const MASTER_ENTITIES = [
  {
    key: "tags",
    name: "Tags",
    records: [{ value: "news", label: "News", sort_order: 0 }],
  },
];

const PROPOSE = {
  goal: "Add a blog",
  risk: "low" as const,
  steps: [
    {
      action: "apply_form_blueprint" as const,
      dry_run: { status: "ok" as const, raw: { operations: [] } },
      mutation: { body: { blueprint: BLUEPRINT } },
    },
  ],
};

async function connectClient() {
  const server = createLunoMcpServer();
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "mcp15", version: "test" });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  return { client, server, clientT, serverT };
}

async function closePair(
  client: Client,
  server: ReturnType<typeof createLunoMcpServer>
) {
  await client.close();
  await server.close();
}

describe("MCP tool registry (mcp#15)", () => {
  it("lists every registered tool exactly once (T0)", () => {
    const names = TOOL_REGISTRY.map((r) => r.name);
    expect(names).toHaveLength(50);
    expect(new Set(names).size).toBe(50);
    expect([...names].sort()).toEqual(Object.keys(TOOL_ANNOTATIONS).sort());
  });

  it("covers T2/T3/T4 at the required breadth", () => {
    expect(TOOL_REGISTRY.filter((r) => r.mutates).length).toBeGreaterThanOrEqual(20);
    expect(TOOL_REGISTRY.filter((r) => r.validation).length).toBeGreaterThanOrEqual(15);
    expect(TOOL_REGISTRY.filter((r) => r.safety).map((r) => r.name).sort()).toEqual(
      [
        "archive_form_set",
        "delete_console_login_ip_allowlist",
        "migrate_field_to_master_reference",
        "propose_change",
        "publish_revision",
      ].sort()
    );
  });

  it("T0: live server registers all tools with description + annotations", async () => {
    const { client, server } = await connectClient();
    try {
      const listed = await client.listTools();
      const byName = new Map(listed.tools.map((t) => [t.name, t]));
      expect(listed.tools).toHaveLength(50);
      const missing: string[] = [];
      for (const row of TOOL_REGISTRY) {
        const tool = byName.get(row.name);
        if (!tool) {
          missing.push(`${row.name}: not registered`);
          continue;
        }
        if (!tool.description || tool.description.trim().length === 0) {
          missing.push(`${row.name}: empty description`);
        }
        const hints = tool.annotations;
        if (
          !hints ||
          typeof hints.readOnlyHint !== "boolean" ||
          typeof hints.destructiveHint !== "boolean" ||
          typeof hints.idempotentHint !== "boolean" ||
          typeof hints.openWorldHint !== "boolean"
        ) {
          missing.push(`${row.name}: incomplete annotations`);
        }
      }
      expect(missing).toEqual([]);
    } finally {
      await closePair(client, server);
    }
  });

  it("T1: input tools expose typed JSON Schema properties", async () => {
    const { client, server } = await connectClient();
    try {
      const listed = await client.listTools();
      const byName = new Map(listed.tools.map((t) => [t.name, t]));
      const failures: string[] = [];
      for (const row of TOOL_REGISTRY) {
        const tool = byName.get(row.name);
        if (!tool) {
          failures.push(`${row.name}: missing`);
          continue;
        }
        const schema = tool.inputSchema as {
          type?: string;
          properties?: Record<string, unknown>;
        };
        if (row.noArg) {
          const keys = Object.keys(schema.properties ?? {});
          if (keys.length > 0) {
            failures.push(`${row.name}: expected no-arg, has ${keys.join(",")}`);
          }
          continue;
        }
        if (schema.type !== "object") {
          failures.push(`${row.name}: inputSchema.type=${String(schema.type)}`);
        }
        const props = schema.properties ?? {};
        if (Object.keys(props).length === 0 && !row.noArg) {
          // optional-only tools (list_media, get_login_branding, get_funnel_status) still have props
          failures.push(`${row.name}: empty properties`);
        }
      }
      expect(failures).toEqual([]);
    } finally {
      await closePair(client, server);
    }
  });
});

describe("MCP tool handlers T2/T3/T4 (mcp#15)", () => {
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
    });
    lunoFormData.mockResolvedValue({ id: RECORD });
    resetActiveAgentRunIdForTests();
    const pair = await connectClient();
    client = pair.client;
    server = pair.server;
  });

  afterEach(async () => {
    await closePair(client, server);
    resetActiveAgentRunIdForTests();
  });

  async function callTool(name: string, args: Record<string, unknown>) {
    return client.callTool({ name, arguments: args });
  }

  const mutatingCases: Array<{
    name: string;
    args: Record<string, unknown>;
    path: string | RegExp;
    method?: string;
    via?: "json" | "form";
  }> = [
    {
      name: "create_entry",
      args: { formSetId: FS, slug: "hello" },
      path: `/v1/form-sets/${FS}/entries`,
      method: "POST",
    },
    {
      name: "bulk_create_entries",
      args: { formSetId: FS, items: [{ slug: "a" }] },
      path: `/v1/form-sets/${FS}/entries/bulk-create`,
      method: "POST",
    },
    {
      name: "update_entry",
      args: { formSetId: FS, entryId: ENTRY, slug: "new-slug" },
      path: `/v1/form-sets/${FS}/entries/${ENTRY}`,
      method: "PATCH",
    },
    {
      name: "submit_entry_for_review",
      args: { formSetId: FS, entryId: ENTRY, revisionRowId: REV, revision: 1 },
      path: `/v1/form-sets/${FS}/entries/${ENTRY}/revisions/${REV}/submit`,
      method: "POST",
    },
    {
      name: "save_revision",
      args: { formSetId: FS, entryId: ENTRY, snapshot: { main: { title: "Hi" } } },
      path: `/v1/form-sets/${FS}/entries/${ENTRY}/revisions`,
      method: "POST",
    },
    {
      name: "apply_form_blueprint",
      args: { blueprint: BLUEPRINT },
      path: "/v1/form-blueprints/apply",
      method: "POST",
    },
    {
      name: "archive_form_set",
      args: { formSetId: FS, confirmToken: "tok" },
      path: `/v1/form-sets/${FS}/archive`,
      method: "POST",
    },
    {
      name: "propose_change",
      args: PROPOSE,
      path: "/v1/change-plans",
      method: "POST",
    },
    {
      name: "start_agent_run",
      args: { goal: "ship" },
      path: "/v1/agent-runs",
      method: "POST",
    },
    {
      name: "end_agent_run",
      args: { runId: RUN, status: "completed" },
      path: `/v1/agent-runs/${RUN}`,
      method: "PATCH",
    },
    {
      name: "apply_builtin_form_template",
      args: { templateSlug: "blog", slug: "my-blog", name: "Blog" },
      path: "/v1/form-set-templates/builtin/blog/apply",
      method: "POST",
    },
    {
      name: "apply_master_blueprint",
      args: { entities: MASTER_ENTITIES },
      path: "/v1/master-blueprints/apply",
      method: "POST",
    },
    {
      name: "create_contact_form",
      args: { slug: "contact", name: "Contact", recipient_email: "a@b.com" },
      path: "/v1/contact-forms",
      method: "POST",
    },
    {
      name: "update_contact_form",
      args: {
        formId: FORM,
        slug: "contact",
        name: "Contact",
        recipient_email: "a@b.com",
        fields: [],
      },
      path: `/v1/contact-forms/${FORM}`,
      method: "PUT",
    },
    {
      name: "create_master_record",
      args: { entityId: ENTITY, label: "News" },
      path: `/v1/master-entities/${ENTITY}/records`,
      method: "POST",
    },
    {
      name: "update_master_record",
      args: { entityId: ENTITY, recordId: RECORD, label: "News" },
      path: `/v1/master-entities/${ENTITY}/records/${RECORD}`,
      method: "PATCH",
    },
    {
      name: "update_master_tree",
      args: {
        entityId: ENTITY,
        updates: [{ id: RECORD, parent_record_id: null, sort_order: 0 }],
      },
      path: `/v1/master-entities/${ENTITY}/records/tree`,
      method: "PATCH",
    },
    {
      name: "update_login_appearance",
      args: { adminLoginBackground: "plain" },
      path: "/v1/project-login-appearance",
      method: "PATCH",
    },
    {
      name: "add_console_login_ip_allowlist",
      args: { projectId: PROJECT, cidr: "203.0.113.0/24" },
      path: "/v1/console-login-ip-allowlists",
      method: "POST",
    },
    {
      name: "delete_console_login_ip_allowlist",
      args: { ruleId: RULE },
      path: `/v1/console-login-ip-allowlists/${RULE}`,
      method: "DELETE",
    },
    {
      name: "patch_project_content_locales",
      args: { contentLocalesEnabled: true },
      path: "/v1/project-content-locales",
      method: "PATCH",
    },
    {
      name: "translate_entry_locales",
      args: {
        sourceLocale: "ja",
        targetLocales: ["en"],
        fields: [
          { formKey: "main", fieldKey: "title", type: "text", sourceText: "こんにちは" },
        ],
      },
      path: "/v1/content-ai/translate-locales",
      method: "POST",
    },
    {
      name: "publish_revision",
      args: { formSetId: FS, entryId: ENTRY, revisionRowId: REV, revision: 1 },
      path: `/v1/form-sets/${FS}/entries/${ENTRY}/revisions/${REV}/publish`,
      method: "POST",
    },
    {
      name: "upload_media",
      args: {
        base64: Buffer.from("hi").toString("base64"),
        filename: "n.txt",
        mimeType: "text/plain",
      },
      path: "/v1/media",
      via: "form",
    },
  ];

  it("T2: every mutating tool hits the expected Admin API path", async () => {
    const registryMutating = TOOL_REGISTRY.filter((r) => r.mutates).map((r) => r.name);
    expect(mutatingCases.map((c) => c.name).sort()).toEqual([...registryMutating].sort());

    const failures: string[] = [];
    for (const c of mutatingCases) {
      lunoJson.mockClear();
      lunoFormData.mockClear();
      if (c.name === "save_revision") {
        lunoJson.mockResolvedValue({ id: REV, revision: 1, status: "draft" });
      } else if (c.name === "publish_revision") {
        lunoJson.mockResolvedValue({
          steps: ["submit_for_review"],
          pendingHumanApproval: false,
          revision: { id: REV, revision: 1, status: "published" },
        });
      } else {
        lunoJson.mockResolvedValue({
          ok: true,
          id: ENTRY,
          status: "ok",
          items: [],
          agentRun: { id: RUN },
          changePlan: { id: RUN, status: "pending_approval" },
        });
      }
      const result = await callTool(c.name, c.args);
      if (result.isError) {
        failures.push(`${c.name}: tool error ${JSON.stringify(result.content)}`);
        continue;
      }
      if (c.via === "form") {
        if (!lunoFormData.mock.calls.some((call) => call[0] === c.path)) {
          failures.push(`${c.name}: lunoFormData not called with ${c.path}`);
        }
        continue;
      }
      const hit = lunoJson.mock.calls.some((call) => {
        const [path, init] = call as [string, { method?: string } | undefined];
        if (path !== c.path) return false;
        if (c.method && (init?.method ?? "GET") !== c.method) return false;
        return true;
      });
      if (!hit) {
        failures.push(
          `${c.name}: expected ${c.method ?? "GET"} ${c.path}; got ${JSON.stringify(lunoJson.mock.calls)}`
        );
      }
    }
    expect(failures).toEqual([]);
  });

  it("T3: invalid arguments fail for ≥15 tools", async () => {
    const invalid: Array<{ name: string; args: Record<string, unknown> }> = [
      { name: "get_form_set_schema", args: { formSetId: "not-a-uuid" } },
      { name: "list_entries", args: { formSetId: "slug-not-id" } },
      { name: "get_entry", args: { formSetId: FS, entryId: "x" } },
      { name: "create_entry", args: { formSetId: FS } },
      { name: "bulk_create_entries", args: { formSetId: FS, items: [] } },
      { name: "update_entry", args: { formSetId: FS, entryId: ENTRY } },
      { name: "submit_entry_for_review", args: { formSetId: FS, entryId: ENTRY } },
      { name: "save_revision", args: { formSetId: FS, entryId: ENTRY, snapshot: { title: "flat" } } },
      { name: "apply_form_blueprint", args: { blueprint: { version: "nope" } } },
      { name: "archive_form_set", args: { formSetId: "blog" } },
      { name: "propose_change", args: { goal: "x" } },
      { name: "start_agent_run", args: {} },
      { name: "end_agent_run", args: { runId: RUN } },
      { name: "get_agent_run", args: { runId: "nope" } },
      { name: "get_change_plan", args: { planId: "nope" } },
      { name: "apply_builtin_form_template", args: { slug: "x", name: "Y" } },
      { name: "validate_master_blueprint", args: { entities: [] } },
      { name: "migrate_field_to_master_reference", args: { formSetSlug: "staff-blog" } },
      { name: "apply_master_blueprint", args: { entities: [] } },
      { name: "create_contact_form", args: { slug: "c", name: "C" } },
      { name: "update_contact_form", args: { formId: FORM } },
      { name: "get_master_entity", args: { entityId: "x" } },
      { name: "list_master_records", args: { entityId: "x" } },
      { name: "create_master_record", args: { entityId: ENTITY } },
      { name: "update_master_record", args: { entityId: ENTITY } },
      { name: "update_master_tree", args: { entityId: "not-a-uuid", updates: [] } },
      { name: "search_admin_help", args: {} },
      { name: "get_admin_help_article", args: {} },
      { name: "ask_admin_help", args: {} },
      { name: "add_console_login_ip_allowlist", args: { projectId: PROJECT } },
      { name: "delete_console_login_ip_allowlist", args: { ruleId: "x" } },
      { name: "translate_entry_locales", args: { sourceLocale: "ja", targetLocales: [] } },
      { name: "publish_revision", args: { formSetId: FS, entryId: ENTRY, revisionRowId: REV } },
      { name: "upload_media", args: {} },
      { name: "list_revisions", args: { formSetId: FS } },
      { name: "get_pub_preview_url", args: { formSetId: FS, entryId: ENTRY } },
    ];

    const validationNames = new Set<string>(
      TOOL_REGISTRY.filter((r) => r.validation).map((r) => r.name)
    );
    expect(invalid.filter((i) => validationNames.has(i.name)).length).toBeGreaterThanOrEqual(15);

    const failures: string[] = [];
    for (const row of invalid) {
      const result = await callTool(row.name, row.args);
      if (!result.isError) {
        failures.push(`${row.name}: expected error, got ${JSON.stringify(result.content)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("T4: archive_form_set dryRun does not send confirmToken", async () => {
    await callTool("archive_form_set", { formSetId: FS, dryRun: true });
    expect(lunoJson).toHaveBeenCalledWith(`/v1/form-sets/${FS}/archive`, {
      method: "POST",
      json: { dryRun: true },
    });
  });

  it("T4: archive_form_set confirmToken is forwarded on real run", async () => {
    await callTool("archive_form_set", { formSetId: FS, confirmToken: "abc" });
    expect(lunoJson).toHaveBeenCalledWith(`/v1/form-sets/${FS}/archive`, {
      method: "POST",
      json: { dryRun: false, confirmToken: "abc" },
    });
  });

  it("T4: publish_revision uses server /publish (pendingHumanApproval stays server-side)", async () => {
    lunoJson.mockResolvedValue({
      steps: ["submit_for_review"],
      pendingHumanApproval: true,
      revision: { id: REV, revision: 1, status: "pending_review" },
    });
    const result = await callTool("publish_revision", {
      formSetId: FS,
      entryId: ENTRY,
      revisionRowId: REV,
      revision: 1,
    });
    expect(result.isError).toBeFalsy();
    expect(lunoJson).toHaveBeenCalledWith(
      `/v1/form-sets/${FS}/entries/${ENTRY}/revisions/${REV}/publish`,
      { method: "POST", json: { revision: 1 } }
    );
    const content = result.content as Array<{ type: string; text: string }>;
    const text = content[0]?.text ?? "";
    expect(text).toMatch(/pendingHumanApproval/);
  });

  it("T4: propose_change posts a plan and does not call apply_*", async () => {
    await callTool("propose_change", PROPOSE);
    expect(lunoJson).toHaveBeenCalledTimes(1);
    expect(lunoJson).toHaveBeenCalledWith("/v1/change-plans", expect.objectContaining({ method: "POST" }));
    const paths = lunoJson.mock.calls.map((c) => c[0]);
    expect(paths.some((p) => String(p).includes("blueprints/apply"))).toBe(false);
  });

  it("T4: migrate_field_to_master_reference dryRun:false is isError and does not call lunoJson", async () => {
    lunoJson.mockClear();
    const result = await callTool("migrate_field_to_master_reference", {
      formSetSlug: "staff-blog",
      fieldKey: "category",
      masterEntityKey: "staff_blog_category",
      dryRun: false,
    });
    expect(result.isError).toBeTruthy();
    expect(lunoJson).not.toHaveBeenCalled();
  });

  it("T4: migrate_field_to_master_reference posts dryRun:true preview only", async () => {
    lunoJson.mockClear();
    const result = await callTool("migrate_field_to_master_reference", {
      formSetSlug: "staff-blog",
      formKey: "main",
      fieldKey: "category",
      masterEntityKey: "staff_blog_category",
      mapping: { 日常: "日常", イベント: "イベント" },
      dryRun: true,
    });
    expect(result.isError).toBeFalsy();
    expect(lunoJson).toHaveBeenCalledTimes(1);
    const [path, init] = lunoJson.mock.calls[0] as [
      string,
      { method?: string; json?: { dryRun?: boolean } },
    ];
    expect(path).toBe("/v1/schema-migrations/to-master-reference");
    expect(init.method).toBe("POST");
    expect(init.json?.dryRun).toBe(true);
  });

  it("T4: delete_console_login_ip_allowlist uses HTTP DELETE", async () => {
    await callTool("delete_console_login_ip_allowlist", { ruleId: RULE });
    expect(lunoJson).toHaveBeenCalledWith(`/v1/console-login-ip-allowlists/${RULE}`, {
      method: "DELETE",
    });
  });
});
