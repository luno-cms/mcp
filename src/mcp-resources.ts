import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type McpResourceDef = {
  name: string;
  uri: string;
  description: string;
  body: string;
};

/** v1 required for Golden Path smoke (#90). */
export const REQUIRED_MCP_RESOURCE_URIS = [
  "luno://forms/field-types",
  "luno://publishing-guide",
] as const;

const FIELD_TYPES_BODY = `# LUNO field types

Source of truth: \`luno-cms/mcp\` package (this resource). Product DB enum must match.

## Types

| type | snapshot value | notes |
|------|----------------|-------|
| text | string | |
| url | string | |
| textarea | string | |
| tiptap | Tiptap doc JSON or string | rich text |
| number | number | |
| boolean | boolean | |
| date | \`YYYY-MM-DD\` or \`{ from, to }\` | range optional |
| select | string | choice **value** (not UUID) |
| radio | string | choice **value** |
| multiselect | string[] | choice **values** |
| image | asset UUID string | upload via \`upload_media\` first |
| file | asset UUID string | |
| image_gallery | \`{ assetId, caption? }[]\` or asset id strings | no client-generated ids |
| video_embed | embed URL string | |
| entry_ref | entry UUID string | Business+ |

## Choice sources (select / radio / multiselect)

- \`constraints.enum\`: string array, or
- \`masterEntityKey\` on the field (preferred). Use master record **value** in snapshots.

There is no field type named \`enum\` or \`master reference\`. Only the source of choices changes.

To migrate an existing static enum to a Master Reference, use \`migrate_field_to_master_reference\` (\`dryRun: true\` required) then \`propose_change(action: migrate_field_to_master_reference)\`. Do **not** use \`apply_form_blueprint\` for this migration.

To rename a Master Record identifier (public name \`slug\`, compat \`value\`), use \`rename_master_record_slug\` (\`dryRun: true\` required) then \`propose_change(action: rename_master_record_slug)\`. Do **not** PATCH \`update_master_record\`.

Before \`save_revision\`, call \`get_form_set_schema\` for \`snapshotShape\`, \`masterEntityKey\`, \`sampleValues\`.

## Localization

Only \`text\`, \`textarea\`, \`tiptap\` may set \`localizable: true\`. Per-locale values live inside snapshot when multilingual is enabled on the project.

## Related tools

- \`get_form_set_schema\` — per Form Set shape + examples
- \`get_tenant_schema\` — all Form Sets in project
- Resource \`luno://content/schema-guide\`
`;

const SCHEMA_GUIDE_BODY = `# LUNO content schema guide

## Hierarchy

\`\`\`
Project
 └── Form Set (content type)     slug, name
      └── Form (group)           key e.g. main
           └── Field             field_key + type + constraints
      └── Entry                  slug (unique per Form Set)
           └── Revision          snapshot JSON + status
\`\`\`

## Snapshot shape (critical)

\`save_revision\` snapshot is **always**:

\`\`\`json
{
  "main": {
    "title": "…",
    "body": { "type": "doc", "content": [] }
  }
}
\`\`\`

Top-level keys = **form.key** (not Form Set slug). Inner keys = **field_key** (not field label).

## Discover schema

| Goal | Tool / Resource |
|------|-----------------|
| Resume existing project | \`get_project_overview\` (\`intentCapabilities\` / \`nextMoves\` / \`hints.intent\`) |
| One Form Set detail | \`get_form_set_schema\` (formSetId UUID) |
| All Form Sets | \`get_tenant_schema\` or \`list_form_sets\` |
| Static field reference | \`luno://forms/field-types\` (this server) |

## Create structure (agents)

- Contact / inquiry / お問い合わせ: \`create_contact_form\` (needs \`recipient_email\`; \`dryRun: true\` first; only if status=ok / wouldSucceed). Not a Form Set template.
- Content (お知らせ / blog / …): \`list_builtin_form_templates\` → match \`purposeLabels\` → \`apply_builtin_form_template\` (\`dryRun: true\` first; only if status=ok)
- Custom structure: \`apply_form_blueprint\` (\`dryRun: true\` first). New slug → \`kind=create\`. Extra field/form on existing slug → \`kind=update\`. Existing textarea→tiptap → \`kind=migrate\`. Mixed type-change+add or other type changes → unsupported.
- Masters: \`apply_master_blueprint\`
- Existing static enum → Master Reference: \`migrate_field_to_master_reference\` (\`dryRun: true\` only) → \`propose_change(action: migrate_field_to_master_reference)\`. Not a Blueprint change.
- Rename Master Record identifier: \`rename_master_record_slug\` (\`dryRun: true\` only) → \`propose_change(action: rename_master_record_slug)\`. Not \`update_master_record\`.

**IDs:** MCP tools use UUIDs (\`formSetId\`, \`entryId\`). Public API uses slugs.

## Form Set archive (soft-delete)

Agents: \`archive_form_set\` with \`dryRun\` → \`confirmToken\` → execute. Not hard delete. Do not archive to change field types (\`textarea\`→\`tiptap\` is \`apply_form_blueprint\` migrate).

Restore archived Form Sets: **human Console or Admin API only**. Agent restore is 403 (\`reason: restore_requires_human_jwt\`). Archive responses include machine-readable \`restore\` (\`consolePath\` \`/form-sets/archived\`, \`POST /admin/v1/form-sets/{formSetId}/restore\`, help \`form-set.soft-delete-restore\`). Widgets are not restored.
`;

const PUBLISHING_GUIDE_BODY = `# LUNO publishing guide

## Golden rule

Content is never "instant published". Flow:

1. \`create_entry\` or use existing \`entryId\`
2. \`get_form_set_schema\` → build snapshot
3. \`save_revision\` → creates **draft** revision
4. \`get_pub_preview_url\` → human opens \`url\` in browser (Preview → Human review)
5. \`publish_revision\` → publish (or human approves in Console if \`can_publish=false\`)

There is no path that skips \`save_revision\`.

## Preview → Approval → Publish

\`\`\`text
save_revision → get_pub_preview_url → human opens url
      ↓
publish_revision (can_publish=true) OR Console approval (can_publish=false → pendingHumanApproval)
\`\`\`

- \`get_pub_preview_url\`: POST admin pub-preview-url. Unpublished drafts get a signed \`preview_token\` (≈15 min).
- \`target=external\` (default): form set \`detail_url_template\` if set, else LUNO host.
- \`target=luno\`: LUNO hosted pub URL only.
- Unpublished preview requires **Standard+** plan on the project.

## Revision statuses

| status | meaning |
|--------|---------|
| draft | editable default after save |
| pending_review | submitted |
| scheduled | approved, waiting \`publish_at\` |
| published | live on public API (one per entry) |
| rejected | needs reopen |
| superseded | former published |

## Agent key: can_publish

| can_publish | publish_revision behavior |
|-------------|---------------------------|
| false (default for new keys) | runs submit only → \`pendingHumanApproval: true\` |
| true | draft → submit → approve → publish in one call |

Humans approve in Console when \`pendingHumanApproval\` is returned.

## publish_revision inputs

Required: \`formSetId\`, \`entryId\`, \`revisionRowId\` (= \`save_revision\` id), \`revision\` (= number from save).

Optional: \`publishAt\` (ISO8601 schedule).

## Public visibility

After publish, entry appears on Public API:

- Use \`get_public_api_info\` for base URL (\`/public/p/{projectId}/v1\` on non-prod hosts)
- List: \`GET …/form-sets/{formSetSlug}/entries\`
- Detail: \`GET …/form-sets/{formSetSlug}/entries/{entrySlug}\`

Masters need separate \`site_published_at\` / \`apply_master_blueprint\` with \`publish: true\`.

## Undo / recovery

- Body mistakes: \`list_revisions\` → \`save_revision\` with older snapshot → \`publish_revision\`
- Archive Form Set: \`archive_form_set\` (soft, mistaken creates only). Restore: human only (403 for agents; see \`restore\` on archive response).
- Hard delete: not available to agents.

See resource \`luno://permissions\` and admin-help \`agent.undo-recovery\` via \`search_admin_help\`.
`;

const PERMISSIONS_BODY = `# LUNO agent permissions (MCP)

## Key scopes (new keys)

| scope | capabilities |
|-------|----------------|
| content | entries, revisions, media upload/list, master **create** |
| full | content + Form Set create/update/archive, Contact create/update, blueprints |

Legacy \`schema\` scope = same as \`full\` for existing keys.

## Agents cannot

- Hard-delete Form Sets (\`DELETE\` blocked)
- Restore archived Form Sets or deleted entries (tenant_admin human JWT only; 403 \`restore_requires_human_jwt\`)
- Delete Contact Forms
- Bulk-delete entries
- Update/delete master records directly (\`update_master_record\` → 401; use \`apply_master_blueprint\`)
- Manage webhooks, agent keys, members

## Destructive: archive_form_set

- Soft-delete (\`deleted_at\`), not hard delete
- Agent execute requires \`dryRun: true\` first → use returned \`confirmToken\` within 10 minutes
- Human JWT archive/delete does not need token
- Restore is human JWT only. Agent \`POST .../restore\` → 403 \`restore_requires_human_jwt\`. Read \`restore\` on the archive response (console path, API, constraints). Do not archive to change field types.

## Publish gate

- \`can_publish=false\` (default): agent stops at review; human publishes in Console
- Audit: agent actions logged (\`agent_key_id\` on revisions; Standard+ audit log UI)

## Rate limits

Agent API keys: per-key requests/minute (plan-based). On 429, respect \`Retry-After\`.

## Humans vs agents

| Action | Agent | Human (tenant_admin) |
|--------|-------|---------------------|
| Export project JSON | No | Yes (\`GET /v1/project-export\`) |
| Restore soft-deleted | No | Yes |
| Publish (if can_publish=false) | No | Yes |

Product docs: https://doc.luno.rest — Console help via \`search_admin_help\`.
`;

const API_REFERENCE_BODY = `# LUNO API reference (agent cheat sheet)

**Not a full OpenAPI dump.** Use this for orientation; call tools for live data.

## Bases

| API | URL |
|-----|-----|
| Admin (MCP) | \`LUNO_API_URL\` env, e.g. \`https://api.luno.rest/admin\` |
| Public read | \`get_public_api_info\` → \`/public/p/{projectId}/v1\` when not using custom domain |

Auth: \`Authorization: Bearer sk-agent-…\` + optional \`X-Project-Id\` when operating another project (superuser).

## Tool map (common)

| Task | Tool |
|------|------|
| Project inventory / intent | \`get_project_overview\` (\`intentCapabilities\`) |
| List Form Sets | \`list_form_sets\` |
| Schema for writes | \`get_form_set_schema\` |
| List/create entries | \`list_entries\`, \`create_entry\` |
| Save content | \`save_revision\` |
| Publish | \`publish_revision\` |
| Media | \`upload_media\`, \`list_media\` |
| Masters | \`apply_master_blueprint\`, \`list_masters\` |
| enum → Master | \`migrate_field_to_master_reference\` (\`dryRun: true\` only) then \`propose_change\` |
| Rename Master slug | \`rename_master_record_slug\` (\`dryRun: true\` only) then \`propose_change\` |
| Contact | \`create_contact_form\` (\`dryRun: true\` first), \`update_contact_form\` |
| Help articles | \`search_admin_help\` |
| Measure funnel | \`get_funnel_status\` |

## IDs vs slugs

- Admin MCP: **UUID** (\`formSetId\`, \`entryId\`, \`revisionRowId\`)
- Public API paths: **slugs** (\`formSetSlug\`, \`entrySlug\`)

## Errors

JSON \`{ "error": { "code", "message" } }\`. Common: \`VALIDATION_ERROR\` (Contact slug clash includes \`existing\` + \`alternatives\`; do not retry same slug), \`REVISION_CONFLICT\` (retry publish with fresh revision), \`UNAUTHORIZED\`, \`FORBIDDEN\`, \`RATE_LIMITED\`.

## Resources (read without side effects)

- \`luno://forms/field-types\`
- \`luno://content/schema-guide\`
- \`luno://publishing-guide\`
- \`luno://permissions\`
- \`luno://api-reference\` (this document)

Prefer Resources + \`get_form_set_schema\` over exploratory tool spam.
`;

export const LUNO_MCP_RESOURCES: McpResourceDef[] = [
  {
    name: "field-types",
    uri: "luno://forms/field-types",
    description: "Field types and snapshot value shapes for save_revision",
    body: FIELD_TYPES_BODY,
  },
  {
    name: "schema-guide",
    uri: "luno://content/schema-guide",
    description: "Form Set / form / field / entry / revision hierarchy and discovery tools",
    body: SCHEMA_GUIDE_BODY,
  },
  {
    name: "publishing-guide",
    uri: "luno://publishing-guide",
    description: "Draft → review → publish workflow and can_publish behavior",
    body: PUBLISHING_GUIDE_BODY,
  },
  {
    name: "permissions",
    uri: "luno://permissions",
    description: "Agent key scopes, blocked actions, archive confirmToken, audit",
    body: PERMISSIONS_BODY,
  },
  {
    name: "api-reference",
    uri: "luno://api-reference",
    description: "Lightweight Admin/Public API orientation for agents (not full OpenAPI)",
    body: API_REFERENCE_BODY,
  },
];

export function registerMcpResources(mcp: McpServer): void {
  for (const res of LUNO_MCP_RESOURCES) {
    mcp.registerResource(
      res.name,
      res.uri,
      {
        description: res.description,
        mimeType: "text/markdown",
      },
      async () => ({
        contents: [
          {
            uri: res.uri,
            mimeType: "text/markdown",
            text: res.body,
          },
        ],
      }),
    );
  }
}
