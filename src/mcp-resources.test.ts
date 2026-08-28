import { describe, expect, it } from "vitest";
import {
  LUNO_MCP_RESOURCES,
  REQUIRED_MCP_RESOURCE_URIS,
} from "./mcp-resources.js";

describe("mcp resources catalog", () => {
  it("lists unique luno:// URIs", () => {
    const uris = LUNO_MCP_RESOURCES.map((r) => r.uri);
    expect(new Set(uris).size).toBe(uris.length);
    for (const uri of uris) {
      expect(uri.startsWith("luno://")).toBe(true);
    }
  });

  it("includes required v1 resources", () => {
    const uris = new Set(LUNO_MCP_RESOURCES.map((r) => r.uri));
    for (const required of REQUIRED_MCP_RESOURCE_URIS) {
      expect(uris.has(required)).toBe(true);
    }
  });

  it("ships non-empty markdown bodies", () => {
    for (const res of LUNO_MCP_RESOURCES) {
      expect(res.body.length).toBeGreaterThan(200);
      expect(res.description.length).toBeGreaterThan(10);
    }
  });

  it("field-types documents tiptap and image_gallery", () => {
    const fieldTypes = LUNO_MCP_RESOURCES.find((r) => r.uri.endsWith("field-types"));
    expect(fieldTypes?.body).toContain("tiptap");
    expect(fieldTypes?.body).toContain("image_gallery");
  });

  it("publishing-guide documents save_revision, preview, and can_publish", () => {
    const pub = LUNO_MCP_RESOURCES.find((r) => r.uri.endsWith("publishing-guide"));
    expect(pub?.body).toContain("save_revision");
    expect(pub?.body).toContain("get_pub_preview_url");
    expect(pub?.body).toContain("can_publish");
  });

  it("permissions document human-only restore", () => {
    const perms = LUNO_MCP_RESOURCES.find((r) => r.uri.endsWith("permissions"));
    expect(perms?.body).toContain("restore_requires_human_jwt");
    expect(perms?.body).toContain("Do not archive to change field types");
  });
});
