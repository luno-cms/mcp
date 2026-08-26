import { afterEach, describe, expect, it } from "vitest";
import { handleMcpHttpRequest } from "./http-mcp.js";

describe("handleMcpHttpRequest", () => {
  const prevUrl = process.env.LUNO_API_URL;

  afterEach(() => {
    if (prevUrl === undefined) delete process.env.LUNO_API_URL;
    else process.env.LUNO_API_URL = prevUrl;
  });

  it("returns 401 when Authorization is missing on tools/call", async () => {
    process.env.LUNO_API_URL = "https://stg-api.luno.rest/admin";
    const res = await handleMcpHttpRequest(
      new Request("http://127.0.0.1/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "get_project_overview", arguments: {} },
        }),
      })
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("allows initialize without Authorization so Smithery can scan", async () => {
    process.env.LUNO_API_URL = "https://stg-api.luno.rest/admin";
    const res = await handleMcpHttpRequest(
      new Request("http://127.0.0.1/mcp", {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "smithery-scan", version: "0" },
          },
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result?: { serverInfo?: { name?: string } };
    };
    expect(body.result?.serverInfo?.name).toBe("luno");
  });

  it("accepts a raw sk-agent key on Authorization without Bearer", async () => {
    const res = await handleMcpHttpRequest(
      new Request("http://127.0.0.1/mcp", {
        method: "POST",
        headers: {
          authorization: "sk-agent-x",
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "get_project_overview", arguments: {} },
        }),
      }),
      {
        apiUrl: "https://stg-api.luno.rest/admin",
        fetch: async () =>
          new Response(JSON.stringify({ projectId: "raw-header" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result?: { content?: Array<{ text?: string }> };
    };
    expect(body.result?.content?.[0]?.text).toContain("raw-header");
  });

  it("accepts LUNO_AGENT_KEY when Authorization is reserved by a gateway", async () => {
    const res = await handleMcpHttpRequest(
      new Request("http://127.0.0.1/mcp", {
        method: "POST",
        headers: {
          luno_agent_key: "sk-agent-x",
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "get_project_overview", arguments: {} },
        }),
      }),
      {
        apiUrl: "https://stg-api.luno.rest/admin",
        fetch: async () =>
          new Response(JSON.stringify({ projectId: "alt-header" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result?: { content?: Array<{ text?: string }> };
    };
    expect(body.result?.content?.[0]?.text).toContain("alt-header");
  });

  it("uses opts.apiUrl so the Worker can point at itself", async () => {
    delete process.env.LUNO_API_URL;
    const res = await handleMcpHttpRequest(
      new Request("http://127.0.0.1/mcp", { method: "POST" }),
      { apiUrl: "https://stg-api.luno.rest/admin" }
    );
    expect(res.status).toBe(401);
  });

  it("forwards opts.fetch so hosted tools skip the public origin", async () => {
    const res = await handleMcpHttpRequest(
      new Request("http://127.0.0.1/mcp", {
        method: "POST",
        headers: {
          authorization: "Bearer sk-agent-x",
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "get_project_overview", arguments: {} },
        }),
      }),
      {
        apiUrl: "https://stg-api.luno.rest/admin",
        fetch: async () =>
          new Response(JSON.stringify({ projectId: "in-process" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result?: { isError?: boolean; content?: Array<{ text?: string }> };
    };
    expect(body.result?.isError).not.toBe(true);
    expect(body.result?.content?.[0]?.text).toContain("in-process");
  });

  it("returns 204 on CORS preflight", async () => {
    const res = await handleMcpHttpRequest(
      new Request("http://127.0.0.1/mcp", { method: "OPTIONS" })
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
