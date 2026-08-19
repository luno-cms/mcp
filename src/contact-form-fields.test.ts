import { describe, expect, it } from "vitest";
import { contactFormFieldSchema, contactFormFieldsArraySchema } from "./contact-form-fields.js";
import { formatZodLikeIssues } from "./agent-errors.js";

describe("contactFormFieldSchema (#69)", () => {
  it("accepts the documented Contact Form field shape", () => {
    const parsed = contactFormFieldsArraySchema.parse([
      {
        key: "email",
        type: "email",
        label: { ja: "メール", en: "Email" },
        required: true,
      },
      {
        key: "message",
        type: "textarea",
        label: { ja: "内容", en: "Message" },
      },
    ]);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.key).toBe("email");
  });

  it("rejects Form Set fieldKey shape and names the path", () => {
    const result = contactFormFieldSchema.safeParse({
      fieldKey: "email",
      type: "email",
      label: "Email",
      sortOrder: 0,
      constraints: {},
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const issues = result.error.issues.map((iss) => ({
      path: iss.path.map(String),
      message: iss.message,
      code: iss.code,
    }));
    const msg = formatZodLikeIssues(issues);
    expect(msg).toMatch(/key|label/);
    expect(issues.some((i) => i.path.includes("key") || i.path.includes("label"))).toBe(true);
  });

  it("rejects a plain-string label", () => {
    const result = contactFormFieldSchema.safeParse({
      key: "name",
      type: "text",
      label: "お名前",
      required: true,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => i.path.includes("label"))).toBe(true);
  });
});
