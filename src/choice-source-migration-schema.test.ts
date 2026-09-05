import { describe, expect, it } from "vitest";
import { migrateFieldToMasterReferenceInputSchema } from "./choice-source-migration-schema.js";

const happy = {
  formSetSlug: "staff-blog",
  formKey: "main",
  fieldKey: "category",
  masterEntityKey: "staff_blog_category",
  mapping: { 日常: "日常", イベント: "イベント" },
  dryRun: true as const,
};

describe("migrateFieldToMasterReferenceInputSchema", () => {
  it("accepts documented dryRun preview payload", () => {
    const parsed = migrateFieldToMasterReferenceInputSchema.parse(happy);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.formSetSlug).toBe("staff-blog");
    expect(parsed.fieldKey).toBe("category");
    expect(parsed.masterEntityKey).toBe("staff_blog_category");
    expect(parsed.mapping).toEqual({ 日常: "日常", イベント: "イベント" });
  });

  it("accepts omitted formKey and mapping", () => {
    const parsed = migrateFieldToMasterReferenceInputSchema.parse({
      formSetSlug: "staff-blog",
      fieldKey: "category",
      masterEntityKey: "staff_blog_category",
      dryRun: true,
    });
    expect(parsed.formKey).toBeUndefined();
    expect(parsed.mapping).toBeUndefined();
  });

  it("rejects dryRun: false", () => {
    const result = migrateFieldToMasterReferenceInputSchema.safeParse({
      ...happy,
      dryRun: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects omitted dryRun", () => {
    const { dryRun: _omit, ...rest } = happy;
    const result = migrateFieldToMasterReferenceInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing required fieldKey", () => {
    const { fieldKey: _omit, ...rest } = happy;
    const result = migrateFieldToMasterReferenceInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing formSetSlug", () => {
    const { formSetSlug: _omit, ...rest } = happy;
    const result = migrateFieldToMasterReferenceInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing masterEntityKey", () => {
    const { masterEntityKey: _omit, ...rest } = happy;
    const result = migrateFieldToMasterReferenceInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
