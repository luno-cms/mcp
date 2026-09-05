/**
 * mcp#13 — per-tool MCP annotations (Governance metadata).
 *
 * Hints are not a security boundary. Classify from handler behavior, not name
 * prefix. Do not stamp one tuple on every tool.
 *
 * dryRun / confirmToken are argument modes; tool-level hints describe the
 * mutating path. Read-only validate/preview tools stay readOnlyHint: true.
 */

export type ToolHintSet = {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
};

/** GET/list/validate — no LUNO writes. */
const read: ToolHintSet = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

/** Additive create/update with natural or keyed idempotency. */
const addIdempotent: ToolHintSet = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

/** Additive or govern write; repeating the call is a new side effect. */
const addOnce: ToolHintSet = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

/** Can reshape or replace existing structure; same args replay safely. */
const mutateIdempotent: ToolHintSet = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
};

/** Can reshape existing structure; no replay key. */
const mutateOnce: ToolHintSet = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
};

/** Soft-delete / rule delete. */
const destroy: ToolHintSet = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
};

/** Writes that leave this backend (URL fetch, LLM). */
const openWrite: ToolHintSet = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

/** Open-world Q&A; no LUNO mutation. */
const openAsk: ToolHintSet = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

export const TOOL_ANNOTATIONS = {
  get_tenant_schema: read,
  get_project_overview: read,
  list_form_sets: read,
  get_form_set_schema: read,
  get_public_api_info: read,
  list_entries: read,
  get_entry: read,
  list_media: read,
  list_revisions: read,
  // POST pub-preview-url returns a URL; does not change entry/revision state.
  get_pub_preview_url: read,
  get_agent_run: read,
  get_change_plan: read,
  list_builtin_form_templates: read,
  validate_master_blueprint: read,
  migrate_field_to_master_reference: read,
  list_master_entities: read,
  get_master_entity: read,
  list_master_records: read,
  search_admin_help: read,
  get_admin_help_article: read,
  get_login_branding: read,
  get_login_appearance: read,
  list_console_login_ip_allowlists: read,
  get_project_content_locales: read,
  get_funnel_status: read,

  create_entry: addIdempotent,
  bulk_create_entries: addIdempotent,
  update_entry: addIdempotent,
  save_revision: addIdempotent,
  apply_builtin_form_template: addIdempotent,
  create_contact_form: addIdempotent,
  update_login_appearance: addIdempotent,
  // Agent key returns 403; still a mutating contract.
  update_master_record: addIdempotent,

  create_master_record: addOnce,
  start_agent_run: addOnce,
  end_agent_run: addOnce,
  add_console_login_ip_allowlist: addOnce,
  submit_entry_for_review: addOnce,
  publish_revision: addOnce,
  propose_change: addOnce,

  apply_form_blueprint: mutateIdempotent,
  update_contact_form: mutateIdempotent,
  update_master_tree: mutateIdempotent,
  // JWT-only; disabling locales is destructive.
  patch_project_content_locales: mutateIdempotent,

  apply_master_blueprint: mutateOnce,

  archive_form_set: destroy,
  delete_console_login_ip_allowlist: destroy,

  upload_media: openWrite,
  translate_entry_locales: openWrite,
  ask_admin_help: openAsk,
} as const satisfies Record<string, ToolHintSet>;
