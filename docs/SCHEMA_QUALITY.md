# MCP Tool Schema Quality (#92)

Systematic **Schema = UI** audit for `@luno-cms/mcp` tools. Agents should not need trial-and-error to learn JSON shapes.

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

- `pnpm test` — unit tests per schema module + `schema-quality.test.ts`
- `pnpm golden-path-smoke` — end-to-end against staging (private `luno-cms/luno` CI)
- Known #69 scenario: Contact Form `fields` vs Form Set `fieldKey` — covered by `contact-form-fields.test.ts` and `form-blueprint-schema.test.ts`

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
