import { describe, expect, it } from "vitest";
import { bulkCreateEntriesInputSchema } from "./bulk-entry-schema.js";

describe("bulkCreateEntriesInputSchema (#94)", () => {
  it("accepts formSetId and slug items", () => {
    const parsed = bulkCreateEntriesInputSchema.parse({
      formSetId: "00000000-0000-4000-8000-000000000001",
      items: [{ slug: "post-a" }, { slug: "post-b" }],
    });
    expect(parsed.items).toHaveLength(2);
  });

  it("rejects empty items", () => {
    expect(
      bulkCreateEntriesInputSchema.safeParse({
        formSetId: "00000000-0000-4000-8000-000000000001",
        items: [],
      }).success
    ).toBe(false);
  });
});
