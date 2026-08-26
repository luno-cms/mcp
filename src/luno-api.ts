/** LUNO 管理 API（`…/admin` を含むベース + Bearer エージェントキー） */

import { AsyncLocalStorage } from "node:async_hooks";
import { formatLunoApiFailure } from "./agent-errors.js";

/** Hosted Worker は公開 origin への自己 fetch（522）を避けるためこれを渡す。 */
export type LunoFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type LunoRequestContext = {
  apiUrl: string;
  agentKey: string;
  funnelId: string;
  agentRunId?: string | null;
  fetch?: LunoFetch;
};

const requestContext = new AsyncLocalStorage<LunoRequestContext>();

export function runWithLunoRequestContext<T>(
  ctx: LunoRequestContext,
  fn: () => T
): T {
  return requestContext.run({ ...ctx, agentRunId: ctx.agentRunId ?? null }, fn);
}

function activeContext(): LunoRequestContext | undefined {
  return requestContext.getStore();
}

/** MCP プロセス単位の funnel（event-spec）。stdio 再接続で新しい UUID。 */
let processFunnelId: string | null = null;

/** 現在の Agent Run（start_agent_run 後に設定。end でクリア）。 */
let activeAgentRunId: string | null = null;

export function getMcpFunnelId(): string {
  const ctx = activeContext();
  if (ctx) return ctx.funnelId;
  if (!processFunnelId) {
    processFunnelId = crypto.randomUUID();
  }
  return processFunnelId;
}

/** テスト用 */
export function resetMcpFunnelIdForTests(): void {
  processFunnelId = null;
}

export function setActiveAgentRunId(runId: string | null): void {
  const ctx = activeContext();
  const next = runId?.trim() || null;
  if (ctx) {
    ctx.agentRunId = next;
    return;
  }
  activeAgentRunId = next;
}

export function getActiveAgentRunId(): string | null {
  const ctx = activeContext();
  if (ctx) return ctx.agentRunId ?? null;
  return activeAgentRunId;
}

/** テスト用 */
export function resetActiveAgentRunIdForTests(): void {
  activeAgentRunId = null;
}

export function getLunoApiBase(): string {
  const fromCtx = activeContext()?.apiUrl.trim().replace(/\/$/, "");
  const raw = (fromCtx || process.env.LUNO_API_URL || "").trim().replace(/\/$/, "");
  if (!raw) {
    throw new Error("LUNO_API_URL is required (e.g. http://127.0.0.1:8787/admin)");
  }
  return raw;
}

export function getLunoAgentKey(): string {
  const fromCtx = activeContext()?.agentKey.trim();
  const k = (fromCtx || process.env.LUNO_AGENT_KEY || "").trim();
  if (!k) {
    throw new Error(
      "LUNO_AGENT_KEY is required (sk-agent-… from the LUNO console). Set via `npx @luno-cms/mcp env set-key <env> 'sk-agent-…'` then reconnect MCP. retryable=false"
    );
  }
  return k;
}

function getLunoFetch(): LunoFetch {
  return activeContext()?.fetch ?? globalThis.fetch;
}

function measurementHeaders(): Record<string, string> {
  return {
    "X-Luno-Funnel-Id": getMcpFunnelId(),
    "X-Luno-Client": "mcp",
  };
}

function agentRunHeaders(): Record<string, string> {
  const id = getActiveAgentRunId();
  return id ? { "X-Agent-Run-Id": id } : {};
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
    ...agentRunHeaders(),
    ...(opts?.headers ?? {}),
  };
  let body: string | undefined;
  if (opts?.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }
  const res = await getLunoFetch()(url, {
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
  const res = await getLunoFetch()(url, {
    method: opts?.method ?? "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...measurementHeaders(),
      ...agentRunHeaders(),
    },
    body: form,
  });
  return parseLunoResponse(res, url);
}
