# MCP discovery & directory listings

Positioning (use consistently on npm, GitHub, Registry, Glama, mcpservers.org, mcp.so):

> **LUNO — AI Backend Platform.** Build, operate, and govern production backends with AI agents.  
> Not a website builder. MCP connects Claude Code, Cursor, and Codex to schemas, content, forms, auth, storage, and publish.

Quick start CTA: `npx @luno-cms/mcp setup`

**Disambiguation:** `@luno-cms/mcp` / `io.github.luno-cms/mcp` — not the unrelated cryptocurrency-exchange “Luno” MCP.

## Status checklist (#67)

| Channel | Status | URL / notes |
| --- | --- | --- |
| **npm** | Live | [`@luno-cms/mcp`](https://www.npmjs.com/package/@luno-cms/mcp) — search `luno mcp` |
| **Official MCP Registry** | Live | [`io.github.luno-cms/mcp`](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.luno-cms/mcp) |
| **GitHub** | Live | [`github.com/luno-cms/mcp`](https://github.com/luno-cms/mcp) + `glama.json` |
| **Glama** | Live (claimed) | [`glama.ai/mcp/servers/luno-cms/mcp`](https://glama.ai/mcp/servers/luno-cms/mcp) — use `npx` setup, not hosted “Install Server” |
| **mcpservers.org** | Live | [`mcpservers.org/servers/luno-rest`](https://mcpservers.org/servers/luno-rest) |
| **mcp.so** | Pending | Submit at [mcp.so/submit?type=server](https://mcp.so/submit?type=server) (free review queue or $39 instant) |
| **Test B baseline** | Pending | `luno-cms/marketing` `docs/phase2-ai-discovery-baseline.md` — re-run after directory mix is stable |

## mcp.so submission copy

| Field | Value |
| --- | --- |
| Repository URL | `https://github.com/luno-cms/mcp` |
| Name | `LUNO — AI Backend Platform` |
| Description | MCP server for LUNO: AI agents build, operate, and govern production backends (schemas, content, forms, auth, storage, publish). `npx @luno-cms/mcp setup` for Claude Code, Cursor, Codex. |

## Publish flow (npm + Registry)

```bash
pnpm public-audit && pnpm test && pnpm build
# GitHub Actions → workflow_dispatch → Publish @luno-cms/mcp
```

`server.json` version must match `package.json` before Registry publish (`public-audit` enforces this).

## Glama ownership

Org repo: maintainers in root `glama.json`. After changes, **Claim ownership** / **Sync server** on the Glama admin page so metadata refreshes.
