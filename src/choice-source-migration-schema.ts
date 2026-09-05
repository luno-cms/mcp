import { z } from "zod";

const stableKeySchema = z
  .string()
  .min(1)
  .max(100)
  .describe("Stable snake_case key (e.g. category, staff_blog_category). NOT a UUID.");

/**
 * Preview-only input for migrate_field_to_master_reference.
 * Execute is propose_change(action: migrate_field_to_master_reference) after a human approves.
 */
export const migrateFieldToMasterReferenceInputSchema = z
  .object({
    formSetSlug: z
      .string({ error: "Required: formSetSlug (Form Set URL slug, not formSetId UUID)" })
      .min(1)
      .max(200)
      .describe(
        "Form Set URL slug from list_form_sets / get_form_set_schema (NOT formSetId UUID). API name: formSetSlug."
      ),
    formKey: stableKeySchema
      .optional()
      .describe(
        "Form block key (e.g. main). Omit when fieldKey is unique in the Form Set. API name: formKey."
      ),
    fieldKey: stableKeySchema.describe(
      "Target field key whose constraints.enum should become a Master Reference. API name: fieldKey. NOT Contact Form `key`."
    ),
    masterEntityKey: stableKeySchema.describe(
      "Existing Master entity key (list_master_entities). Snapshot values stay master_records.value strings, not UUIDs. API name: masterEntityKey."
    ),
    mapping: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        "Optional enum-value → Master record value strings (NOT master record UUIDs). Omit to auto-suggest from enum values + unique Master value/label. Ambiguous → mapping_ambiguous. Do not send { from, to } objects."
      ),
    dryRun: z
      .literal(true, {
        error:
          "Required: dryRun must be true. This tool never writes. dryRun:false / omitted is rejected. Execute via propose_change(action: migrate_field_to_master_reference).",
      })
      .describe(
        "Must be true. Preview only — this tool never writes and never executes. dryRun:false / omitted is rejected (API is not called). After ok preview, propose_change(action: migrate_field_to_master_reference). Help: agent.change-plans / agent.form-blueprint-mcp."
      ),
  })
  .strict()
  .describe(
    "enum → Master Reference preview. Required: formSetSlug, fieldKey, masterEntityKey, dryRun:true. Do not use apply_form_blueprint / update_field / update_field_type. Execute via propose_change. Help: agent.change-plans / agent.form-blueprint-mcp."
  );
