# Contributing

This repository is public so third parties can **verify** `@luno-cms/mcp` (code, issues, releases).

## Welcome

- Bug reports and documentation fixes
- Small, well-tested patches that do not assume unreleased LUNO API behavior

## Not in scope here

- LUNO hosted API, Console, billing, or infrastructure (private `luno-cms/luno`, issue #71)
- Features that require an unpublished management API

The HTTP contract is owned by hosted LUNO (`LUNO_API_URL` + agent key). MCP only wraps that API.

## Dev

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm public-audit
```

Please follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## MCP tool schemas (#92)

New or changed tools must pass the [Schema Quality checklist](./docs/SCHEMA_QUALITY.md): typed Zod modules, `.describe()` on fields, Resource / `agent.*` cross-links, and tests for common failure shapes. CI runs `schema-quality.test.ts` with `pnpm test`.
