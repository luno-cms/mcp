# MCP Tool Test Baseline (mcp#15)

Per-tool contract tests — not 49× staging E2E. Golden Path harness remains [RELIABILITY-HARNESS.md](./RELIABILITY-HARNESS.md).

Manifest: `src/tool-registry.ts`. Runner: `src/tool-registry.test.ts`. Output contracts: `src/mcp-output-schemas.ts` + `src/mcp-contract-quality.test.ts`.

## Tiers

| Tier | Applies to | What we assert |
|------|------------|----------------|
| T0 Registration | All 49 | Tool is registered; description non-empty; four annotation hints present |
| T1 Schema | All 49 | No-arg tools have empty `properties`. Others expose typed JSON Schema properties |
| T2 Handler | `mutates: true` | Mocked `lunoJson` / `lunoFormData` is called with the expected path + method |
| T3 Error | `validation: true` (≥15) | Invalid args → MCP error (`isError`) |
| T4 Safety | `safety: true` | `archive_form_set` dryRun/confirmToken; `publish_revision` `/publish`; `propose_change` does not apply; IP delete uses DELETE |
| T5 Contract | All 49 | Every input property has `description`; every tool has `outputSchema`; representative Golden Path tools return `structuredContent` that parses |

## Adding a tool

1. Register it in `server.ts` with `annotations: TOOL_ANNOTATIONS.<name>`.
2. Add the name to `TOOL_ANNOTATIONS` and `TOOL_REGISTRY` (set `noArg` / `mutates` / `validation` / `safety`).
3. If `mutates`, add a T2 case (args + expected Admin API path).
4. If the tool has required/typed input, add a T3 invalid-args case.
5. `pnpm test` — `tool-registry.test.ts` + `tool-annotations.test.ts` must stay green.
