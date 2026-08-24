import { z } from "zod";
import { agentRunIdSchema } from "./mcp-id-schemas.js";

export const startAgentRunInputSchema = z.object({
  goal: z
    .string({ error: "Required: goal (human-readable task summary)" })
    .min(1)
    .max(8000)
    .describe("What this agent task intends to accomplish"),
  clientLabel: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .describe("Optional client label, e.g. cursor, claude-code, mcp"),
});

export const endAgentRunInputSchema = z.object({
  runId: agentRunIdSchema.describe("Agent run id from start_agent_run"),
  status: z
    .enum(["completed", "failed", "cancelled"])
    .describe("Terminal status for this run"),
});

export const getAgentRunInputSchema = z.object({
  runId: agentRunIdSchema,
});
