import { z } from "zod";

export const applyBuiltinFormTemplateSchema = z
  .object({
    templateSlug: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe("list_builtin_form_templates slug (recommended)"),
    templateId: z
      .string()
      .uuid()
      .optional()
      .describe("DB template UUID (legacy)"),
    slug: z
      .string({ error: "Required: slug (new Form Set URL slug, string)" })
      .min(1)
      .max(200)
      .describe("New Form Set slug (NOT template slug)"),
    name: z
      .string({ error: "Required: name (new Form Set display name, string)" })
      .min(1)
      .max(200)
      .describe("New Form Set display name"),
    description: z.union([z.string(), z.null()]).optional().describe("Optional Form Set description"),
    dryRun: z.boolean().optional().describe("true to preview without creating"),
    idempotencyKey: z
      .string()
      .max(200)
      .optional()
      .describe("Idempotency key (409 on conflicting reuse within 24h)"),
  })
  .superRefine((args, ctx) => {
    const hasSlug = typeof args.templateSlug === "string" && args.templateSlug.trim().length > 0;
    const hasId = typeof args.templateId === "string" && args.templateId.length > 0;
    if (!hasSlug && !hasId) {
      ctx.addIssue({
        code: "custom",
        message: "Required: templateSlug (from list_builtin_form_templates) or templateId (UUID)",
        path: ["templateSlug"],
      });
    }
    if (hasSlug && hasId) {
      ctx.addIssue({
        code: "custom",
        message: "Provide only one of templateSlug or templateId",
        path: ["templateId"],
      });
    }
  })
  .describe("Builtin template apply args — templateSlug XOR templateId required");
