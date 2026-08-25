/**
 * Run Golden Path smoke and emit a machine-readable reliability artifact (mcp#10).
 *
 * Env: LUNO_API_URL, LUNO_AGENT_KEY (same as golden-path-smoke)
 * Optional:
 *   LUNO_RELIABILITY_ARTIFACT_PATH — write JSON report (default: golden-path-reliability.json)
 *   LUNO_GP_MAX_ERRORS, LUNO_GP_MAX_VALIDATION_ERRORS, LUNO_GP_REQUIRE_SUCCESS
 *   LUNO_GP_MAX_TOOL_CALLS_WARNING — soft warning only
 */
import { readFileSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildGoldenPathReliabilityReport,
  readReliabilityThresholdsFromEnv,
} from "./golden-path-reliability.js";
import { runGoldenPathSmoke } from "./golden-path-smoke.js";

function packageVersion(): string {
  try {
    const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function runGoldenPathReliability(): Promise<{
  reportPath: string;
  report: ReturnType<typeof buildGoldenPathReliabilityReport>;
}> {
  const started = Date.now();
  const thresholds = readReliabilityThresholdsFromEnv();
  const templateSlug =
    (process.env.LUNO_GOLDEN_PATH_TEMPLATE_SLUG ?? "blog").trim() || "blog";
  const apiUrl = (process.env.LUNO_API_URL ?? "").trim();

  let toolCallSequence: string[] = [];
  let errors = 0;
  let validationErrors = 0;
  let success = false;
  let errorMessage: string | undefined;
  let result:
    | Awaited<ReturnType<typeof runGoldenPathSmoke>>
    | undefined;

  try {
    result = await runGoldenPathSmoke();
    toolCallSequence = result.toolCalls;
    success = true;
  } catch (e) {
    errors += 1;
    errorMessage = e instanceof Error ? e.message : String(e);
    if (/VALIDATION_ERROR/i.test(errorMessage)) {
      validationErrors += 1;
    }
  }

  const durationMs = Date.now() - started;
  const uniqueTools = new Set(toolCallSequence).size;
  const report = buildGoldenPathReliabilityReport({
    runAt: new Date().toISOString(),
    environment: {
      apiUrl,
      mcpVersion: packageVersion(),
      nodeVersion: process.version,
      templateSlug,
    },
    metrics: {
      toolCalls: toolCallSequence.length,
      uniqueTools,
      errors,
      validationErrors,
      durationMs,
      success,
    },
    toolCallSequence,
    thresholds,
    ...(result
      ? {
          result: {
            funnelId: result.funnelId,
            formSetId: result.formSetId,
            formSetSlug: result.formSetSlug,
            entryId: result.entryId,
            entrySlug: result.entrySlug,
            publicEntryUrl: result.publicEntryUrl,
          },
        }
      : {}),
    ...(errorMessage ? { errorMessage } : {}),
  });

  const reportPath =
    process.env.LUNO_RELIABILITY_ARTIFACT_PATH?.trim() ||
    "golden-path-reliability.json";
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return { reportPath, report };
}

const isMain =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  runGoldenPathReliability()
    .then(({ reportPath, report }) => {
      console.log(JSON.stringify({ artifact: reportPath, passed: report.passed }, null, 2));
      if (!report.passed) {
        console.error(report.failureReasons.join("; "));
        process.exitCode = 1;
      }
    })
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    });
}
