import { describe, expect, it } from "vitest";
import {
  getLunoAgentKey,
  getLunoApiBase,
  getMcpFunnelId,
  resetMcpFunnelIdForTests,
  runWithLunoRequestContext,
} from "./luno-api.js";

describe("LUNO request context (hosted HTTP)", () => {
  it("prefers AsyncLocalStorage agent key over process env", async () => {
    const prev = process.env.LUNO_AGENT_KEY;
    process.env.LUNO_AGENT_KEY = "sk-agent-env";
    process.env.LUNO_API_URL = "https://api.example/admin";
    try {
      await runWithLunoRequestContext(
        {
          apiUrl: "https://stg-api.luno.rest/admin",
          agentKey: "sk-agent-session-a",
          funnelId: "funnel-a",
        },
        async () => {
          expect(getLunoAgentKey()).toBe("sk-agent-session-a");
          expect(getLunoApiBase()).toBe("https://stg-api.luno.rest/admin");
          expect(getMcpFunnelId()).toBe("funnel-a");
        }
      );
    } finally {
      if (prev === undefined) delete process.env.LUNO_AGENT_KEY;
      else process.env.LUNO_AGENT_KEY = prev;
      resetMcpFunnelIdForTests();
    }
  });

  it("isolates two concurrent sessions", async () => {
    const seen: string[] = [];
    await Promise.all([
      runWithLunoRequestContext(
        { apiUrl: "https://a.example/admin", agentKey: "sk-agent-a", funnelId: "fa" },
        async () => {
          await new Promise((r) => setTimeout(r, 5));
          seen.push(getLunoAgentKey());
        }
      ),
      runWithLunoRequestContext(
        { apiUrl: "https://b.example/admin", agentKey: "sk-agent-b", funnelId: "fb" },
        async () => {
          seen.push(getLunoAgentKey());
        }
      ),
    ]);
    expect(seen.sort()).toEqual(["sk-agent-a", "sk-agent-b"]);
  });
});
