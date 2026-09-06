import { describe, expect, it } from "vitest";
import { LUNO_MCP_NPX_SPEC, LUNO_MCP_PACKAGE_NAME } from "./mcp-package-spec.js";
import { codexMcpAddArgv, writeAgentConfig } from "./agent-configs.js";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("npx package spec (mcp#47)", () => {
  it("pins generated MCP servers to @latest", () => {
    expect(LUNO_MCP_PACKAGE_NAME).toBe("@luno-cms/mcp");
    expect(LUNO_MCP_NPX_SPEC).toBe("@luno-cms/mcp@latest");
  });

  it("uses @latest in Codex mcp add argv (not the unpinned name)", () => {
    for (const add of codexMcpAddArgv("/tmp/site")) {
      const pkg = add.argv[add.argv.indexOf("-y") + 1];
      expect(pkg).toBe(LUNO_MCP_NPX_SPEC);
    }
  });

  it("writes @latest into Claude .mcp.json", () => {
    const root = mkdtempSync(join(tmpdir(), "luno-mcp-npx-"));
    try {
      writeAgentConfig(root, "claude");
      const mcp = JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8")) as {
        mcpServers: Record<string, { args: string[] }>;
      };
      expect(mcp.mcpServers["luno-stg"].args).toEqual(["-y", LUNO_MCP_NPX_SPEC, "run", "stg"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
