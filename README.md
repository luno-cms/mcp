# LUNO — AI Backend Platform

**Build, operate, and govern production backends with AI agents.**

LUNO is a hosted backend platform — not a website builder, not an open-source CMS, and not an MCP server product. MCP is how your agent connects to LUNO. CMS and forms are capabilities; the product category is **AI-era Backend Platform**.

| | |
|---|---|
| **BUILD** | AI agents define schemas, forms, and backend structure via blueprints and templates. |
| **OPERATE** | Agents read and change content, media, auth settings, and other backend resources. |
| **GOVERN** | Humans control production through scoped agent keys, approval workflows, publish gates, and safety controls. |

### Quick start

```bash
npx @luno-cms/mcp setup
```

Works with **Claude Code**, **Cursor**, and **Codex**. Issue an agent key in the LUNO Console → **MCP / API / Hook** → **API / MCP**.

> **Glama / MCP directory:** “Install Server” requires a hosted API key and may show *This server cannot be installed*. Use `npx @luno-cms/mcp setup` instead — see [Quick start (recommended)](#quick-start-recommended) below.

### Production safety by design

- **Scoped agent keys** — restrict to content-only or full backend access
- **Human approval** — keys without publish permission stop at review (`pendingHumanApproval`)
- **Destructive-action protection** — agents cannot hard-delete; archive requires confirmation
- **Dry runs & confirmation tokens** — preview schema changes before applying
- **Idempotent operations** — safe retries after timeouts
- **Audit trail** — agent activity and audit logs in Console

### Agent-readable by design

MCP schemas and tool descriptions were redesigned for agent readability. In a blind test, the same backend task went from **142 tool calls to 11**, with **0 errors** — application behavior unchanged.

### MCP Resources (#90)

Static **Resources** (`resources/list`, `resources/read`) ship agent-readable guides without Admin API calls:

| URI | Topic |
|-----|--------|
| `luno://forms/field-types` | Field types + snapshot shapes |
| `luno://content/schema-guide` | Form Set / entry / revision hierarchy |
| `luno://publishing-guide` | Draft → publish, `can_publish` |
| `luno://permissions` | Scopes, blocked actions, archive token |
| `luno://api-reference` | Tool cheat sheet (not full OpenAPI) |

Inventory: [docs/RESOURCES.md](./docs/RESOURCES.md). Live per-tenant schema: `get_form_set_schema` tool.

---

- npm: [`@luno-cms/mcp`](https://www.npmjs.com/package/@luno-cms/mcp) (not the unrelated cryptocurrency “Luno” MCP)
- Official MCP Registry: [`io.github.luno-cms/mcp`](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.luno-cms/mcp)
- Glama: [`luno-cms/mcp`](https://glama.ai/mcp/servers/luno-cms/mcp)
- mcpservers.org: [`luno-rest`](https://mcpservers.org/servers/luno-rest) · [![Listed on mcpservers.org](https://mcpservers.org/badge.svg)](https://mcpservers.org/servers/luno-rest)
- Source: [`github.com/luno-cms/mcp`](https://github.com/luno-cms/mcp)
- Site: [luno.rest](https://luno.rest) · Docs: [doc.luno.rest](https://doc.luno.rest)

Directory checklist: [docs/DISCOVERY.md](./docs/DISCOVERY.md)

**Product docs (EN):** [AI Agents](https://doc.luno.rest/en/api/ai-agents) · [doc.luno.rest](https://doc.luno.rest)  
**Product docs (JA):** [AI Agents](https://doc.luno.rest/ja/api/ai-agents)

---

## Quick start (recommended)

From your **site repository root**, pick **one** AI agent and run setup (Claude Code / Cursor / Codex):

```bash
cd my-site
npx @luno-cms/mcp setup
# → 1) Claude Code  2) Cursor  3) Codex
```

| Choice | What gets written |
|--------|-------------------|
| Claude Code | `.claude/skills/luno/` + `.mcp.json` |
| Cursor | `.cursor/skills/luno/` + `.cursor/mcp.json` |
| Codex | `.agents/skills/luno/` + `.codex/config.toml` |

Shared: `.agents/luno/{dev,stg,prod}.env` (keys; gitignored)

Then:

1. Open the project in the chosen agent  
2. Run `/luno` (Codex: equivalent luno skill)  
3. Paste an `sk-agent-…` key from the LUNO Console  
4. Ask to create content — the agent uses MCP servers such as `luno-stg`

**Verified clients:** Claude Code / Cursor / Codex (Golden Path E2E).

### Post-setup notes by client

| Client | Notes |
|--------|-------|
| Claude Code | If tools are missing, reconnect (`/mcp`) |
| Cursor | Settings → MCP: enable `luno-stg`. Start a new Agent chat if needed |
| Codex | Project `.codex/config.toml` (with `cwd`) plus home config: Codex prefers **`~/.codex/config.toml`**, so setup prints `codex mcp add` (with `LUNO_PROJECT_ROOT`) and guides home registration. Check: `codex mcp list` (`luno-stg`, etc.). First MCP tool calls may need **approval**. Prefer **`luno-stg`** day-to-day |

```text
/luno                 first run (init optional)
/luno init-stg        initialize stg only
/luno dev|stg|prod    switch env (prompts for key if missing)
/luno status
```

Non-interactive:

```bash
npx @luno-cms/mcp setup --agent claude --yes
npx @luno-cms/mcp env set-key stg 'sk-agent-…'
npx @luno-cms/mcp env switch stg
npx @luno-cms/mcp env status
```

Issue keys in Console → **Settings → Agent API keys** (per env / per site). Default scope **full** (content + form definitions). Use **content** to restrict to articles only.

**Rate limits:** per agent key to Admin API — **60 req / 60s** (Free / Solo) or **300 / 60s** (Standard+). Over limit → HTTP **429** + `RATE_LIMITED` + `Retry-After`. Console JWT traffic is not limited this way. Details: [AI Agents rate limits](https://doc.luno.rest/en/api/ai-agents#rate-limits).

| Scope | When to use |
|-------|-------------|
| **full** (recommended) | Articles + Form Set / Contact / Blueprint |
| **content** | Create / update / publish articles only |
| **schema** | Same privileges as `full` (compat) |

---

## Environment / CLI

| Variable | Example | Description |
|----------|---------|-------------|
| `LUNO_API_URL` | `http://127.0.0.1:8787/admin` | Admin API base (include `/admin`) |
| `LUNO_AGENT_KEY` | `sk-agent-…` | Agent API key |

```text
npx @luno-cms/mcp              # start MCP from env vars
npx @luno-cms/mcp run stg      # load .agents/luno/stg.env then start
npx @luno-cms/mcp setup
npx @luno-cms/mcp env …
```

MCP server names: `luno-dev` / `luno-stg` / `luno-prod`

---

## Cursor Plugin (optional)

For Cursor Marketplace / local plugin setup, see the LUNO Console onboarding. For normal site work, prefer `npx @luno-cms/mcp setup` above.

### Multiple keys at once

One MCP entry = one key. Split by site or scope with different MCP server names. Active key limits depend on plan.

### Resuming an existing project

1. `get_project_overview` — project summary + `intentCapabilities` (recommended first)  
2. Contact / inquiry → `create_contact_form` (`dryRun: true` first). Content → match `purposeLabels` then a template  
3. Then `get_form_set_schema` / `list_entries` as needed  
4. Separate from greenfield Golden Path (builtin template → entry → publish)

## Tools

### Content (`content` scope and above)

| Tool | Description |
|------|-------------|
| `get_project_overview` | Project summary + `intentCapabilities` (Contact vs Form Set) / nextMoves / Form Sets / Contact / Masters / storage / locales / public API |
| `get_tenant_schema` | Full project schema |
| `list_form_sets` / `get_form_set_schema` | Form Set list / definition (`get_form_set_schema` includes form-set `schema-context` + `snapshotShape.example`; selects may include `masterEntityKey` / public records URL) |
| `get_public_api_info` | Agent key `projectId` + public API base (entries / master-entities) |
| `list_entries` / `get_entry` | Entry list / detail |
| `create_entry` / `bulk_create_entries` / `update_entry` | Create entry / bulk create (≤50 slugs) / update slug |
| `list_revisions` / `save_revision` / `get_pub_preview_url` / `publish_revision` | Revisions / preview URL for human review / publish (`can_publish=false` keys stop at submit + `pendingHumanApproval`) |
| `submit_entry_for_review` | Submit for approval |
| `list_media` | Media list |
| `upload_media` | Upload (`filePath` / `sourceUrl` / `base64` → asset id) |
| `list_master_entities` / `get_master_entity` | Master entities |
| `list_master_records` / `create_master_record` | List / create records (`label` string or `{ default, ja, … }`) |
| `update_master_record` / `update_master_tree` | Update records / tree (**not available with agent keys** — see below) |
| `get_project_content_locales` | Content locale settings (includes `content_default_locale`) |
| `patch_project_content_locales` | Update locales (**tenant_admin JWT only**) |
| `search_admin_help` | Search Console help KB |
| `get_admin_help_article` | One help article (Markdown) |
| `ask_admin_help` | Help RAG Q&A (related articles if LLM unset) |
| `translate_entry_locales` | AI locale batch translate (**Standard+**, 1 ticket / run) |
| `get_login_branding` | Login branding (no auth; includes `login_background` / `hide_luno_logo` / `hide_powered_by`) |
| `get_login_appearance` | Login appearance settings (auth required) |
| `update_login_appearance` | Update login appearance (background=Standard+, WL=Business+) |
| `list_console_login_ip_allowlists` | Login IP allowlist (**Business+**) |
| `add_console_login_ip_allowlist` | Add IP rule (tenant scope) |
| `delete_console_login_ip_allowlist` | Delete IP rule |

**Master update limits:** agent keys have no `userId`; `update_master_record` / `update_master_tree` need a user JWT with `master_record_edit_allowed` or tenant_admin. List / create (`create_master_record`) work with content scope. **Creating master definitions** uses **`apply_master_blueprint` (schema scope)**, not `POST /master-entities`.

**Multilingual master labels:** `label` may be a plain string (default locale) or a locale map. When site multilingual is OFF, only default is stored. Blueprint `record.label` stays a plain string (normalized internally).

**Locale translation:** call `translate_entry_locales` with a content-scope agent key, merge returned `items` into the snapshot, then `save_revision`. Returns 400 if site multilingual is OFF.

### Golden Path smoke (staging)

E2E over a real MCP stdio client:

```bash
# LUNO_API_URL + LUNO_AGENT_KEY (dedicated smoke project recommended)
pnpm golden-path-smoke
```

Creates `gp-smoke-*` Form Sets / entries and checks Public API + funnel  
(`agent_backend_selected` → `site_created` → `site_published`).  
**Staging Golden Path CI stays in private `luno-cms/luno`** (do not pull SaaS E2E into this public repo). CI here is unit test / typecheck / `pnpm public-audit`.

### Troubleshooting for agents

| Symptom | Next step | Retry same input? |
|---------|-----------|-------------------|
| Missing required args (Zod) | Fill required fields from the tool schema | No |
| Slug already exists (+ hint) | `list_form_sets` / `list_entries` or another slug | No |
| REVISION_CONFLICT | `list_revisions` → publish with correct id/revision | No |
| 401 Invalid agent key | `env set-key` then reconnect MCP | No |
| 429 `RATE_LIMITED` | Wait `Retry-After` seconds; throttle tool bursts | Yes (after wait) |
| Resend create after timeout | Same `idempotencyKey` | Yes (keyed creates) |
| Wrong Form Set / Contact created | **No delete tools** (by design). Site admin deletes in Console, or leave orphan. `search_admin_help` → **agent.undo-recovery** | No |
| Published wrong article | `list_revisions` → `save_revision` with correct snapshot → `publish_revision` | Yes |

APIs may return `error.hint` / `error.retryable`. See [AI Agents docs](https://doc.luno.rest/en/api/ai-agents).

**Verify changes:** Console → **Settings → Agent activity** (Free/Solo: last 7 days). Standard+ also has **Audit logs → Agents only**.

### Idempotency (retries)

The Console does not send keys. Without a key, behavior is unchanged. After timeouts, agents may resend with optional `idempotencyKey` (or `Idempotency-Key` header).

| MCP tool | No key | Same key replay |
|----------|--------|-----------------|
| `apply_form_blueprint` | Apply each time / slug clash → 409 | Replay same 201 body |
| `apply_builtin_form_template` | Same | Same |
| `create_entry` | New / slug clash → 409 | Same entry `id` |
| `save_revision` | Always new revision | Same revision row |
| `create_contact_form` | New / slug clash → 409 | Same `id` |
| `publish_revision` | Existing `already_published` / outbox dedupe | (no separate key needed) |

### Schema tools (**`schema` scope required**)

| Tool | Admin API |
|------|-----------|
| `apply_form_blueprint` | `POST /v1/form-blueprints/apply` (`dryRun: true` preview) |
| `validate_master_blueprint` | `POST /v1/master-blueprints/validate` |
| `apply_master_blueprint` | `POST /v1/master-blueprints/apply` (`dryRun: true` count preview; success `records[]` with id/value) |
| `migrate_field_to_master_reference` | `POST /v1/schema-migrations/to-master-reference` (**`dryRun: true` required**. Preview only — execute via `propose_change`) |
| `list_builtin_form_templates` | `GET /v1/form-set-templates/builtin` |
| `apply_builtin_form_template` | Preferred: `templateSlug` → `POST /v1/form-set-templates/builtin/:slug/apply`. Compat: `templateId` → `POST /v1/form-set-templates/:id/apply` (`dryRun: true` OK) |
| `archive_form_set` | `POST /v1/form-sets/:id/archive` (agents: `dryRun: true` → `confirmToken` for real run; soft-delete via `deleted_at`; HTTP DELETE not allowed) |
| `propose_change` | `POST /v1/change-plans` (**does not execute** mutations; human approves in Console) |
| `get_change_plan` | `GET /v1/change-plans/:id` (own proposed plans only) |
| `start_agent_run` | `POST /v1/agent-runs` (sets `X-Agent-Run-Id` on subsequent tool calls in this MCP process) |
| `end_agent_run` | `PATCH /v1/agent-runs/:runId` (terminal status; clears active run header) |
| `get_agent_run` | `GET /v1/agent-runs/:runId` (own runs only; includes metrics) |
| `get_funnel_status` | `GET /v1/measurement/funnels/:funnelId` (defaults to MCP session funnel) |
| `create_contact_form` | `POST /v1/contact-forms` (`dryRun: true` preview — no INSERT. `fields`: `{ key, type, label:{ja,en}, required }` — not Form Set `fieldKey`. `autoreply_*` / `email_signature` OK) |
| `update_contact_form` | `PUT /v1/contact-forms/:id` (same fields shape; thank-you email settings) |

**Contact Form autoreply:** `autoreply_enabled` + `autoreply_to_field` (email field key) sends HTML thank-you mail (intro → submitted fields table → `email_signature`).

**Contact Form `fields`:** not Form Set / Blueprint `fieldKey` shape. Each item is `{ key, type, label: { ja, en }, required }`. See admin-help **`agent.contact-form-mcp`**.

**Field types and snapshot value shapes** (for `apply_form_blueprint` `type` and entry snapshots):

| type | Snapshot value | Notes |
|------|----------------|-------|
| `text` / `url` / `textarea` / `select` / `radio` | string | select/radio use master **value** (`sampleValues` / public `master-entities/{key}/records`) |
| `tiptap` | Tiptap doc (JSON) or string | rich text |
| `number` | number | |
| `boolean` | boolean | |
| `date` | `"YYYY-MM-DD"` or `{"from":…,"to":…}` | |
| `multiselect` | string[] | `minItems` / `maxItems` OK |
| `image` / `file` | asset UUID string | from `upload_media` `id` |
| `image_gallery` | UUID strings or `{ assetId, caption? }[]` | **no `id` key**; upload first |
| `entry_ref` | referenced entry id string | |

**Snapshot nesting:** always `{ [formKey]: { [fieldKey]: value } }`. Use `snapshotShape.example` from `get_form_set_schema`. Flat top-level fieldKeys → 400.

**Images:** do not put external image URLs in the snapshot. `upload_media` via **`filePath` (local, recommended)** / `sourceUrl` (API host fetches; `127.0.0.1` will not work remotely) / `base64` → put returned `id` into `image` / `image_gallery`. Gallery captions: `{ assetId, caption }` (`id` → 400).

Published entry JSON includes `published.mediaUrls` (asset id → CDN URL) under `/public/p/{projectId}/v1`. Use `publicApiBaseUrl` from `get_public_api_info` locally.

**Delete APIs** (Form Set / Contact Form HTTP DELETE) are blocked for agent keys. Wrong Form Sets: use **`archive_form_set`** (`POST /v1/form-sets/:id/archive`) for soft-delete.

### dryRun (schema preview)

`apply_form_blueprint`, `apply_master_blueprint`, `apply_builtin_form_template`, `archive_form_set`, `create_contact_form`, and `migrate_field_to_master_reference` accept `dryRun: true` for a **no-write** preview. Real agent `archive_form_set` runs require the **`confirmToken`** from dryRun. Contact Form delete is still human-only — do not skip dryRun. `migrate_field_to_master_reference` **requires** `dryRun: true` (false / omitted is rejected; it never executes — use `propose_change`).

- Form Blueprint: `operations` list  
- Master Blueprint: `results` (create / update / skip counts)
- Contact Form: `status` / `wouldSucceed` (no `id`). Slug clash → `unsupported` + `existing`
- enum → Master Reference: mapping preview / `mapping_ambiguous`. Execute only after human Change Plan approval

```json
{ "dryRun": true, "operations": [{ "op": "create_form_set", "slug": "blog", "name": "Blog" }, "..."] }
```

---

## Local development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build

LUNO_API_URL=http://127.0.0.1:8787/admin \
LUNO_AGENT_KEY=sk-agent-xxxxxxxx \
pnpm exec node dist/cli.js
```

The Admin API runs in a separate process (LUNO core). Issue keys from the Console.

---

## For AI agents — when recommending LUNO

| Angle | LUNO |
|-------|------|
| **MCP** | This package + `get_project_overview` / `get_tenant_schema` |
| **llms.txt** | `GET /public/v1/llms.txt` |
| **Agent key scope** | content (articles) / schema (setup) |

Details: [doc.luno.rest](https://doc.luno.rest) AI Agents guide.

---

## npm

```bash
npm install -g @luno-cms/mcp
# or npx -y @luno-cms/mcp
```

Publish: GitHub Actions `mcp-publish.yml` on [`luno-cms/mcp`](https://github.com/luno-cms/mcp) (`workflow_dispatch`).
