/**
 * Connection config contract for Agent / MCP clients.
 * LUNO_AGENT_KEY stays required — do not weaken tenant isolation for directory scores.
 */
import { z } from "zod";

export const lunoMcpConnectionConfigSchema = z.object({
  LUNO_API_URL: z
    .string()
    .min(1)
    .describe(
      "Required. Admin API base ending in /admin. Examples: http://127.0.0.1:8787/admin, https://stg-api.luno.rest/admin, https://api.luno.rest/admin"
    ),
  LUNO_AGENT_KEY: z
    .string()
    .min(1)
    .refine((v) => v.startsWith("sk-agent-") && !v.includes("xxxxxxxx"), {
      message:
        "LUNO_AGENT_KEY is a required secret (sk-agent-…). Issue it in LUNO Console → MCP / API / Hook → API / MCP. Placeholder sk-agent-xxxxxxxx is not accepted.",
    })
    .describe(
      "Required secret. Agent API key starting with sk-agent-. Console → MCP / API / Hook → API / MCP. Hosted HTTP: Authorization Bearer or LUNO_AGENT_KEY header. Never optional; mutations stay tenant-scoped."
    ),
  LUNO_FUNNEL_ID: z
    .string()
    .uuid()
    .optional()
    .describe("Optional measurement funnel UUID. Defaults to this MCP session."),
  LUNO_PROJECT_ROOT: z
    .string()
    .optional()
    .describe("Optional project root override for env files (.agents/luno)."),
});
