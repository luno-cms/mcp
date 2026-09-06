import { describe, expect, it } from "vitest";
import { masterBlueprintRecordSchema } from "./master-blueprint-schema.js";

describe("masterBlueprintRecordSchema color", () => {
  it("accepts omitted color", () => {
    const parsed = masterBlueprintRecordSchema.parse({
      value: "education",
      label: "教育",
    });
    expect(parsed).toMatchObject({ value: "education", label: "教育" });
    expect("color" in parsed).toBe(false);
  });

  it("accepts #RRGGBB and null", () => {
    expect(
      masterBlueprintRecordSchema.parse({
        value: "education",
        label: "教育",
        color: "#3B82F6",
      }).color
    ).toBe("#3B82F6");
    expect(
      masterBlueprintRecordSchema.parse({
        value: "education",
        label: "教育",
        color: null,
      }).color
    ).toBeNull();
  });

  it("rejects short hex and named colors", () => {
    expect(() =>
      masterBlueprintRecordSchema.parse({
        value: "education",
        label: "教育",
        color: "#fff",
      })
    ).toThrow();
    expect(() =>
      masterBlueprintRecordSchema.parse({
        value: "education",
        label: "教育",
        color: "red",
      })
    ).toThrow();
  });
});
