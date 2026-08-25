# MCP Tool Schema Quality (#92)

Systematic **Schema = UI** audit for `@luno-cms/mcp` tools. Agents should not need trial-and-error to learn JSON shapes.

This is an **Agent-native MCP Schema Quality** engineering standard — not a one-off experiment and not an M8ven score chase. LUNO's own measurement (same backend task: **142 tool calls → 11**, 0 errors, application behavior unchanged) and M8ven's external schema-quality gap agree: improving the MCP input contract changes agent behavior more than adding tools.

## Checklist (per tool)

| # | Criterion |
|---|-----------|
| 1 | `description` states required fields and forbidden shapes |
| 2 | `inputSchema` property names match API (no alias traps) |
| 3 | enums / const documented where agents guess strings |
| 4 | nested object shapes explicit — with example or Resource link |
| 5 | negative constraints (“do not send X”) where agents commonly fail |
| 6 | cross-links to Resources (`luno://…`) or `agent.*` help articles |
| 7 | error messages reinforce schema (#58 `agent-errors.ts`) |

## P0 inventory (mutating content / schema / forms)

| Tool | Status | Schema module |
|------|--------|---------------|
| `save_revision` | ✅ | `snapshot-schema.ts` |
| `apply_form_blueprint` | ✅ | `form-blueprint-schema.ts` |
| `validate_master_blueprint` | ✅ | `master-blueprint-schema.ts` |
| `apply_master_blueprint` | ✅ | `master-blueprint-schema.ts` |
| `create_contact_form` | ✅ (pre-#69) | `contact-form-fields.ts` |
| `update_contact_form` | ✅ (pre-#69) | `contact-form-fields.ts` |
| `upload_media` | ✅ | `upload-media-schema.ts` |
| `apply_builtin_form_template` | ✅ | `apply-builtin-template-schema.ts` |
| `publish_revision` | ✅ | shared ID schemas + description |

## Regression

- `pnpm test` — unit tests per schema module + `schema-quality.test.ts` + [tool-registry.test.ts](../src/tool-registry.test.ts) (mcp#15 T0–T4)
- `pnpm golden-path-smoke` — end-to-end against staging (private `luno-cms/luno` CI)
- Known #69 scenario: Contact Form `fields` vs Form Set `fieldKey` — covered by `contact-form-fields.test.ts` and `form-blueprint-schema.test.ts`
- Test tier expectations: [TOOL_TESTING.md](./TOOL_TESTING.md)

## Adding a new tool (release gate)

1. Add Zod schema in `src/*-schema.ts` (not inline `z.record(unknown)` for nested payloads).
2. Every required field: `.describe()` with API name and where to obtain the value.
3. Mention forbidden shapes in description **and** schema `.describe()` where agents confuse shapes.
4. Link at least one of: `luno://…` Resource, `agent.*` help article, or sibling tool name.
5. Add tests: happy path + one common failure shape.
6. Extend `schema-quality.test.ts` if the tool is P0 mutating.

## Related issues

- #55 — descriptions mention required keys
- #58 — agent-readable errors
- #69 — Contact Form fields shape
- #90 — MCP Resources (`luno://forms/field-types`, etc.)
- [mcp#13](https://github.com/luno-cms/mcp/issues/13) — Tool annotations (behavior / governance metadata; parallel contract)
- [mcp#15](https://github.com/luno-cms/mcp/issues/15) — Tool test coverage baseline (regression protection)
- [mcp#14](https://github.com/luno-cms/mcp/issues/14) — Setup-path shell hardening (P2, out of this track)

---

## Three complementary contracts (CEO, 2026-08-25)

`#92` (this document), `mcp#13` (annotations), and `mcp#15` (tests) are **different contracts**. `#92` and `mcp#13` proceed in parallel — neither waits on the other. `mcp#15` is the third layer in the same program; the locked roadmap sequences it after the first `#101` slice.

```text
Foundation Complete
        ↓
   #101 Golden Path
        │
        ├── #92 Schema / Agent UX
        │
        ├── mcp#13 Annotations
        │
        └── mcp#15 Test Baseline
```

| Layer | Issue | Contract |
|-------|-------|----------|
| Schema Quality | luno#92 | Input shape, descriptions, forbidden forms, Resource links — how the agent *fills* a tool |
| Behavior / Governance metadata | [mcp#13](https://github.com/luno-cms/mcp/issues/13) | `readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint` — how the agent *predicts side effects* before calling |
| Regression protection | [mcp#15](https://github.com/luno-cms/mcp/issues/15) | Per-tool contract / happy path / error behavior — how we *keep* the first two layers from regressing |

Annotations are Governance infrastructure for LUNO's product story (AI agent operates the backend; humans govern). They are not a M8ven workaround. **Do not stamp the same hint values on all 49 tools.**

`mcp#15` is a baseline, not 49/49 E2E. Goal: every tool can be continuously verified at contract / happy path / error behavior. Do not force full staging E2E onto every tool (that remains the Golden Path harness).

`mcp#14` is **P2**, separate. The flagged `execSync("which codex")` is a fixed command, no user input, not MCP runtime, setup/CLI only — **not a security vulnerability**. Replace with a library / `spawnSync` API if convenient; do not treat "zero shell" as a P0.

Implementation of `#92` + `mcp#13` + `mcp#15` starts when Foundation is closed and `#101` begins — not before. Current NOW path is unchanged:

```text
#98 Public Abuse Protection
        ↓
#99 Soft-delete Restore
        ↓
#100 Project Export
        ↓
Foundation Baseline Complete
        ↓
#101 Agent Backend Golden Path
        │
        ├── #90 Discover
        ├── #92 Schema / Agent UX
        ├── mcp#13 Tool Annotations
        └── #91 Preview / Human Approval / Publish
        ↓
mcp#15 Test Coverage
        ↓
#93 → #94
        ↓
Category Authority
```

---

## External evaluation → engineering roadmap

The valuable output of the 2026-08-25 M8ven review is the **feedback loop**, not the 74/100 score:

```text
External scan (M8ven / Glama / MCP Registry / Benchmark / Security / Golden Path)
        ↓
Code audit (read the actual registerTool / handlers)
        ↓
Confirmed / Partial / False Positive
        ↓
Existing Issue integration  or  New Issues
```

Accept nothing from an external scan without verifying current source. The same loop applies to every Category Authority signal.

### Snapshot hygiene — never mix sources

M8ven reported **42 tools**. This package had **49** `mcp.registerTool` calls at the audit. That is snapshot lag (external index vs current package), not an error in either count.

Always record **version + commit + timestamp + tool count** as one set. Do not collapse an external score and an internal inventory into one number.

| Source | Snapshot (record together) |
|--------|----------------------------|
| M8ven Trust Index | 74/100 Code Verified @ [m8ven.ai/mcp/luno-cms-mcp-d3ndif](https://m8ven.ai/mcp/luno-cms-mcp-d3ndif) — **42 tools** in that scan |
| LUNO code audit | **49 tools** @ `@luno-cms/mcp` **v0.2.31** — `luno-cms/mcp` `main`, **2026-08-25** |
| This document's repo HEAD when the addendum landed | `@luno-cms/mcp` **v0.2.33** @ `c1e78b3` (2026-08-25) — still 49 `registerTool` calls |

When citing Category Authority later, write two lines:

```text
M8ven: 74/100 @ snapshot X (42 tools)
LUNO:  49 tools @ v0.2.31 (2026-08-25 audit)
```
