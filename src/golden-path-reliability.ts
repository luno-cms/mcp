/**
 * Machine-readable Golden Path reliability report (mcp#10).
 * Primary signal: successful, low-error execution — not minimal tool-call count.
 */

export const GOLDEN_PATH_RELIABILITY_SCHEMA_VERSION = 1 as const;

export type GoldenPathReliabilityThresholds = {
  /** Hard fail when tool chain reports errors (default 0). */
  maxErrors: number;
  /** Hard fail on validation-class errors if tracked separately (default 0). */
  maxValidationErrors: number;
  /** Hard fail when the smoke task does not complete (default true). */
  requireSuccess: boolean;
  /** Optional soft ceiling — breach adds warning, not failure (marketing guardrail). */
  maxToolCallsWarning?: number;
};

export type GoldenPathReliabilityMetrics = {
  toolCalls: number;
  uniqueTools: number;
  errors: number;
  validationErrors: number;
  durationMs: number;
  success: boolean;
};

export type GoldenPathReliabilityReport = {
  schemaVersion: typeof GOLDEN_PATH_RELIABILITY_SCHEMA_VERSION;
  runAt: string;
  environment: {
    apiUrl: string;
    mcpVersion: string;
    nodeVersion: string;
    templateSlug: string;
  };
  metrics: GoldenPathReliabilityMetrics;
  toolCallSequence: string[];
  thresholds: GoldenPathReliabilityThresholds;
  passed: boolean;
  warnings: string[];
  failureReasons: string[];
  result?: {
    funnelId: string;
    formSetId: string;
    formSetSlug: string;
    entryId: string;
    entrySlug: string;
    publicEntryUrl: string;
  };
  errorMessage?: string;
};

export function readReliabilityThresholdsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): GoldenPathReliabilityThresholds {
  const maxErrors = parseNonNegativeInt(env.LUNO_GP_MAX_ERRORS, 0);
  const maxValidationErrors = parseNonNegativeInt(
    env.LUNO_GP_MAX_VALIDATION_ERRORS,
    0,
  );
  const requireSuccess = env.LUNO_GP_REQUIRE_SUCCESS !== "false";
  const maxToolCallsWarning = env.LUNO_GP_MAX_TOOL_CALLS_WARNING
    ? parseNonNegativeInt(env.LUNO_GP_MAX_TOOL_CALLS_WARNING, 15)
    : undefined;
  return {
    maxErrors,
    maxValidationErrors,
    requireSuccess,
    maxToolCallsWarning,
  };
}

function parseNonNegativeInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function evaluateGoldenPathReliability(
  input: {
    metrics: GoldenPathReliabilityMetrics;
    toolCallSequence: string[];
    thresholds: GoldenPathReliabilityThresholds;
  },
): Pick<GoldenPathReliabilityReport, "passed" | "warnings" | "failureReasons"> {
  const warnings: string[] = [];
  const failureReasons: string[] = [];

  if (input.thresholds.requireSuccess && !input.metrics.success) {
    failureReasons.push("golden_path_task_failed");
  }
  if (input.metrics.errors > input.thresholds.maxErrors) {
    failureReasons.push(
      `errors ${input.metrics.errors} > max ${input.thresholds.maxErrors}`,
    );
  }
  if (input.metrics.validationErrors > input.thresholds.maxValidationErrors) {
    failureReasons.push(
      `validation_errors ${input.metrics.validationErrors} > max ${input.thresholds.maxValidationErrors}`,
    );
  }
  const warnAt = input.thresholds.maxToolCallsWarning;
  if (warnAt !== undefined && input.metrics.toolCalls > warnAt) {
    warnings.push(
      `tool_calls ${input.metrics.toolCalls} exceeds soft warning threshold ${warnAt}`,
    );
  }

  return {
    passed: failureReasons.length === 0,
    warnings,
    failureReasons,
  };
}

export function buildGoldenPathReliabilityReport(
  partial: Omit<
    GoldenPathReliabilityReport,
    "schemaVersion" | "passed" | "warnings" | "failureReasons"
  >,
): GoldenPathReliabilityReport {
  const evaluation = evaluateGoldenPathReliability({
    metrics: partial.metrics,
    toolCallSequence: partial.toolCallSequence,
    thresholds: partial.thresholds,
  });
  return {
    schemaVersion: GOLDEN_PATH_RELIABILITY_SCHEMA_VERSION,
    ...partial,
    ...evaluation,
  };
}
