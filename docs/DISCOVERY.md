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
| **mcp.so** | Submitted (free review) | [chatmcp/mcpso#3707](https://github.com/chatmcp/mcpso/issues/3707) — queued via GitHub issue (not paid $39) |
| **Test B baseline** | Pending | `luno-cms/marketing` `docs/phase2-ai-discovery-baseline.md` — re-run after directory mix is stable |

## mcp.so submission

Free review queue: open a GitHub issue on [`chatmcp/mcpso`](https://github.com/chatmcp/mcpso) (automatable via `npx mcp-submit --only mcp.so`).

| | |
| --- | --- |
| **Status** | Submitted 2026-08-23 — [issue #3707](https://github.com/chatmcp/mcpso/issues/3707) |
| Repository URL | `https://github.com/luno-cms/mcp` |
| Name | `LUNO — AI Backend Platform` |
| Description | MCP server for LUNO: AI agents build, operate, and govern production backends (schemas, content, forms, auth, storage, publish). `npx @luno-cms/mcp setup` for Claude Code, Cursor, Codex. |

Paid instant path (optional): [mcp.so/submit?type=server](https://mcp.so/submit?type=server) ($39).

## Smithery / hosted HTTPS (not now)

Smithery’s “MCP Server URL” form expects **Streamable HTTP**. This package is **stdio only** (`npx @luno-cms/mcp`). There is no `https://…/mcp` to paste.

**Do not add a public HTTP endpoint just to list on Smithery.** Listing path remains npm + Official Registry + MCPB. Hosted Remote MCP (OAuth, tenant isolation, audit, human approval) is the next **product** milestone in `luno-cms/luno` — [luno#133](https://github.com/luno-cms/luno/issues/133) — and is **not started**.

## Publish flow (npm + Registry)

```bash
pnpm public-audit && pnpm test && pnpm build
# GitHub Actions → workflow_dispatch → Publish @luno-cms/mcp
```

`server.json` version must match `package.json` before Registry publish (`public-audit` enforces this).

## Glama ownership

Org repo: maintainers in root `glama.json`. After changes, **Claim ownership** / **Sync server** on the Glama admin page so metadata refreshes.
