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

  it("accepts migrate_field_to_master_reference action", () => {
    const parsed = proposeChangeInputSchema.safeParse({
      goal: "Move staff-blog category from static enum to Master",
      risk: "medium",
      steps: [
        {
          action: "migrate_field_to_master_reference",
          dry_run: { status: "ok", raw: { dryRun: true, wouldSucceed: true } },
          mutation: {
            body: {
              formSetSlug: "staff-blog",
              fieldKey: "category",
              masterEntityKey: "staff_blog_category",
              mapping: { 日常: "日常" },
            },
          },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts rename_master_record_slug action", () => {
    const parsed = proposeChangeInputSchema.safeParse({
      goal: "Rename news_category 日常 to daily",
      risk: "medium",
      steps: [
        {
          action: "rename_master_record_slug",
          dry_run: { status: "ok", raw: { dryRun: true, wouldSucceed: true } },
          mutation: {
            body: {
              masterEntityKey: "news_category",
              recordId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              slug: "daily",
            },
          },
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
