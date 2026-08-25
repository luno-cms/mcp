import { TOOL_ANNOTATIONS } from "./tool-annotations.js";

export type ToolRegistryRow = {
  name: keyof typeof TOOL_ANNOTATIONS;
  /** No inputSchema, or explicitly empty. */
  noArg?: boolean;
  /** Handler writes to LUNO (T2). */
  mutates?: boolean;
  /** Invalid args must surface an error (T3). */
  validation?: boolean;
  /** Destructive / govern safety path (T4). */
  safety?: boolean;
};

/**
 * mcp#15 — single source of truth for per-tool test tiers.
 * T0+T1 apply to every row. Higher flags add T2/T3/T4.
 */
export const TOOL_REGISTRY = [
  { name: "get_tenant_schema", noArg: true },
  { name: "get_project_overview", noArg: true },
  { name: "list_form_sets", noArg: true },
  { name: "get_form_set_schema", validation: true },
  { name: "get_public_api_info", noArg: true },
  { name: "list_entries", validation: true },
  { name: "get_entry", validation: true },
  { name: "create_entry", mutates: true, validation: true },
  { name: "bulk_create_entries", mutates: true, validation: true },
  { name: "update_entry", mutates: true, validation: true },
  { name: "submit_entry_for_review", mutates: true, validation: true },
  { name: "list_media" },
  { name: "upload_media", mutates: true, validation: true },
  { name: "list_revisions", validation: true },
  { name: "get_pub_preview_url", validation: true },
  { name: "save_revision", mutates: true, validation: true },
  { name: "apply_form_blueprint", mutates: true, validation: true },
  { name: "archive_form_set", mutates: true, validation: true, safety: true },
  { name: "propose_change", mutates: true, validation: true, safety: true },
  { name: "start_agent_run", mutates: true, validation: true },
  { name: "end_agent_run", mutates: true, validation: true },
  { name: "get_agent_run", validation: true },
  { name: "get_change_plan", validation: true },
  { name: "list_builtin_form_templates", noArg: true },
  { name: "apply_builtin_form_template", mutates: true, validation: true },
  { name: "validate_master_blueprint", validation: true },
  { name: "apply_master_blueprint", mutates: true, validation: true },
  { name: "create_contact_form", mutates: true, validation: true },
  { name: "update_contact_form", mutates: true, validation: true },
  { name: "list_master_entities", noArg: true },
  { name: "get_master_entity", validation: true },
  { name: "list_master_records", validation: true },
  { name: "create_master_record", mutates: true, validation: true },
  { name: "update_master_record", mutates: true, validation: true },
  { name: "update_master_tree", mutates: true, validation: true },
  { name: "search_admin_help", validation: true },
  { name: "get_admin_help_article", validation: true },
  { name: "ask_admin_help", validation: true },
  { name: "get_login_branding" },
  { name: "get_login_appearance", noArg: true },
  { name: "update_login_appearance", mutates: true },
  { name: "list_console_login_ip_allowlists", noArg: true },
  { name: "add_console_login_ip_allowlist", mutates: true, validation: true },
  { name: "delete_console_login_ip_allowlist", mutates: true, validation: true, safety: true },
  { name: "get_project_content_locales", noArg: true },
  { name: "patch_project_content_locales", mutates: true },
  { name: "translate_entry_locales", mutates: true, validation: true },
  { name: "get_funnel_status" },
  { name: "publish_revision", mutates: true, validation: true, safety: true },
] satisfies readonly ToolRegistryRow[];
