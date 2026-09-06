import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getPackageRoot } from "./package-root.js";
import { TOOL_REGISTRY } from "./tool-registry.js";
import {
  MCP_API_CONTRACT,
  MCP_RUNTIME_NOTE,
  buildMcpRuntimeSnapshot,
  formatMcpReadyLog,
  isCapabilitySensitiveApiUrl,
} from "./mcp-runtime.js";

describe("mcp runtime (mcp#48)", () => {
  it("reports this package version and registered tool count without LUNO I/O", () => {
    const pkg = JSON.parse(readFileSync(join(getPackageRoot(), "package.json"), "utf8")) as {
      version: string;
    };
    const snap = buildMcpRuntimeSnapshot("http://127.0.0.1:8787/admin");
    expect(snap.package).toBe("@luno-cms/mcp");
    expect(snap.mcpVersion).toBe(pkg.version);
    expect(snap.toolCount).toBe(TOOL_REGISTRY.length);
    expect(snap.apiBase).toBe("http://127.0.0.1:8787/admin");
    expect(snap.contract).toEqual(MCP_API_CONTRACT.map((row) => ({ ...row })));
    expect(snap.note).toBe(MCP_RUNTIME_NOTE);
    expect(snap.contract.some((row) => row.tool === "migrate_field_to_master_reference")).toBe(
      true
    );
  });

  it("ready log uses the live version and tool count (not a stale 0.2.29 / ≈46)", () => {
    const line = formatMcpReadyLog({
      version: "9.9.9",
      funnelId: "funnel-1",
      apiBase: "http://127.0.0.1:8787/admin",
      resourceCount: 6,
      toolCount: 52,
    });
    expect(line).toContain("version=9.9.9");
    expect(line).toContain("tools=52");
    expect(line).toContain("resources=6");
    expect(line).toContain("get_mcp_runtime");
    expect(line).not.toMatch(/0\.2\.29|tools≈46/);
  });

  it("flags newer Admin routes that 404 when the API lags this MCP", () => {
    expect(
      isCapabilitySensitiveApiUrl(
        "https://stg-api.luno.rest/admin/v1/schema-migrations/to-master-reference"
      )
    ).toBe(true);
    expect(
      isCapabilitySensitiveApiUrl(
        "https://api.luno.rest/admin/v1/master-records/rename-slug"
      )
    ).toBe(true);
    expect(isCapabilitySensitiveApiUrl("https://stg-api.luno.rest/admin/v1/form-sets")).toBe(
      false
    );
  });
});
