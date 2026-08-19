import { describe, expect, it } from "vitest";
import {
  formatLunoApiFailure,
  formatZodLikeIssues,
  tryFormatMcpInvalidArgumentsMessage,
} from "./agent-errors.js";

describe("agent-errors", () => {
  it("formats Zod-like missing args in plain language", () => {
    const msg = formatZodLikeIssues([
      {
        expected: "string",
        code: "invalid_type",
        path: ["slug"],
        message: "Invalid input: expected string, received undefined",
      },
      {
        expected: "string",
        code: "invalid_type",
        path: ["name"],
        message: "Invalid input: expected string, received undefined",
      },
    ]);
    expect(msg).toMatch(/slug/);
    expect(msg).toMatch(/name/);
    expect(msg).toMatch(/do not retry with the same input/i);
  });

  it("rewrites MCP SDK invalid-arguments dump when parseable", () => {
    const raw =
      'Invalid arguments for tool apply_builtin_form_template: [{"expected":"string","code":"invalid_type","path":["slug"],"message":"Invalid input: expected string, received undefined"}]';
    const out = tryFormatMcpInvalidArgumentsMessage(raw);
    expect(out).toMatch(/apply_builtin_form_template/);
    expect(out).toMatch(/slug/);
    expect(out).not.toMatch(/\[\{/);
  });

  it("includes meta.fields paths in the agent-facing message", () => {
    const out = formatLunoApiFailure(
      400,
      "https://stg-api.luno.rest/admin/v1/contact-forms",
      JSON.stringify({
        error: {
          code: "VALIDATION_ERROR",
          message: "fields.0.label: Invalid input: expected object, received string",
          meta: {
            fields: {
              "fields.0.label": ["Invalid input: expected object, received string"],
            },
          },
        },
      })
    );
    expect(out).toContain("fields.0.label");
    expect(out).toContain("VALIDATION_ERROR");
  });

  it("formats API failure with hint and retryable", () => {
    const out = formatLunoApiFailure(
      409,
      "https://stg-api.luno.rest/admin/v1/form-set-templates/builtin/blog/apply",
      JSON.stringify({
        error: {
          code: "VALIDATION_ERROR",
          message: "Slug already exists for this tenant",
          hint: "Call list_form_sets",
          retryable: false,
        },
      })
    );
    expect(out).toContain("hint=Call list_form_sets");
    expect(out).toContain("retryable=false");
    expect(out).toContain("VALIDATION_ERROR");
  });
});
