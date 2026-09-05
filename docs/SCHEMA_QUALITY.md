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
| `migrate_field_to_master_reference` | ✅ (preview only; execute via `propose_change`) | `choice-source-migration-schema.ts` |

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
- [mcp#13](https://github.com/luno-cms/mcp/issues/13) — Tool annotations (**CLOSED** — shipped governance metadata, not a remaining implementation ticket)
- [mcp#15](https://github.com/luno-cms/mcp/issues/15) — Tool test coverage baseline (**CLOSED**)
- [mcp#14](https://github.com/luno-cms/mcp/issues/14) — Setup-path shell hardening (**CLOSED**)

---

## Output contract (Agent chaining)

Input quality (#92) is necessary but not sufficient. Tools now also advertise `outputSchema` and return `structuredContent` next to the existing `content[0].text` JSON.

- Module: [`src/mcp-output-schemas.ts`](../src/mcp-output-schemas.ts)
- Tests: [`src/mcp-contract-quality.test.ts`](../src/mcp-contract-quality.test.ts)
- Inventory / naming / config: [AGENT_UX_AUDIT.md](./AGENT_UX_AUDIT.md)

Do **not** stamp `z.unknown()` as the whole output. Do **not** drop text for structured-only. Do **not** rename tools to chase directory scores.

---

## Three complementary contracts (shipped)

`#92` (this document), `mcp#13` (annotations), and `mcp#15` (tests) are **different contracts**. All three are **CLOSED**. Do not reopen them as M8ven follow-ups.

| Layer | Issue | Contract | Status |
|-------|-------|----------|--------|
| Schema Quality | luno#92 | Input shape, descriptions, forbidden forms, Resource links — how the agent *fills* a tool | CLOSED |
| Behavior / Governance metadata | [mcp#13](https://github.com/luno-cms/mcp/issues/13) | `readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint` — how the agent *predicts side effects* | CLOSED |
| Regression protection | [mcp#15](https://github.com/luno-cms/mcp/issues/15) | Per-tool contract / happy path / error behavior | CLOSED |

Annotations are Governance infrastructure (AI agent operates the backend; humans govern). They are not a M8ven workaround. **Do not stamp the same hint values on all 49 tools.**

`mcp#15` is a baseline, not 49/49 E2E. Golden Path harness remains the staging E2E path.

On Golden Path (#101, CLOSED): treat `mcp#13` as a **shipped MCP contract capability** already in the path — not an issue still to implement.

---

## M8ven wrap-up (CEO, 2026-08-26)

**Engineering side is done.** Do not file more M8ven-derived product issues.

```text
M8ven Audit
    ↓
Code Audit
    ↓
Confirmed / Partial / False Positive
    ↓
Issue化
    ↓
Implementation
    ↓
All M8ven-derived Issues CLOSED
```

| Issue | What | Status |
|-------|------|--------|
| [mcp#13](https://github.com/luno-cms/mcp/issues/13) | Tool Annotations | CLOSED |
| [mcp#14](https://github.com/luno-cms/mcp/issues/14) | Shell execution audit | CLOSED |
| [mcp#15](https://github.com/luno-cms/mcp/issues/15) | Tool Test Coverage | CLOSED |
| [luno#92](https://github.com/luno-cms/luno/issues/92) | Schema Quality | CLOSED |

```text
M8ven
├─ Audit                 ✅
├─ Annotations           ✅
├─ Schema Quality        ✅
├─ Test Coverage         ✅
├─ Shell Audit           ✅
├─ Publisher Verified    ✅  commonld.com (@luno-cms)  — 2026-08-26
├─ Live Monitored        ✅  every push re-verified
└─ Score / Grade refresh → automatic on next snapshot (do not chase)
```

This is not “listed on M8ven.” It is a **continuous external Trust Layer**: M8ven confirmed LUNO as the official publisher and re-verifies on every GitHub push.

```text
LUNO
 │
 ├─ Open Source / README       ✅
 ├─ Code Verified              ✅
 ├─ Publisher Verified         ✅
 └─ Live Monitored             ✅
        │
        └─ every GitHub push → re-verify
```

Use this chain as **external evidence** for *AI agents build and operate production backends, humans govern*. Do **not** put **74/100** in current marketing. M8ven states **new projects cap at C until adoption is earned** — Grade C is not a statement of current code quality.

On-screen Quality Suggestions (annotations, hints, input validation, test coverage, shell execution) are **the previous snapshot**. mcp#13 / #14 / #15 and luno#92 already closed those. **Do not implement more from the stale 74/C screen.** Live Monitored will pick up shipped fixes on the next snapshot.

### Do not cite the pre-fix snapshot as current quality

The published Trust Index line **74/100 / C / 42 tools** is a snapshot from **before** the `v0.2.31` / 49-tool hardening. **Do not use it as a statement of current LUNO quality.**

Always record **version + commit + timestamp + tool count** as one set.

| Source | Snapshot (record together) |
|--------|----------------------------|
| M8ven Trust Index (pre-fix score) | 74/100 · Grade C / Emerging @ [m8ven.ai/mcp/luno-cms-mcp-d3ndif](https://m8ven.ai/mcp/luno-cms-mcp-d3ndif) — **42 tools** — **historical score only** |
| M8ven publisher / monitor (2026-08-26) | **Publisher Verified** `commonld.com (@luno-cms)` · **Live Monitored** (0 days · every push re-verified) — **current trust signals** |
| LUNO code audit | **49 tools** @ `@luno-cms/mcp` **v0.2.31** — `luno-cms/mcp` `main`, **2026-08-25** |
| After mcp#13 / #14 / #15 landed | `@luno-cms/mcp` **v0.2.33+** on `main` — still 49 `registerTool` calls; annotations + setup-path hardening shipped |

If a later re-scan is recorded, add a new dated row. Do not overwrite the historical 74/100 line.

---

## External evaluation loop (still the rule)

Accept nothing from an external scan without verifying current source:

```text
External scan (M8ven / Glama / MCP Registry / Benchmark / Security / Golden Path)
        ↓
Code audit (read the actual registerTool / handlers)
        ↓
Confirmed / Partial / False Positive
        ↓
Existing Issue integration  or  New Issues (only if it is a real product gap)
```

The same loop applies to every Category Authority signal. After this wrap-up, a new M8ven finding is **not** automatically a new Issue.

---

## Roadmap after the cut

M8ven work is closed as a track. The locked Foundation → Golden Path sequence is **already shipped** (do not reopen):

```text
#98 Public Abuse Protection          CLOSED
      ↓
#99 Soft-delete Restore              CLOSED
      ↓
#100 Project Export                  CLOSED
      ↓
Foundation Baseline Complete
      ↓
#101 Agent Backend Golden Path       CLOSED
      ├─ #90 Discover                CLOSED
      ├─ #92 Schema / Agent UX       CLOSED
      ├─ mcp#13 Annotations          CLOSED (capability in the path, not a TODO)
      └─ #91 Preview / Approval      CLOSED
```

Remaining **open** work in `luno-cms/luno` is not M8ven: #95 hub, #89 epic backlog, #132 Benchmark (optional category evidence), #67 mcp.so listing, #71 OSS decision. Hub: [luno#95](https://github.com/luno-cms/luno/issues/95).
