import { lunoJson, runWithLunoRequestContext, type LunoFetch } from "./luno-api.js";

export type HealthcheckResult = { ok: true } | { ok: false; message: string };

export async function healthcheckLunoConnection(opts: {
  apiUrl: string;
  agentKey: string;
  fetch?: LunoFetch;
}): Promise<HealthcheckResult> {
  try {
    await runWithLunoRequestContext(
      {
        apiUrl: opts.apiUrl,
        agentKey: opts.agentKey,
        funnelId: "setup-healthcheck",
        fetch: opts.fetch,
      },
      async () => {
        await lunoJson("/v1/me");
      }
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
