# MCP Resources inventory (#90)

**Source of truth:** `luno-cms/mcp` (this repository). Resources ship inside `@luno-cms/mcp` — not served by LUNO Admin API.

**Why not API-served?** Resources are static agent UX documentation. They must work offline from tool schemas and match npm package releases independently of API deploys.

## URI catalog (v1)

| URI | Name | Purpose |
|-----|------|---------|
| `luno://forms/field-types` | field-types | Field types + snapshot value shapes |
| `luno://content/schema-guide` | schema-guide | Form Set / entry / revision hierarchy |
| `luno://publishing-guide` | publishing-guide | Draft → publish, `can_publish`, public API |
| `luno://permissions` | permissions | Agent scopes, blocked actions, archive token |
| `luno://api-reference` | api-reference | Tool cheat sheet (not OpenAPI dump) |

Implementation: `src/mcp-resources.ts` → `registerMcpResources()` in `src/server.ts`.

## vs NomaCMS / competitors

We ship a **small high-signal set** aligned to LUNO Trust Layer (#74/#75):

| We include | We deliberately skip (v1) |
|------------|---------------------------|
| Field types + snapshot shapes | Full OpenAPI as a Resource |
| Publishing + approval gates | Console help 1:1 mirror |
| Permissions / safety boundaries | Bulk ops (#94) |
| API orientation | Dynamic per-tenant schema as only Resource |

Per-tenant live schema remains **`get_form_set_schema`** / **`get_tenant_schema`** tools.

## Golden Path / smoke

`golden-path-smoke` calls `resources/list` and `resources/read` for required URIs before tool chain. This verifies Resources reduce need for exploratory calls (agents can read field-types + publishing-guide without hitting Admin API).

## Maintenance

When product behavior changes (new field type, publish rule, permission boundary):

1. Update `src/mcp-resources.ts` body text
2. Bump `@luno-cms/mcp` patch version
3. Cross-check `doc.luno.rest` / admin-help if user-facing wording diverges
