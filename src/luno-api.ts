/** LUNO 管理 API（`…/admin` を含むベース + Bearer エージェントキー） */

import { formatLunoApiFailure } from "./agent-errors.js";

/** MCP プロセス単位の funnel（event-spec）。stdio 再接続で新しい UUID。 */
let processFunnelId: string | null = null;

export function getMcpFunnelId(): string {
  if (!processFunnelId) {
    processFunnelId = crypto.randomUUID();
  }
  return processFunnelId;
}

/** テスト用 */
export function resetMcpFunnelIdForTests(): void {
  processFunnelId = null;
}

export function getLunoApiBase(): string {
  const raw = (process.env.LUNO_API_URL ?? "").trim().replace(/\/$/, "");
  if (!raw) {
    throw new Error("LUNO_API_URL is required (e.g. http://127.0.0.1:8787/admin)");
  }
  return raw;
}

export function getLunoAgentKey(): string {
  const k = (process.env.LUNO_AGENT_KEY ?? "").trim();
  if (!k) {
    throw new Error(
      "LUNO_AGENT_KEY is required (sk-agent-… from the LUNO console). Set via `npx @luno-cms/mcp env set-key <env> 'sk-agent-…'` then reconnect MCP. retryable=false"
    );
  }
  return k;
}

function measurementHeaders(): Record<string, string> {
  return {
    "X-Luno-Funnel-Id": getMcpFunnelId(),
    "X-Luno-Client": "mcp",
  };
}

async function parseLunoResponse(res: Response, url: string): Promise<unknown> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatLunoApiFailure(res.status, url, text));
  }
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function lunoJson(
  path: string,
  opts?: { method?: string; json?: unknown; headers?: Record<string, string> }
): Promise<unknown> {
  const base = getLunoApiBase();
  const key = getLunoAgentKey();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    ...measurementHeaders(),
    ...(opts?.headers ?? {}),
  };
  let body: string | undefined;
  if (opts?.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  const res = await fetch(url, {
    method: opts?.method ?? "GET",
    headers,
    body,
  });
  return parseLunoResponse(res, url);
}

/** multipart（Content-Type は boundary 付きで fetch に任せる） */
export async function lunoFormData(
  path: string,
  form: FormData,
  opts?: { method?: string }
): Promise<unknown> {
  const base = getLunoApiBase();
  const key = getLunoAgentKey();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: opts?.method ?? "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...measurementHeaders(),
    },
    body: form,
  });
  return parseLunoResponse(res, url);
}
