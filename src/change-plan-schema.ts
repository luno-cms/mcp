import { z } from "zod";

export const changePlanRiskSchema = z.enum(["low", "medium", "high"]);

export const changePlanActionSchema = z.enum([
  "apply_form_blueprint",
  "apply_builtin_form_template",
  "apply_master_blueprint",
  "migrate_field_to_master_reference",
  "rename_master_record_slug",
]);

export const changePlanDryRunSchema = z.object({
  status: z.enum(["ok", "error", "warning"]).describe("Preview outcome from the prior apply_* dryRun"),
  changes: z
    .array(z.unknown())
    .optional()
    .describe("Optional summarized diffs from dryRun"),
  raw: z
    .record(z.string(), z.unknown())
    .describe("Verbatim apply_* dryRun JSON stored for human review"),
});

export const changePlanStepSchema = z.object({
  action: changePlanActionSchema.describe(
    "apply_form_blueprint | apply_builtin_form_template | apply_master_blueprint | migrate_field_to_master_reference | rename_master_record_slug"
  ),
  resource_type: z
    .string()
    .max(64)
    .optional()
    .describe("Optional resource kind for Console (e.g. form_set)"),
  resource_id: z
    .string()
    .max(128)
    .optional()
    .describe("Optional existing resource id this step targets"),
  mutation: z
    .object({
      body: z
        .record(z.string(), z.unknown())
        .describe("Execution body for Human approval (dryRun must be absent/false)"),
      templateSlug: z
        .string()
        .min(1)
        .max(63)
        .optional()
        .describe("Builtin template slug when action is apply_builtin_form_template"),
    })
    .optional()
    .describe("Execution payload (required for human approval). dryRun must be false/absent."),
  dry_run: changePlanDryRunSchema.describe(
    "Preview output from a prior apply_* dryRun call (stored verbatim; not re-run here)"
  ),
});

export const changePlanImpactSchema = z.object({
  kind: z.string().min(1).max(64).describe("Impact category key"),
  label: z.string().min(1).max(200).describe("Human-readable impact label"),
  delta: z.string().min(1).max(500).describe("What changes if the plan is approved"),
});

export const proposeChangeInputSchema = z.object({
  goal: z
    .string({ error: "Required: goal (human-readable intent summary)" })
    .min(1)
    .max(8000)
    .describe("What this multi-step change intends to achieve"),
  steps: z
    .array(changePlanStepSchema)
    .min(1)
    .max(50)
    .describe(
      "Ordered steps with dry_run previews + mutation.body for later execution. Build from apply_* dryRun first."
    ),
  impact: z
    .array(changePlanImpactSchema)
    .max(50)
    .optional()
    .describe("Human-readable impact bullets for Console review"),
  risk: changePlanRiskSchema.describe("Suggested risk; server may bump from dry_run signals"),
  runId: z.string().uuid().optional().describe("Optional Agent Run correlation (#109)"),
});
