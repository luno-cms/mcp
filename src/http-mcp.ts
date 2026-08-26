/**
 * Streamable HTTP front door for hosted MCP (luno#133 v1).
 * Workers-safe: no node:http. Node listener lives in http-mcp-node.ts.
 *
 * Auth is per request (`Authorization: Bearer sk-agent-…`).
 * Admin API base: opts.apiUrl or LUNO_API_URL.
 * Public path: /mcp on api.luno.rest (no mcp.luno.rest in v1).
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { runWithLunoRequestContext, type LunoFetch } from "./luno-api.js";
import { createLunoMcpServer } from "./server.js";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Authorization, Content-Type, Accept, Mcp-Session-Id",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
};

export type HandleMcpHttpOptions = {
  /** Override Admin API base (Worker mount uses `${origin}/admin`). */
  apiUrl?: string;
  /** In-process Admin dispatch for the same Worker (avoids public-origin 522). */
  fetch?: LunoFetch;
};

export function extractBearerToken(request: Request): string | null {
  const raw = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)/i.exec(raw);
  const token = match?.[1]?.trim() ?? "";
  return token || null;
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export async function handleMcpHttpRequest(
  request: Request,
  opts?: HandleMcpHttpOptions
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const agentKey = extractBearerToken(request);
  if (!agentKey) {
    return jsonError(401, "UNAUTHORIZED", "Authorization: Bearer sk-agent-… is required");
  }

  const apiUrl = (opts?.apiUrl ?? process.env.LUNO_API_URL ?? "").trim().replace(/\/$/, "");
  if (!apiUrl) {
    return jsonError(503, "MISCONFIGURED", "LUNO_API_URL is not configured on this host");
  }

  return runWithLunoRequestContext(
    { apiUrl, agentKey, funnelId: crypto.randomUUID(), fetch: opts?.fetch },
    async () => {
      const mcp = createLunoMcpServer();
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      await mcp.connect(transport);
      const res = await transport.handleRequest(request);
      return withCors(res);
    }
  );
}
