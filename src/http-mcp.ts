/**
 * Streamable HTTP front door for hosted MCP (luno#133 v1).
 *
 * Auth is per request (`Authorization: Bearer sk-agent-…`).
 * LUNO Admin API base comes from `LUNO_API_URL` (same as stdio).
 * No new product subdomain in v1 — production target is `/mcp` on api.luno.rest.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { runWithLunoRequestContext } from "./luno-api.js";
import { createLunoMcpServer } from "./server.js";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Authorization, Content-Type, Accept, Mcp-Session-Id",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
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

export async function handleMcpHttpRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const agentKey = extractBearerToken(request);
  if (!agentKey) {
    return jsonError(401, "UNAUTHORIZED", "Authorization: Bearer sk-agent-… is required");
  }

  const apiUrl = (process.env.LUNO_API_URL ?? "").trim().replace(/\/$/, "");
  if (!apiUrl) {
    return jsonError(503, "MISCONFIGURED", "LUNO_API_URL is not configured on this host");
  }

  return runWithLunoRequestContext(
    { apiUrl, agentKey, funnelId: crypto.randomUUID() },
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

async function incomingToRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? "127.0.0.1";
  const url = `http://${host}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const method = req.method ?? "GET";
  if (method === "GET" || method === "HEAD") {
    return new Request(url, { method, headers });
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks);
  return new Request(url, { method, headers, body: body.length ? body : undefined });
}

export function startMcpHttpServer(opts?: { port?: number; host?: string }): void {
  const port = opts?.port ?? Number(process.env.PORT ?? 3333);
  const host = opts?.host ?? "127.0.0.1";
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const request = await incomingToRequest(req);
      const response = await handleMcpHttpRequest(request);
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      const buf = Buffer.from(await response.arrayBuffer());
      res.end(buf);
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: { code: "INTERNAL", message: "MCP HTTP failed" } }));
    }
  });
  server.listen(port, host, () => {
    console.error(`[luno-mcp] http listening http://${host}:${port}/mcp`);
  });
}
