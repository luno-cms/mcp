import { spawn } from "node:child_process";

export const CLI_POLL_TOKEN_HEADER = "X-Luno-Cli-Poll-Token";

export type CliLoginStart = {
  id: string;
  userCode: string;
  pollToken: string;
  expiresIn: number;
  pollInterval: number;
  authorizeUrl: string;
};

export type BrowserLoginWriter = { write: (chunk: string) => void };

export type BrowserLoginDeps = {
  apiUrl: string;
  fetch?: typeof fetch;
  openUrl?: (url: string) => void | Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  output?: BrowserLoginWriter;
};

function adminApiUrl(apiUrl: string, path: string): string {
  return `${apiUrl.replace(/\/$/, "")}${path}`;
}

export function isSafeAuthorizeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (
      parsed.protocol === "http:" &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "127.0.0.1"
    ) {
      return false;
    }
    if (parsed.pathname !== "/cli-login") return false;
    return Boolean(parsed.searchParams.get("session"));
  } catch {
    return false;
  }
}

export function openAuthorizeUrl(url: string): void {
  if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

export async function startCliLoginSession(
  apiUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<CliLoginStart> {
  const res = await fetchFn(adminApiUrl(apiUrl, "/v1/auth/cli-login"), {
    method: "POST",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`CLI login start failed (${res.status}): ${text.slice(0, 180)}`);
  }
  const body = JSON.parse(text) as CliLoginStart;
  if (
    !body.id ||
    !body.pollToken ||
    !body.authorizeUrl ||
    !isSafeAuthorizeUrl(body.authorizeUrl)
  ) {
    throw new Error("CLI login start returned an invalid authorize URL");
  }
  if (body.authorizeUrl.includes("sk-agent-") || body.authorizeUrl.includes(body.pollToken)) {
    throw new Error("CLI login start leaked a secret in the authorize URL");
  }
  return body;
}

export async function pollCliLoginSession(
  apiUrl: string,
  session: Pick<CliLoginStart, "id" | "pollToken">,
  fetchFn: typeof fetch = fetch,
): Promise<{ status: string; key?: string }> {
  const res = await fetchFn(adminApiUrl(apiUrl, `/v1/auth/cli-login/${session.id}`), {
    headers: { [CLI_POLL_TOKEN_HEADER]: session.pollToken },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`CLI login poll failed (${res.status}): ${text.slice(0, 180)}`);
  }
  return JSON.parse(text) as { status: string; key?: string };
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runBrowserLogin(deps: BrowserLoginDeps): Promise<string> {
  const fetchFn = deps.fetch ?? fetch;
  const output = deps.output ?? process.stdout;
  const session = await startCliLoginSession(deps.apiUrl, fetchFn);
  output.write("\nConfirm in the browser.\n");
  output.write(`If it did not open: ${session.authorizeUrl}\n`);
  output.write(`Confirmation code: ${session.userCode}\n`);
  const openUrl = deps.openUrl ?? openAuthorizeUrl;
  await openUrl(session.authorizeUrl);

  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? defaultSleep;
  const deadline = now() + Math.max(session.expiresIn, 30) * 1000;
  const intervalMs = Math.max(session.pollInterval, 1) * 1000;

  while (now() < deadline) {
    const poll = await pollCliLoginSession(deps.apiUrl, session, fetchFn);
    if (poll.status === "ready" && typeof poll.key === "string" && poll.key.startsWith("sk-agent-")) {
      return poll.key;
    }
    if (poll.status === "expired" || poll.status === "consumed") {
      throw new Error("CLI login expired. Run the command again.");
    }
    await sleep(intervalMs);
  }
  throw new Error("CLI login timed out. Run the command again.");
}
