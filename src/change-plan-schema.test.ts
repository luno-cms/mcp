import { describe, expect, it } from "vitest";
import { proposeChangeInputSchema } from "./change-plan-schema.js";

describe("proposeChangeInputSchema", () => {
  it("accepts minimal valid propose payload", () => {
    const parsed = proposeChangeInputSchema.safeParse({
      goal: "Create news form",
      risk: "low",
      steps: [
        {
          action: "apply_form_blueprint",
          dry_run: { status: "ok", raw: { operations: [] } },
          mutation: { body: { blueprint: { version: "2026-05-12" } } },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty steps", () => {
    const parsed = proposeChangeInputSchema.safeParse({
      goal: "x",
      risk: "low",
      steps: [],
    });
    expect(parsed.success).toBe(false);
  });
});
