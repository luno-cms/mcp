import { describe, expect, it } from "vitest";
import { renameMasterRecordSlugInputSchema } from "./master-record-slug-rename-schema.js";

const happy = {
  masterEntityKey: "news_category",
  recordId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  slug: "daily",
  dryRun: true as const,
};

describe("renameMasterRecordSlugInputSchema", () => {
  it("accepts documented dryRun preview payload", () => {
    const parsed = renameMasterRecordSlugInputSchema.parse(happy);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.masterEntityKey).toBe("news_category");
    expect(parsed.slug).toBe("daily");
  });

  it("accepts currentSlug + value aliases", () => {
    const parsed = renameMasterRecordSlugInputSchema.parse({
      masterEntityKey: "news_category",
      currentSlug: "日常",
      value: "daily",
      dryRun: true,
    });
    expect(parsed.currentSlug).toBe("日常");
    expect(parsed.value).toBe("daily");
  });

  it("rejects dryRun: false", () => {
    const result = renameMasterRecordSlugInputSchema.safeParse({
      ...happy,
      dryRun: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects omitted dryRun", () => {
    const { dryRun: _omit, ...rest } = happy;
    const result = renameMasterRecordSlugInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing identifier selector", () => {
    const { recordId: _omit, ...rest } = happy;
    const result = renameMasterRecordSlugInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing next slug", () => {
    const { slug: _omit, ...rest } = happy;
    const result = renameMasterRecordSlugInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects mismatched slug and value", () => {
    const result = renameMasterRecordSlugInputSchema.safeParse({
      ...happy,
      value: "weekly",
    });
    expect(result.success).toBe(false);
  });
});
