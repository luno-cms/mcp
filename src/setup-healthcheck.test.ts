import { describe, expect, it } from "vitest";
import { healthcheckLunoConnection } from "./setup-healthcheck.js";

describe("healthcheckLunoConnection", () => {
  it("succeeds on GET /v1/me", async () => {
    const result = await healthcheckLunoConnection({
      apiUrl: "https://api.luno.rest/admin",
      agentKey: "sk-agent-ok",
      fetch: async (input) => {
        expect(String(input)).toBe("https://api.luno.rest/admin/v1/me");
        return new Response(JSON.stringify({ projectId: "prj_1" }), { status: 200 });
      },
    });
    expect(result).toEqual({ ok: true });
  });

  it("fails closed on 401", async () => {
    const result = await healthcheckLunoConnection({
      apiUrl: "https://api.luno.rest/admin",
      agentKey: "sk-agent-bad",
      fetch: async () => new Response("nope", { status: 401 }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/401/);
  });
});
