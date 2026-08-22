import { describe, expect, it } from "vitest";
import { snapshotSchema } from "./snapshot-schema.js";
import { formatZodLikeIssues } from "./agent-errors.js";

describe("snapshotSchema (#92)", () => {
  it("accepts nested formKey → fieldKey shape", () => {
    const parsed = snapshotSchema.parse({
      main: { title: "Hello", body: "Text" },
    });
    expect(parsed.main?.title).toBe("Hello");
  });

  it("rejects flat fieldKey at top level (string value instead of nested form block)", () => {
    const result = snapshotSchema.safeParse({ title: "Hello" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.length).toBeGreaterThan(0);
  });

  it("rejects non-object form blocks", () => {
    const result = snapshotSchema.safeParse({ main: "not-an-object" });
    expect(result.success).toBe(false);
    if (result.success) return;
    const msg = formatZodLikeIssues(
      result.error.issues.map((i) => ({
        path: i.path.map(String),
        message: i.message,
        code: i.code,
      }))
    );
    expect(msg).toMatch(/main|invalid/i);
  });
});
