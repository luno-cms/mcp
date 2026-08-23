/**
 * Golden Path smoke: drive @luno-cms/mcp over stdio (real MCP client).
 * Staging only — creates uniquely named Form Set / entry, then verifies Public API + funnel.
 *
 * Env:
 *   LUNO_API_URL   e.g. https://stg-api.luno.rest/admin
 *   LUNO_AGENT_KEY sk-agent-… (schema or full)
 *
 * Optional:
 *   LUNO_GOLDEN_PATH_TEMPLATE_SLUG  default: blog
 *   LUNO_GOLDEN_PATH_KEEP=1         skip best-effort cleanup DELETE
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { getLunoApiBase, getLunoAgentKey } from "./luno-api.js";
import { REQUIRED_MCP_RESOURCE_URIS } from "./mcp-resources.js";

const FUNNEL_EVENTS = [
  "agent_backend_selected",
  "site_created",
  "site_published",
] as const;

const EXPECTED_TOOLS = [
  "list_builtin_form_templates",
  "apply_builtin_form_template",
  "create_entry",
  "create_entry", // same idempotencyKey → replay same id
  "get_form_set_schema",
  "save_revision",
  "publish_revision",
  "get_public_api_info",
  "get_funnel_status",
  "create_contact_form",
] as const;

export type GoldenPathSmokeResult = {
  ok: true;
  funnelId: string;
  formSetId: string;
  formSetSlug: string;
  entryId: string;
  entrySlug: string;
  publicEntryUrl: string;
  toolCalls: string[];
};

function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

function parseToolJson(result: {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}): unknown {
  if (result.isError) {
    throw new Error(`MCP tool returned isError: ${JSON.stringify(result)}`);
  }
  const text = result.content?.find((c) => c.type === "text")?.text;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error(`MCP tool returned no text content: ${JSON.stringify(result)}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`MCP tool text is not JSON: ${text.slice(0, 200)}`);
  }
}

/** Drop placeholder media UUIDs / empty arrays from schema snapshot examples. */
export function stripPlaceholderMedia(
  snapshot: Record<string, Record<string, unknown>>
): Record<string, Record<string, unknown>> {
  const placeholder = "00000000-0000-0000-0000-000000000000";
  const out: Record<string, Record<string, unknown>> = {};
  for (const [formKey, block] of Object.entries(snapshot)) {
    const next: Record<string, unknown> = {};
    for (const [fieldKey, value] of Object.entries(block)) {
      if (value === placeholder) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      next[fieldKey] = value;
    }
    if (Object.keys(next).length > 0) out[formKey] = next;
  }
  return out;
}

type ContactFormFieldRow = { key?: string; label?: unknown };

/** GET /contact-forms/:id may return jsonb `fields` as an array or a JSON string. */
export function parseContactFormFields(raw: unknown): ContactFormFieldRow[] {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? (value as ContactFormFieldRow[]) : [];
}

async function callToolOnce(
  client: Client,
  name: string,
  args: Record<string, unknown>,
  toolCalls: string[]
): Promise<unknown> {
  toolCalls.push(name);
  const result = await client.callTool({ name, arguments: args });
  return parseToolJson(result as {
    content?: Array<{ type: string; text?: string }>;
    isError?: boolean;
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** MCP Resources (#90): list + read required URIs before tool chain. */
export async function assertMcpResourcesReady(
  client: Client
): Promise<void> {
  const listed = await client.listResources();
  const uris = new Set((listed.resources ?? []).map((r) => r.uri));
  for (const uri of REQUIRED_MCP_RESOURCE_URIS) {
    if (!uris.has(uri)) {
      throw new Error(`MCP resources/list missing required URI: ${uri}`);
    }
  }
  const read = await client.readResource({ uri: REQUIRED_MCP_RESOURCE_URIS[0] });
  const textEntry = read.contents?.find(
    (c): c is { uri: string; text: string; mimeType?: string } => "text" in c && typeof c.text === "string"
  );
  if (!textEntry || textEntry.text.length < 100) {
    throw new Error("MCP resources/read field-types returned empty body");
  }
}

type FunnelItem = {
  event_name?: string;
  properties?: Record<string, unknown>;
};

type FunnelStatus = {
  funnel_id?: string;
  items?: FunnelItem[];
};

function assertFunnelProperties(items: FunnelItem[]): void {
  const byName = new Map(items.map((i) => [i.event_name, i]));

  const selected = byName.get("agent_backend_selected");
  if (selected?.properties?.trigger_source !== "first_agent_api_call") {
    throw new Error(
      `agent_backend_selected.properties.trigger_source expected first_agent_api_call: ${JSON.stringify(selected?.properties)}`
    );
  }

  const created = byName.get("site_created");
  if (created?.properties?.fired_via !== "apply_builtin_form_template") {
    throw new Error(
      `site_created.properties.fired_via expected apply_builtin_form_template: ${JSON.stringify(created?.properties)}`
    );
  }
  if (!Array.isArray(created.properties?.capabilities_initialized)) {
    throw new Error(
      `site_created.properties.capabilities_initialized missing: ${JSON.stringify(created?.properties)}`
    );
  }

  const published = byName.get("site_published");
  if (typeof published?.properties?.is_first_publish !== "boolean") {
    throw new Error(
      `site_published.properties.is_first_publish missing: ${JSON.stringify(published?.properties)}`
    );
  }
  if (typeof published.properties?.time_to_publish_seconds !== "number") {
    throw new Error(
      `site_published.properties.time_to_publish_seconds missing: ${JSON.stringify(published?.properties)}`
    );
  }
}

async function waitForFunnel(
  client: Client,
  toolCalls: string[]
): Promise<FunnelStatus> {
  const maxAttempts = 20;
  let last: FunnelStatus = {};
  for (let i = 0; i < maxAttempts; i++) {
    // Only count the first get_funnel_status toward "zero retries" for the happy path;
    // subsequent polls are waitUntil lag, not tool failures.
    const data = (await callToolOnce(
      client,
      "get_funnel_status",
      {},
      i === 0 ? toolCalls : []
    )) as FunnelStatus;
    last = data;
    const names = new Set((data.items ?? []).map((x) => x.event_name).filter(Boolean));
    if (FUNNEL_EVENTS.every((ev) => names.has(ev))) {
      assertFunnelProperties(data.items ?? []);
      return data;
    }
    await sleep(500);
  }
  const have = (last.items ?? []).map((i) => i.event_name).join(", ");
  throw new Error(
    `funnel incomplete after retries (funnel_id=${last.funnel_id ?? "?"}; have=[${have}])`
  );
}

export async function runGoldenPathSmoke(): Promise<GoldenPathSmokeResult> {
  const apiUrl = getLunoApiBase();
  const agentKey = getLunoAgentKey();
  const templateSlug =
    (process.env.LUNO_GOLDEN_PATH_TEMPLATE_SLUG ?? "blog").trim() || "blog";
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const formSetSlug = `gp-smoke-${stamp}`;
  const formSetName = `Golden Path Smoke ${stamp}`;
  const entrySlug = `gp-entry-${stamp}`;
  const toolCalls: string[] = [];

  const cliPath = resolve(packageRoot(), "dist/cli.js");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cliPath],
    env: {
      ...process.env,
      LUNO_API_URL: apiUrl,
      LUNO_AGENT_KEY: agentKey,
    },
    stderr: "pipe",
  });

  const client = new Client({ name: "luno-golden-path-smoke", version: "0.2.29" });
  await client.connect(transport);

  await assertMcpResourcesReady(client);

  let formSetId = "";
  let entryId = "";
  let publicEntryUrl = "";
  let funnelId = "";

  try {
    const listed = (await callToolOnce(
      client,
      "list_builtin_form_templates",
      {},
      toolCalls
    )) as { items?: Array<{ slug?: string }> } | Array<{ slug?: string }>;
    const items = Array.isArray(listed) ? listed : (listed.items ?? []);
    const hasTemplate = items.some((i) => i.slug === templateSlug);
    if (!hasTemplate) {
      throw new Error(
        `Builtin template "${templateSlug}" not in list (got ${items.map((i) => i.slug).join(", ")})`
      );
    }

    const applied = (await callToolOnce(
      client,
      "apply_builtin_form_template",
      {
        templateSlug,
        slug: formSetSlug,
        name: formSetName,
      },
      toolCalls
    )) as { id?: string; formSet?: { id?: string }; formSetId?: string };
    formSetId =
      applied.formSetId ??
      applied.id ??
      applied.formSet?.id ??
      "";
    if (!formSetId) {
      throw new Error(`apply_builtin_form_template missing formSetId: ${JSON.stringify(applied)}`);
    }

    const entryIdempotencyKey = `gp-smoke-entry-${stamp}`;
    const created = (await callToolOnce(
      client,
      "create_entry",
      { formSetId, slug: entrySlug, idempotencyKey: entryIdempotencyKey },
      toolCalls
    )) as { id?: string };
    entryId = created.id ?? "";
    if (!entryId) {
      throw new Error(`create_entry missing id: ${JSON.stringify(created)}`);
    }

    const createdReplay = (await callToolOnce(
      client,
      "create_entry",
      { formSetId, slug: entrySlug, idempotencyKey: entryIdempotencyKey },
      toolCalls
    )) as { id?: string };
    if (createdReplay.id !== entryId) {
      throw new Error(
        `create_entry idempotency replay mismatch: first=${entryId} replay=${createdReplay.id}`
      );
    }

    const schema = (await callToolOnce(
      client,
      "get_form_set_schema",
      { formSetId },
      toolCalls
    )) as {
      snapshotShape?: { example?: Record<string, Record<string, unknown>> };
    };
    const example = schema.snapshotShape?.example;
    if (!example || Object.keys(example).length === 0) {
      throw new Error("get_form_set_schema missing snapshotShape.example");
    }
    const snapshot = stripPlaceholderMedia(example);
    if (Object.keys(snapshot).length === 0) {
      throw new Error("snapshot empty after stripping placeholder media fields");
    }

    // Make the published body identifiable in Public API / ops.
    const firstFormKey = Object.keys(snapshot)[0]!;
    const firstBlock = snapshot[firstFormKey]!;
    if (typeof firstBlock.title === "string") {
      firstBlock.title = `Golden Path Smoke ${stamp}`;
    }

    const saved = (await callToolOnce(
      client,
      "save_revision",
      { formSetId, entryId, snapshot },
      toolCalls
    )) as { id?: string; revision?: number };
    const revisionRowId = saved.id ?? "";
    const revision = saved.revision;
    if (!revisionRowId || typeof revision !== "number") {
      throw new Error(`save_revision missing id/revision: ${JSON.stringify(saved)}`);
    }

    const preview = (await callToolOnce(
      client,
      "get_pub_preview_url",
      { formSetId, entryId, revisionRowId, target: "luno" },
      toolCalls
    )) as { url?: string; expiresAt?: string | null; target?: string };
    if (!preview.url || typeof preview.url !== "string") {
      throw new Error(`get_pub_preview_url missing url: ${JSON.stringify(preview)}`);
    }

    await callToolOnce(
      client,
      "publish_revision",
      { formSetId, entryId, revisionRowId, revision },
      toolCalls
    );

    const pubInfo = (await callToolOnce(client, "get_public_api_info", {}, toolCalls)) as {
      publicApiBaseUrl?: string;
      projectId?: string;
    };
    const publicBase = (pubInfo.publicApiBaseUrl ?? "").replace(/\/$/, "");
    if (!publicBase) {
      throw new Error(`get_public_api_info missing publicApiBaseUrl: ${JSON.stringify(pubInfo)}`);
    }
    publicEntryUrl = `${publicBase}/form-sets/${encodeURIComponent(formSetSlug)}/entries/${encodeURIComponent(entrySlug)}`;

    type PubEntryBody = {
      slug?: string;
      published?: { snapshot?: unknown };
      error?: unknown;
    };
    let pubOk = false;
    let pubBody: PubEntryBody | null = null;
    for (let i = 0; i < 10; i++) {
      const pubRes = await fetch(publicEntryUrl);
      pubBody = (await pubRes.json().catch(() => null)) as PubEntryBody | null;
      if (pubRes.ok && pubBody?.published?.snapshot) {
        pubOk = true;
        break;
      }
      await sleep(400);
    }
    if (!pubOk) {
      throw new Error(
        `Public API GET failed or missing published.snapshot: ${JSON.stringify(pubBody)}`
      );
    }
    if (pubBody?.slug && pubBody.slug !== entrySlug) {
      throw new Error(`Public API slug mismatch: ${pubBody.slug} !== ${entrySlug}`);
    }

    const funnel = await waitForFunnel(client, toolCalls);
    funnelId = funnel.funnel_id ?? "";
    if (!funnelId) {
      throw new Error(`get_funnel_status missing funnel_id: ${JSON.stringify(funnel)}`);
    }

    const contactSlug = `gp-cf-${stamp}`;
    const contactCreated = (await callToolOnce(
      client,
      "create_contact_form",
      {
        slug: contactSlug,
        name: `Golden Path Contact ${stamp}`,
        recipient_email: "golden-path-smoke@example.com",
        fields: [
          {
            key: "name",
            type: "text",
            label: { ja: "お名前", en: "Name" },
            required: true,
          },
          {
            key: "email",
            type: "email",
            label: { ja: "メール", en: "Email" },
            required: true,
          },
          {
            key: "message",
            type: "textarea",
            label: { ja: "内容", en: "Message" },
            required: true,
          },
        ],
      },
      toolCalls
    )) as { id?: string; fields?: Array<{ key?: string }> };
    if (!contactCreated.id) {
      throw new Error(`create_contact_form missing id: ${JSON.stringify(contactCreated)}`);
    }
    const detailRes = await fetch(`${apiUrl}/v1/contact-forms/${contactCreated.id}`, {
      headers: { Authorization: `Bearer ${agentKey}`, Accept: "application/json" },
    });
    const detail = (await detailRes.json().catch(() => null)) as {
      fields?: unknown;
    } | null;
    if (!detailRes.ok || !detail) {
      throw new Error(
        `GET contact-form after create failed HTTP ${detailRes.status}: ${JSON.stringify(detail)}`
      );
    }
    const fields = parseContactFormFields(detail.fields);
    const fieldKeys = fields.map((f) => f.key).filter(Boolean);
    if (!fieldKeys.includes("email") || !fieldKeys.includes("message")) {
      throw new Error(
        `create_contact_form missing expected field keys: ${JSON.stringify(detail.fields)}`
      );
    }
    const emailField = fields.find((f) => f.key === "email");
    if (!emailField || typeof emailField.label !== "object" || emailField.label === null) {
      throw new Error(
        `create_contact_form email.label must be a locale object: ${JSON.stringify(emailField)}`
      );
    }
    console.error(
      `[golden-path-smoke] Contact Form left for manual cleanup if needed: slug=${contactSlug} id=${contactCreated.id}`
    );

    // First-attempt tool sequence (no failed retries). Extra get_funnel_status polls are not counted.
    if (toolCalls.length !== EXPECTED_TOOLS.length) {
      throw new Error(
        `unexpected toolCalls count ${toolCalls.length}: ${toolCalls.join(" → ")}`
      );
    }
    for (let i = 0; i < EXPECTED_TOOLS.length; i++) {
      if (toolCalls[i] !== EXPECTED_TOOLS[i]) {
        throw new Error(
          `toolCalls[${i}] expected ${EXPECTED_TOOLS[i]}, got ${toolCalls[i]} (${toolCalls.join(" → ")})`
        );
      }
    }

    if (process.env.LUNO_GOLDEN_PATH_KEEP !== "1") {
      // Agent keys cannot HTTP DELETE Form Sets (use archive_form_set). Best-effort entry bulk delete may 403.
      // Note: create_entry does not set is_test_data (admin test-data API only); identify via gp-smoke-* slugs.
      try {
        const del = await fetch(`${apiUrl}/v1/form-sets/${formSetId}/entries`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${agentKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ entry_ids: [entryId] }),
        });
        if (!del.ok) {
          console.error(
            `[golden-path-smoke] cleanup entries skipped HTTP ${del.status} (expected if agent key lacks admin)`
          );
        }
      } catch (e) {
        console.error("[golden-path-smoke] cleanup entries failed", e);
      }
      console.error(
        `[golden-path-smoke] Form Set left for manual cleanup if needed: slug=${formSetSlug} id=${formSetId}`
      );
    }

    return {
      ok: true,
      funnelId,
      formSetId,
      formSetSlug,
      entryId,
      entrySlug,
      publicEntryUrl,
      toolCalls,
    };
  } finally {
    await client.close().catch(() => undefined);
    await transport.close().catch(() => undefined);
  }
}

const isMain =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    const result = await runGoldenPathSmoke();
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}
