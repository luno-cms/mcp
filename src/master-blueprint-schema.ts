import { z } from "zod";

const stableKeySchema = z
  .string()
  .min(1)
  .max(100)
  .describe("Master entity key (slug-style, NOT UUID)");

export const masterBlueprintRecordSchema = z
  .object({
    value: z
      .string()
      .min(1)
      .max(500)
      .describe("Record value ID used in select snapshots / columnFilters (NOT record UUID)"),
    label: z.string().min(1).max(500).describe("Display label"),
    sort_order: z.number().finite().optional().describe("Sort order (sortOrder alias also accepted)"),
    sortOrder: z.number().finite().optional().describe("CamelCase alias for sort_order"),
    parent_value: z
      .union([z.string(), z.null()])
      .optional()
      .describe("Parent record value for hierarchical masters"),
    data: z.record(z.string(), z.unknown()).optional().describe("Optional extra JSON"),
  })
  .strict()
  .describe("Master record row. Agents cannot call update_master_record — set sort_order here.");

export const masterBlueprintEntitySchema = z
  .object({
    key: stableKeySchema,
    name: z.string().min(1).max(500).describe("Master display name"),
    description: z
      .union([z.string(), z.null()])
      .optional()
      .describe("Master entity description"),
    hierarchical: z.boolean().optional().describe("true for parent/child records"),
    records: z
      .array(masterBlueprintRecordSchema)
      .min(1)
      .describe("Non-empty records array with value + label"),
  })
  .strict()
  .describe("One master entity with records to upsert");

export const masterBlueprintEntitiesSchema = z
  .array(masterBlueprintEntitySchema)
  .min(1)
  .describe(
    "Master Blueprint entities array. Help: agent.master-blueprint-mcp. publish:true reflects to public master API."
  );
