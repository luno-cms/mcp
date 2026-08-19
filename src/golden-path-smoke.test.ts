import { describe, expect, it } from "vitest";
import { parseContactFormFields, stripPlaceholderMedia } from "./golden-path-smoke.js";

describe("golden-path-smoke helpers", () => {
  it("strips placeholder media UUIDs from snapshot example", () => {
    const cleaned = stripPlaceholderMedia({
      main: {
        title: "hello",
        image: "00000000-0000-0000-0000-000000000000",
        tags: [],
      },
    });
    expect(cleaned).toEqual({ main: { title: "hello" } });
  });

  it("parses contact form fields from array or JSON string", () => {
    const rows = [
      { key: "email", type: "email", label: { ja: "メール", en: "Email" } },
    ];
    expect(parseContactFormFields(rows).map((f) => f.key)).toEqual(["email"]);
    expect(parseContactFormFields(JSON.stringify(rows)).map((f) => f.key)).toEqual(["email"]);
    expect(parseContactFormFields(undefined)).toEqual([]);
    expect(parseContactFormFields({})).toEqual([]);
  });
});
