import { describe, expect, it } from "vitest";
import { uploadMediaInputSchema } from "./upload-media-schema.js";

describe("uploadMediaInputSchema (#92)", () => {
  it("accepts filePath alone", () => {
    const parsed = uploadMediaInputSchema.parse({ filePath: "/tmp/a.png" });
    expect(parsed.filePath).toBe("/tmp/a.png");
  });

  it("rejects when no source is provided", () => {
    const result = uploadMediaInputSchema.safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((i) => /sourceUrl|base64|filePath/i.test(i.message))).toBe(
      true
    );
  });

  it("rejects multiple sources", () => {
    const result = uploadMediaInputSchema.safeParse({
      filePath: "/tmp/a.png",
      base64: "abc",
    });
    expect(result.success).toBe(false);
  });
});
