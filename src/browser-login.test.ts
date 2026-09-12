import { describe, expect, it } from "vitest";
import {
  isSafeAuthorizeUrl,
  runBrowserLogin,
} from "./browser-login.js";

const sessionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("isSafeAuthorizeUrl", () => {
  it("allows console cli-login only", () => {
    expect(
      isSafeAuthorizeUrl(`https://console.luno.rest/cli-login?session=${sessionId}`),
    ).toBe(true);
    expect(isSafeAuthorizeUrl(`https://evil.example/cli-login?session=${sessionId}`)).toBe(
      true,
    );
    expect(isSafeAuthorizeUrl("https://console.luno.rest/settings/api-keys")).toBe(false);
    expect(isSafeAuthorizeUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("runBrowserLogin", () => {
  it("opens the authorize URL, polls, and returns the key without printing it", async () => {
    const authorizeUrl = `https://console.luno.rest/cli-login?session=${sessionId}`;
    const opened: string[] = [];
    let log = "";
    let polls = 0;
    const fetchFn: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith("/v1/auth/cli-login") && !url.includes(sessionId)) {
        return new Response(
          JSON.stringify({
            id: sessionId,
            userCode: "ABCD-2345",
            pollToken: "a".repeat(64),
            expiresIn: 600,
            pollInterval: 1,
            authorizeUrl,
          }),
          { status: 201 },
        );
      }
      polls += 1;
      if (polls === 1) {
        return new Response(JSON.stringify({ status: "pending", userCode: "ABCD-2345" }));
      }
      return new Response(
        JSON.stringify({ status: "ready", key: "sk-agent-from-browser" }),
      );
    };

    const key = await runBrowserLogin({
      apiUrl: "https://api.luno.rest/admin",
      fetch: fetchFn,
      openUrl: (url) => {
        opened.push(url);
      },
      sleep: async () => {},
      output: { write: (s) => { log += s; } },
    });

    expect(key).toBe("sk-agent-from-browser");
    expect(opened).toEqual([authorizeUrl]);
    expect(log).toMatch(/ABCD-2345/);
    expect(log).toContain(authorizeUrl);
    expect(log).not.toMatch(/sk-agent-from-browser/);
    expect(log).not.toMatch(/a{64}/);
  });

  it("rejects an authorize URL that contains a key", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          id: sessionId,
          userCode: "ABCD-2345",
          pollToken: "a".repeat(64),
          expiresIn: 600,
          pollInterval: 1,
          authorizeUrl: `https://console.luno.rest/cli-login?session=${sessionId}&key=sk-agent-leak`,
        }),
        { status: 201 },
      );

    await expect(
      runBrowserLogin({
        apiUrl: "https://api.luno.rest/admin",
        fetch: fetchFn,
        openUrl: () => {},
        output: { write: () => {} },
      }),
    ).rejects.toThrow(/authorize URL|secret|invalid/i);
  });
});
