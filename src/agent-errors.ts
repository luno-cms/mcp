/**
 * Format Management API / Zod failures for agents (#58).
 */

export type LunoApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    hint?: string;
    retryable?: boolean;
    meta?: {
      fields?: Record<string, unknown>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  requestId?: string;
};

/** Turn Zod-like issue list into plain-language missing/invalid args. */
export function formatZodLikeIssues(
  issues: Array<{ path?: Array<string | number>; message?: string; code?: string; expected?: string }>
): string {
  if (!issues.length) return "Invalid tool arguments.";
  const parts = issues.map((iss) => {
    const path = (iss.path ?? []).join(".") || "(root)";
    const expected =
      typeof iss.expected === "string" && iss.expected.length > 0
        ? ` (expected ${iss.expected})`
        : "";
    const msg = (iss.message ?? "invalid").replace(/^Invalid input:\s*/i, "");
    if (/undefined|required/i.test(msg) || iss.code === "invalid_type") {
      return `Missing or invalid argument "${path}"${expected}`;
    }
    return `Invalid argument "${path}": ${msg}${expected}`;
  });
  return `${parts.join(". ")}. Fix the arguments and retry (do not retry with the same input).`;
}

/**
 * If text looks like MCP SDK Zod dump, rewrite; otherwise return null.
 */
export function tryFormatMcpInvalidArgumentsMessage(raw: string): string | null {
  const m = raw.match(
    /^(?:Input validation error: )?Invalid arguments for tool (\w+):\s*(\[[\s\S]*\]|[\s\S]+)\s*$/
  );
  if (!m) return null;
  const tool = m[1]!;
  const payload = m[2]!;
  try {
    const issues = JSON.parse(payload) as Array<{
      path?: Array<string | number>;
      message?: string;
      code?: string;
      expected?: string;
    }>;
    if (!Array.isArray(issues)) return null;
    return `Invalid arguments for tool ${tool}: ${formatZodLikeIssues(issues)}`;
  } catch {
    // Already a plain message from Zod error: option — keep tool prefix.
    if (payload.includes("Required:") || !payload.trim().startsWith("[")) {
      return `Invalid arguments for tool ${tool}: ${payload.trim()}. Fix the arguments and retry (do not retry with the same input).`;
    }
    return null;
  }
}

export function formatLunoApiFailure(
  status: number,
  url: string,
  bodyText: string
): string {
  let parsed: LunoApiErrorBody | null = null;
  try {
    parsed = JSON.parse(bodyText) as LunoApiErrorBody;
  } catch {
    parsed = null;
  }
  const err = parsed?.error;
  if (err && typeof err === "object") {
    const message =
      typeof err.message === "string" && err.message.length > 0
        ? err.message
        : bodyText.slice(0, 400);
    const hint =
      typeof err.hint === "string" && err.hint.length > 0 ? err.hint : undefined;
    const retryable =
      typeof err.retryable === "boolean" ? err.retryable : undefined;
    const code = typeof err.code === "string" ? err.code : undefined;
    const fieldErrors = err.meta?.fields;
    const fieldsLine =
      fieldErrors && typeof fieldErrors === "object"
        ? Object.entries(fieldErrors)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("; ") : String(v)}`)
            .join("; ")
        : "";
    const lines = [
      `LUNO API ${status} ${url}`,
      code ? `code=${code}` : null,
      `message=${message}`,
      fieldsLine ? `fields=${fieldsLine}` : null,
      hint ? `hint=${hint}` : null,
      retryable === false
        ? "retryable=false (change input before retrying)"
        : retryable === true
          ? "retryable=true"
          : null,
    ].filter(Boolean);
    return lines.join("\n");
  }
  return `LUNO API ${status} ${url}: ${bodyText.slice(0, 800)}`;
}
