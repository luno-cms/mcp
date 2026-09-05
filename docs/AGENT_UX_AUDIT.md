# LUNO MCP Agent UX / Contract Audit

Engineering quality for Discover → Understand → Call → Chain.  
Not a Smithery score chase. Product story: *AI agents build and operate production backends, humans govern them.*

Related: [SCHEMA_QUALITY.md](./SCHEMA_QUALITY.md) (#92 input), [mcp#13](https://github.com/luno-cms/mcp/issues/13) annotations, [mcp#15](https://github.com/luno-cms/mcp/issues/15) tests.

---

## A. Tool inventory (50)

| Category | Tools |
|----------|--------|
| **A. Read-only** | `get_tenant_schema`, `get_project_overview`, `list_form_sets`, `get_form_set_schema`, `get_public_api_info`, `list_entries`, `get_entry`, `list_media`, `list_revisions`, `get_pub_preview_url`, `get_agent_run`, `get_change_plan`, `list_builtin_form_templates`, `validate_master_blueprint`, `migrate_field_to_master_reference`, `list_master_entities`, `get_master_entity`, `list_master_records`, `search_admin_help`, `get_admin_help_article`, `get_login_branding`, `get_login_appearance`, `list_console_login_ip_allowlists`, `get_project_content_locales`, `get_funnel_status` |
| **B. Mutating** | `create_entry`, `bulk_create_entries`, `update_entry`, `submit_entry_for_review`, `save_revision`, `apply_builtin_form_template`, `create_contact_form`, `update_contact_form`, `create_master_record`, `update_master_record`, `update_master_tree`, `update_login_appearance`, `add_console_login_ip_allowlist`, `start_agent_run`, `end_agent_run` |
| **C. Governance / approval** | `propose_change`, `get_change_plan`, `publish_revision`, `archive_form_set`, `start_agent_run`, `end_agent_run`, `get_agent_run` |
| **D. Schema / blueprint** | `get_tenant_schema`, `get_form_set_schema`, `apply_form_blueprint`, `apply_builtin_form_template`, `validate_master_blueprint`, `apply_master_blueprint`, `migrate_field_to_master_reference` |
| **E. Upload / external** | `upload_media`, `translate_entry_locales`, `ask_admin_help` |
| **F. Trigger-only** | none — every tool returns inspectable JSON |

Parameter descriptions that were missing at the **tool** level (Smithery 46/49):

| Tool | Missing top-level params |
|------|--------------------------|
| `create_contact_form` | `autoreply_enabled`, `autoreply_to_field`, `autoreply_subject`, `autoreply_body`, `email_signature` |
| `update_contact_form` | same autoreply / signature fields |
| `update_master_record` | `label`, `value`, `sortOrder`, `parentRecordId`, `data` |

Nested describes were also added where Agent chaining needs them (`update_master_tree` rows, `translate_entry_locales.fields.type/label`, Form Blueprint columns, Change Plan steps).

Return shape → output schema (see `src/mcp-output-schemas.ts`):

| Handler return | Schema | Tools |
|----------------|--------|--------|
| Admin JSON object (`id` / `items` / `status` optional, passthrough) | `adminObjectOutputSchema` | most list/get/mutate passthrough tools |
| `enrichFormSetSchema(...)` | `formSetSchemaOutputSchema` | `get_form_set_schema` |
| `buildPublicApiInfo(...)` | `publicApiInfoOutputSchema` | `get_public_api_info` |
| `{ id, revision, status }` | `revisionRowOutputSchema` | `save_revision` |
| `{ items: RevisionRow[] }` | `revisionListOutputSchema` | `list_revisions` |
| `{ url }` | `previewUrlOutputSchema` | `get_pub_preview_url` |
| `{ steps, pendingHumanApproval?, revision }` | `publishOutputSchema` | `publish_revision` |
| `{ agentRun: { id, status } }` | `agentRunOutputSchema` | `start_agent_run`, `end_agent_run`, `get_agent_run` |
| `{ changePlan: { id, status } }` | `changePlanOutputSchema` | `propose_change`, `get_change_plan` |
| `{ deleted }` | `deletedOutputSchema` | `delete_console_login_ip_allowlist` |

`text` JSON is unchanged. `structuredContent` is the same object (arrays wrapped as `{ items }`).

Annotations stay in `src/tool-annotations.ts`. They must not contradict output: `pendingHumanApproval` is optional on publish; read-only tools do not require mutation-only fields.

---

## B. Output schema migration

| Complexity | Approach | Compatibility |
|------------|----------|---------------|
| Low | Add `outputSchema` + `structuredContent` beside existing `content[0].text` | Existing clients that only read text keep working |
| Medium | Strict schemas only where the handler constructs the object (`save_revision`, `publish_revision`, `get_public_api_info`, `delete_*`) | Mocks in mcp#15 T2 updated to match |
| High / skipped | Generate full OpenAPI clones of every Admin payload | Would drift; passthrough Admin object is honest |

`z.unknown()` is not used as the whole output. Admin extras stay via `.passthrough()`.

---

## C. Naming audit

Verb+noun, `get_*` / `list_*` / `create_*` / `update_*` / `delete_*` are already consistent. **No rename this release.**

| Class | Tools | Note |
|-------|--------|------|
| **Keep** | `list_*`, `get_*`, `create_entry`, `update_entry`, `save_revision`, `publish_revision`, `archive_form_set`, `upload_media`, `search_admin_help`, `get_admin_help_article` | Clear verb + resource |
| **Review** | `ask_admin_help` (open-world Q&A, not get), `patch_project_content_locales` (JWT-only; `patch` vs `update`), `get_pub_preview_url` (POST, not GET), `apply_*` (upsert, not create), `propose_change` (governance, not apply), `bulk_create_entries` | Acceptable; names already encode the special contract |
| **Future rename** | none now | Breaking for clients, Golden Path, registry, docs |

Possible **vNext namespace** (additive aliases only, never a silent rename):

```text
project.get_overview          ← get_project_overview
content.form_sets.list        ← list_form_sets
content.entries.list          ← list_entries
content.entries.create        ← create_entry
content.revisions.save        ← save_revision
content.revisions.publish     ← publish_revision
schema.form_blueprint.apply   ← apply_form_blueprint
governance.change_plan.propose← propose_change
```

Ship aliases only with a deprecation window. Not in this change.

---

## D. Config audit

| Field | Required | Secret | Tenant boundary |
|-------|----------|--------|-----------------|
| `LUNO_API_URL` | yes | no | Points at one Admin origin (`…/admin`) |
| `LUNO_AGENT_KEY` | **yes** | **yes** | Scopes all mutations to one project |
| `LUNO_FUNNEL_ID` | no | no | Measurement only |
| `LUNO_PROJECT_ROOT` | no | no | Env-file discovery |

Hosted HTTP: `Authorization: Bearer sk-agent-…` or `LUNO_AGENT_KEY` header. Discovery (`initialize` / `tools/list`) is public so directories can scan; **`tools/call` stays authenticated**.

**Not done (intentionally):** making the key optional, dummy credentials, anonymous mutations, Smithery “optional config” points.

Schema: `src/mcp-config-schema.ts`. CLI help and generated `.env` comments state the same contract.

---

## Golden Path (unchanged sequence)

```text
discover          get_project_overview / list_form_sets
  → inspect       get_form_set_schema
  → create        create_entry / save_revision
  → inspect       get_entry / list_revisions
  → preview       get_pub_preview_url
  → propose       propose_change
  → approve       human Console (or publish_revision when can_publish)
  → publish       publish_revision
```

Unit coverage: `mcp-contract-quality.test.ts` (representative structured output) + `golden-path-smoke.test.ts` helpers. Staging E2E remains `pnpm golden-path-smoke`.
