import { describe, expect, it } from "vitest";
import {
  endAgentRunInputSchema,
  getAgentRunInputSchema,
  startAgentRunInputSchema,
} from "./agent-run-schema.js";

const runId = "00000000-0000-4000-8000-0000000000f1";

describe("agent-run-schema", () => {
  it("validates start input", () => {
    const parsed = startAgentRunInputSchema.parse({
      goal: "Apply blog template and draft one post",
      clientLabel: "mcp",
    });
    expect(parsed.goal).toContain("blog");
  });

  it("validates end input", () => {
    const parsed = endAgentRunInputSchema.parse({ runId, status: "completed" });
    expect(parsed.status).toBe("completed");
  });

  it("validates get input", () => {
    expect(getAgentRunInputSchema.parse({ runId }).runId).toBe(runId);
  });
});
