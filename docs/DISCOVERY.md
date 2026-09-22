# MCP discovery & directory listings

Positioning (use consistently on npm, GitHub, Registry, Glama, mcpservers.org, mcp.so):

> **LUNO — AI-era Backend Platform** (not the Luno crypto exchange, not meetluno.ai).  
> Agents BUILD / OPERATE via MCP. Humans REGISTER / GOVERN. Applications CONSUME. Everyone works from the same system of record.  
> Not a website builder. MCP connects Claude Code, Cursor, and Codex to schemas, content, forms, auth, storage, and publish.  
> Site: https://luno.rest · Docs: https://doc.luno.rest

Quick start CTA: `npx -y @luno-cms/mcp setup`

**Disambiguation:** `@luno-cms/mcp` / `io.github.luno-cms/mcp` — not the Luno crypto exchange, not meetluno.ai.

## Status checklist (#67)

| Channel | Status | URL / notes |
| --- | --- | --- |
| **npm** | Live (copy stale until publish) | [`@luno-cms/mcp`](https://www.npmjs.com/package/@luno-cms/mcp) — registry description still “build, operate, and govern” + `npx @luno-cms/mcp setup` as of 2026-09-22. Source on `main` is four-operator + crypto + `npx -y`. **Do not publish from this checklist.** |
| **Official MCP Registry** | Live | [`io.github.luno-cms/mcp`](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.luno-cms/mcp) — `server.json` on `main` updated; registry refresh follows the next tagged publish. |
| **GitHub** | Live (source of truth) | [`github.com/luno-cms/mcp`](https://github.com/luno-cms/mcp) + `glama.json` — four operators + `npx -y @luno-cms/mcp setup` after #65. |
| **Glama** | Live (claimed + synced 2026-09-22) | [`glama.ai/mcp/servers/luno-cms/mcp`](https://glama.ai/mcp/servers/luno-cms/mcp) — Official + owner check. README now shows four operators + `npx -y @luno-cms/mcp setup`. Glama listing title is still `LUNO — AI Backend Platform` (their title field, not the README H1). Use `npx -y`, not hosted “Install Server”. |
| **Smithery** | Listing URL only | [`smithery.ai/server/@luno-cms/mcp`](https://smithery.ai/server/@luno-cms/mcp) — page exists; body is JS-rendered. No admin edit from this repo. |
| **mcpservers.org** | Live (unverified 2026-09-22) | [`mcpservers.org/servers/luno-rest`](https://mcpservers.org/servers/luno-rest) — Cloudflare challenge blocked a text scrape. Reuse DISCOVERY copy when the form is reachable. |
| **mcp.so** | Submitted (free review) | [chatmcp/mcpso#3707](https://github.com/chatmcp/mcpso/issues/3707) — queued via GitHub issue (not paid $39) |
| **Test B baseline** | Pending | `luno-cms/marketing` `docs/phase2-ai-discovery-baseline.md` — re-run after directory mix is stable |

## mcp.so submission

Free review queue: open a GitHub issue on [`chatmcp/mcpso`](https://github.com/chatmcp/mcpso) (automatable via `npx mcp-submit --only mcp.so`).

| | |
| --- | --- |
| **Status** | Submitted 2026-08-23 — [issue #3707](https://github.com/chatmcp/mcpso/issues/3707) |
| Repository URL | `https://github.com/luno-cms/mcp` |
| Name | `LUNO — AI-era Backend Platform` |
| Description | MCP for LUNO, the AI-era Backend Platform — not the Luno crypto exchange. Agents BUILD/OPERATE (Claude Code, Cursor, Codex). Humans REGISTER/GOVERN. Applications CONSUME. luno.rest · doc.luno.rest · `npx -y @luno-cms/mcp setup`. |

Paid instant path (optional): [mcp.so/submit?type=server](https://mcp.so/submit?type=server) ($39).

## Smithery / hosted HTTPS

Smithery’s “MCP Server URL” form expects **Streamable HTTP**.

**v1 (luno#133):** `npx @luno-cms/mcp serve-http` — Streamable HTTP + `Authorization: Bearer sk-agent-…`. Session keys are isolated (not process env). **No new subdomain.** Production target is `https://stg-api.luno.rest/mcp` / `https://api.luno.rest/mcp` on the existing API Worker (not `mcp.luno.rest` yet). OAuth / SSO is a later slice.

```bash
LUNO_API_URL=https://stg-api.luno.rest/admin npx @luno-cms/mcp serve-http --port 3333
# client: POST http://127.0.0.1:3333/mcp
# header: Authorization: Bearer sk-agent-…
```

## Publish flow (npm + Registry)

```bash
pnpm public-audit && pnpm test && pnpm build
# GitHub Actions → workflow_dispatch → Publish @luno-cms/mcp
# or: git tag vX.Y.Z && git push origin vX.Y.Z  (tag must match package.json)
```

`server.json` version must match `package.json` before Registry publish (`public-audit` enforces this).

## Glama ownership

Org repo: maintainers in root `glama.json`. After changes, **Claim ownership** / **Sync server** on the Glama admin page so metadata refreshes.

Claim + Sync applied 2026-09-22. Live README matches `#65`. Re-sync after the next README / `package.json` description change.
