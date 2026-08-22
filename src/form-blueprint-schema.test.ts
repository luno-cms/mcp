import { describe, expect, it } from "vitest";
import { formBlueprintFieldSchema, formBlueprintSchema } from "./form-blueprint-schema.js";
import { formatZodLikeIssues } from "./agent-errors.js";

const minimalBlueprint = {
  version: "2026-05-12" as const,
  formSet: { slug: "news", name: "News" },
  forms: [
    {
      key: "main",
      sortOrder: 0,
      fields: [
        {
          fieldKey: "title",
          type: "text" as const,
          sortOrder: 0,
        },
      ],
    },
  ],
};

describe("formBlueprintSchema (#92)", () => {
  it("accepts documented Form Set blueprint shape", () => {
    expect(formBlueprintSchema.parse(minimalBlueprint).formSet.slug).toBe("news");
  });

  it("rejects Contact Form field shape (key + label locale object)", () => {
    const bad = {
      ...minimalBlueprint,
      forms: [
        {
          key: "main",
          sortOrder: 0,
          fields: [
            {
              key: "email",
              type: "email",
              label: { ja: "メール", en: "Email" },
              required: true,
            },
          ],
        },
      ],
    };
    const result = formBlueprintSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (result.success) return;
    const msg = formatZodLikeIssues(
      result.error.issues.map((i) => ({
        path: i.path.map(String),
        message: i.message,
        code: i.code,
      }))
    );
    expect(msg).toMatch(/fieldKey|sortOrder|unrecognized/i);
  });

  it("rejects missing sortOrder on field", () => {
    const result = formBlueprintFieldSchema.safeParse({
      fieldKey: "title",
      type: "text",
    });
    expect(result.success).toBe(false);
  });
});
