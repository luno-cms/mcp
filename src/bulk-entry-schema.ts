import { z } from "zod";
import { formSetIdSchema } from "./mcp-id-schemas.js";

export const bulkCreateEntryItemSchema = z
  .object({
    slug: z
      .string({ error: "Required: slug (entry URL slug, string)" })
      .min(1)
      .max(63)
      .describe("New entry slug (lowercase, digits, hyphens)"),
  })
  .describe("Entry shell to create (body via save_revision later)");

export const bulkCreateEntriesInputSchema = z
  .object({
    formSetId: formSetIdSchema,
    items: z
      .array(bulkCreateEntryItemSchema)
      .min(1)
      .max(50)
      .describe("1–50 entry slugs. Partial success: check items[].ok per slug."),
    idempotencyKey: z
      .string()
      .max(200)
      .optional()
      .describe("Optional; replays entire batch response on retry (24h)"),
  })
  .describe(
    "Bulk create entry shells in one call (vs N× create_entry). Then save_revision per entry. No bulk delete for agents."
  );
