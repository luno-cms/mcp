# Agent Reliability Harness (Golden Path)

**Issue:** [luno-cms/mcp#10](https://github.com/luno-cms/mcp/issues/10)

## Purpose

Turn the existing Golden Path smoke into a **repeatable CI harness** that emits machine-readable reliability metrics. The primary signal is **successful, low-error agent execution** — not minimizing tool-call count.

## Commands

```bash
# Local (requires LUNO_API_URL + LUNO_AGENT_KEY)
pnpm run golden-path-reliability

# Smoke only (no artifact thresholds)
pnpm run golden-path-smoke
```

## Artifact

`golden-path-reliability.json` (override with `LUNO_RELIABILITY_ARTIFACT_PATH`):

| Field | Meaning |
|-------|---------|
| `metrics.toolCalls` | First-attempt tool sequence length |
| `metrics.errors` | Hard failures during the run |
| `metrics.validationErrors` | Subset tagged as validation errors |
| `metrics.durationMs` | Wall-clock duration |
| `metrics.success` | Task completed |
| `passed` | Threshold evaluation result |
| `warnings` | Soft signals (e.g. high tool-call count) |

## Thresholds (env)

| Variable | Default | Effect |
|----------|---------|--------|
| `LUNO_GP_MAX_ERRORS` | `0` | Hard fail |
| `LUNO_GP_MAX_VALIDATION_ERRORS` | `0` | Hard fail |
| `LUNO_GP_REQUIRE_SUCCESS` | `true` | Hard fail on task failure |
| `LUNO_GP_MAX_TOOL_CALLS_WARNING` | unset | Soft warning only |

## CI

- **mcp repo:** `.github/workflows/golden-path-reliability.yml` (workflow_dispatch + weekly)
- **luno repo:** `.github/workflows/mcp-golden-path-smoke.yml` (daily staging, uses published npm package)

Requires GitHub Environment `staging` secrets: `LUNO_API_URL`, `LUNO_AGENT_KEY`.

## Evidence publication

Copy dated `golden-path-reliability.json` into marketing evidence records (`luno-cms/marketing` `docs/phase2-ai-discovery-baseline.md` appendix) — do **not** claim universal superiority over other backends.
