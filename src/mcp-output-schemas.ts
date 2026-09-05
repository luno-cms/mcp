/**
 * Per-tool output contracts. Shapes follow handler returns, not Smithery score.
 * Extra Admin keys are kept via passthrough. Required fields are only those
 * the handler always constructs.
 */
import { z } from "zod";
import type { TOOL_ANNOTATIONS } from "./tool-annotations.js";

const json = z.json();

/** Admin JSON object. Chaining IDs are optional because list/error shapes vary. */
export const adminObjectOutputSchema = z
  .object({
    id: z.string().optional().describe("Primary resource UUID for the next tool call"),
    slug: z.string().optional().describe("URL slug when the resource has one"),
    name: z.string().optional(),
    status: z.string().optional().describe("Resource or revision status"),
    items: z
      .array(z.record(z.string(), json))
      .optional()
      .describe("List rows; pass item.id to get_*/update_*"),
    ok: z.boolean().optional(),
  })
  .passthrough();

export const formSetSchemaOutputSchema = z
  .object({
    formSet: z
      .object({
        id: z.string().describe("formSetId"),
        slug: z.string(),
        name: z.string(),
      })
      .passthrough(),
    forms: z.array(z.record(z.string(), json)),
    mastersSummary: z.array(z.record(z.string(), json)).optional(),
    snapshotShape: z
      .object({
        description: z.string().optional(),
        formKeys: z.array(z.string()).optional(),
        example: z.record(z.string(), json).optional(),
      })
      .passthrough()
      .optional()
      .describe("Use example as the save_revision snapshot nest shape"),
  })
  .passthrough();

export const publicApiInfoOutputSchema = z.object({
  projectId: z.string().describe("Agent key project UUID"),
  adminApiUrl: z.string(),
  publicApiBaseUrl: z.string().describe("Preferred /public/p/{projectId}/v1 base"),
  hostBasedPublicApiBaseUrl: z.string(),
  exampleEntryUrl: z.string(),
  exampleMasterEntitiesUrl: z.string(),
  exampleMasterRecordsUrl: z.string(),
  notes: z.array(z.string()),
});

export const revisionRowOutputSchema = z
  .object({
    id: z.string().describe("revisionRowId for get_pub_preview_url / publish_revision"),
    revision: z.number().int().describe("revision number for publish_revision"),
    status: z.string().describe("draft | pending_review | published | …"),
  })
  .passthrough();

export const revisionListOutputSchema = z
  .object({
    items: z.array(revisionRowOutputSchema).describe("Revisions; use id + revision to publish"),
  })
  .passthrough();

export const previewUrlOutputSchema = z
  .object({
    url: z.string().optional().describe("Browser URL for a human to preview the draft"),
  })
  .passthrough();

export const publishOutputSchema = z
  .object({
    steps: z.array(z.string()).optional().describe("Server-side publish steps already applied"),
    pendingHumanApproval: z
      .boolean()
      .optional()
      .describe("true → stop; a human must approve in Console"),
    revision: revisionRowOutputSchema.optional(),
  })
  .passthrough();

export const agentRunOutputSchema = z
  .object({
    agentRun: z
      .object({
        id: z.string().optional().describe("runId for get_agent_run / end_agent_run"),
        status: z.string().optional(),
      })
      .passthrough()
      .optional(),
    id: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const changePlanOutputSchema = z
  .object({
    changePlan: z
      .object({
        id: z.string().optional().describe("planId for get_change_plan"),
        status: z.string().optional().describe("pending_approval until a human decides"),
      })
      .passthrough()
      .optional(),
    id: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const deletedOutputSchema = z.object({
  deleted: z.string().describe("Deleted IP allowlist rule UUID"),
});

const A = adminObjectOutputSchema;

export const TOOL_OUTPUT_SCHEMAS = {
  get_tenant_schema: A,
  get_project_overview: A,
  list_form_sets: A,
  get_form_set_schema: formSetSchemaOutputSchema,
  get_public_api_info: publicApiInfoOutputSchema,
  list_entries: A,
  get_entry: A,
  create_entry: A,
  bulk_create_entries: A,
  update_entry: A,
  submit_entry_for_review: A,
  list_media: A,
  upload_media: A,
  list_revisions: revisionListOutputSchema,
  get_pub_preview_url: previewUrlOutputSchema,
  save_revision: revisionRowOutputSchema,
  apply_form_blueprint: A,
  archive_form_set: A,
  propose_change: changePlanOutputSchema,
  start_agent_run: agentRunOutputSchema,
  end_agent_run: agentRunOutputSchema,
  get_agent_run: agentRunOutputSchema,
  get_change_plan: changePlanOutputSchema,
  list_builtin_form_templates: A,
  apply_builtin_form_template: A,
  validate_master_blueprint: A,
  apply_master_blueprint: A,
  migrate_field_to_master_reference: A,
  create_contact_form: A,
  update_contact_form: A,
  list_master_entities: A,
  get_master_entity: A,
  list_master_records: A,
  create_master_record: A,
  update_master_record: A,
  update_master_tree: A,
  search_admin_help: A,
  get_admin_help_article: A,
  ask_admin_help: A,
  get_login_branding: A,
  get_login_appearance: A,
  update_login_appearance: A,
  list_console_login_ip_allowlists: A,
  add_console_login_ip_allowlist: A,
  delete_console_login_ip_allowlist: deletedOutputSchema,
  get_project_content_locales: A,
  patch_project_content_locales: A,
  translate_entry_locales: A,
  get_funnel_status: A,
  publish_revision: publishOutputSchema,
} as const satisfies Record<keyof typeof TOOL_ANNOTATIONS, z.ZodTypeAny>;
