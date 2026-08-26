import { z } from "zod";

/** Mirrors LUNO FIELD_TYPES enum — keep in sync with hosted API. */
export const FORM_BLUEPRINT_FIELD_TYPES = [
  "text",
  "url",
  "textarea",
  "tiptap",
  "number",
  "boolean",
  "date",
  "select",
  "radio",
  "multiselect",
  "image",
  "image_gallery",
  "file",
  "video_embed",
  "entry_ref",
] as const;

export const FORM_BLUEPRINT_VERSIONS = ["2026-03-31", "2026-05-12"] as const;

const stableKeySchema = z
  .string()
  .min(1)
  .max(100)
  .describe("Stable snake_case key (e.g. main, body, published_at). NOT Contact Form `key`.");

export const formBlueprintFormSetSchema = z
  .object({
    slug: stableKeySchema.describe("Form Set URL slug"),
    name: z.string().min(1).max(500).describe("Form Set display name"),
    description: z.union([z.string(), z.null()]).optional().describe("Optional description"),
  })
  .describe("Target Form Set metadata");

export const formBlueprintFieldSchema = z
  .object({
    fieldKey: stableKeySchema.describe(
      "Form Set field key (NOT Contact Form `key` / NOT field_key at blueprint root)"
    ),
    type: z
      .enum(FORM_BLUEPRINT_FIELD_TYPES)
      .describe("Field type — see luno://forms/field-types"),
    label: z.union([z.string(), z.null()]).optional().describe("Display label"),
    sortOrder: z.number().int().optional().describe("Field order (sort_order alias also accepted by API)"),
    sort_order: z.number().int().optional().describe("Snake_case alias for sortOrder"),
    constraints: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Type-specific constraints (enum, maxLength, etc.)"),
    masterEntityId: z
      .string()
      .uuid()
      .optional()
      .describe("Master entity UUID for select/radio/multiselect"),
    masterEntityKey: z
      .string()
      .min(1)
      .optional()
      .describe("Master entity key to upsert on apply (alternative to masterEntityId)"),
    masterEntityName: z.string().min(1).optional().describe("Display name when using masterEntityKey"),
    localizable: z
      .boolean()
      .optional()
      .describe("true only for text / textarea / tiptap"),
  })
  .strict()
  .describe(
    "Form Set field definition. Use fieldKey + sortOrder. Do NOT use Contact Form { key, label:{ja,en} }."
  )
  .superRefine((field, ctx) => {
    if (field.sortOrder === undefined && field.sort_order === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Required: sortOrder (integer) or sort_order",
        path: ["sortOrder"],
      });
    }
  });

export const formBlueprintFormSchema = z
  .object({
    key: stableKeySchema.describe("Form block key (nested under blueprint.forms)"),
    label: z.union([z.string(), z.null()]).optional().describe("Form block display label"),
    sortOrder: z.number().int().optional().describe("Form block order"),
    sort_order: z.number().int().optional().describe("Snake_case alias for sortOrder"),
    fields: z
      .array(formBlueprintFieldSchema)
      .min(1)
      .describe("Non-empty fields array with fieldKey (NOT Contact Form fields shape)"),
  })
  .strict()
  .superRefine((form, ctx) => {
    if (form.sortOrder === undefined && form.sort_order === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Required: sortOrder (integer) or sort_order",
        path: ["sortOrder"],
      });
    }
  });

/**
 * Form Blueprint for apply_form_blueprint — Form Set schema, not Contact Form.
 */
export const formBlueprintSchema = z
  .object({
    version: z
      .enum(FORM_BLUEPRINT_VERSIONS)
      .describe(`Blueprint version. Use latest: ${FORM_BLUEPRINT_VERSIONS[FORM_BLUEPRINT_VERSIONS.length - 1]}`),
    formSet: formBlueprintFormSetSchema,
    forms: z.array(formBlueprintFormSchema).min(1).describe("Non-empty forms array"),
    contentListColumns: z
      .array(
        z.object({
          formKey: z.string().describe("Form block key"),
          fieldKey: z.string().describe("Field key shown as a list column"),
        })
      )
      .optional()
      .describe("Console entry-list columns"),
    contentSearchColumns: z
      .array(
        z.object({
          formKey: z.string().describe("Form block key"),
          fieldKey: z.string().describe("Field key included in search"),
        })
      )
      .optional()
      .describe("Console entry-search columns"),
    provenance: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Optional origin metadata (not applied as schema)"),
    notes: z.array(z.string()).optional().describe("Human-readable notes for Console review"),
  })
  .strict()
  .describe(
    "Form Blueprint JSON (Form Set). fieldKey/sortOrder shape. NOT Contact Form fields. Help: agent.form-blueprint-mcp, luno://content/schema-guide."
  );
