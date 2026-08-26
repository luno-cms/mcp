import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { handleMcpHttpRequest } from "./http-mcp.js";

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
