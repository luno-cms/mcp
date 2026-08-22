import { describe, expect, it } from "vitest";
import { applyBuiltinFormTemplateSchema } from "./apply-builtin-template-schema.js";

describe("applyBuiltinFormTemplateSchema (#92)", () => {
  it("accepts templateSlug with slug and name", () => {
    const parsed = applyBuiltinFormTemplateSchema.parse({
      templateSlug: "blog",
      slug: "my-blog",
      name: "My Blog",
    });
    expect(parsed.templateSlug).toBe("blog");
  });

  it("rejects when neither templateSlug nor templateId is set", () => {
    const result = applyBuiltinFormTemplateSchema.safeParse({
      slug: "my-blog",
      name: "My Blog",
    });
    expect(result.success).toBe(false);
  });

  it("rejects both templateSlug and templateId", () => {
    const result = applyBuiltinFormTemplateSchema.safeParse({
      templateSlug: "blog",
      templateId: "00000000-0000-0000-0000-000000000001",
      slug: "my-blog",
      name: "My Blog",
    });
    expect(result.success).toBe(false);
  });
});
