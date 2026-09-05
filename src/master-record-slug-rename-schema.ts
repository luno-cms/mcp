import { z } from "zod";

const identifierSchema = z
  .string()
  .min(1)
  .max(500)
  .describe("Master Record public identifier (slug). Compat alias: value.");

/**
 * Preview-only input for rename_master_record_slug.
 * Execute is propose_change(action: rename_master_record_slug) after a human approves.
 */
export const renameMasterRecordSlugInputSchema = z
  .object({
    masterEntityKey: z
      .string({ error: "Required: masterEntityKey (Master entity key, not UUID)" })
      .min(1)
      .max(200)
      .describe(
        "Master entity key from list_master_entities (NOT a UUID). API name: masterEntityKey."
      ),
    recordId: z
      .string()
      .uuid()
      .optional()
      .describe("Target master record UUID when known. API name: recordId."),
    currentSlug: identifierSchema
      .optional()
      .describe(
        "Current public identifier. Alias of currentValue (both must match if sent). Required when recordId is omitted."
      ),
    currentValue: identifierSchema
      .optional()
      .describe("Compat alias of currentSlug."),
    slug: identifierSchema
      .optional()
      .describe(
        "New public identifier. Alias of value (both must match if sent). Required unless value is sent."
      ),
    value: identifierSchema.optional().describe("Compat alias of slug."),
    dryRun: z
      .literal(true, {
        error:
          "Required: dryRun must be true. This tool never writes. dryRun:false / omitted is rejected. Execute via propose_change(action: rename_master_record_slug).",
      })
      .describe(
        "Must be true. Preview only — this tool never writes and never executes. dryRun:false / omitted is rejected (API is not called). After ok preview, propose_change(action: rename_master_record_slug). Help: agent.change-plans / agent.snapshot-field-values."
      ),
  })
  .strict()
  .refine((body) => Boolean(body.recordId || body.currentSlug || body.currentValue), {
    message: "recordId or currentSlug/currentValue is required",
  })
  .refine((body) => Boolean(body.slug || body.value), {
    message: "slug or value is required",
  })
  .refine((body) => !(body.slug && body.value) || body.slug === body.value, {
    message: "slug and value must match",
  })
  .refine(
    (body) =>
      !(body.currentSlug && body.currentValue) || body.currentSlug === body.currentValue,
    { message: "currentSlug and currentValue must match" },
  )
  .describe(
    "Master Record slug rename preview. Required: masterEntityKey, dryRun:true, slug or value, and recordId or currentSlug/currentValue. Public name is slug; value is compat dual. Do not PATCH update_master_record for identifier changes. Execute via propose_change. Help: agent.change-plans / agent.snapshot-field-values."
  );
