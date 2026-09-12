import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("public setup copy (mcp#55 P0)", () => {
  it("README quick start does not send keys into the agent chat", () => {
    const readme = read("README.md");
    expect(readme).toMatch(/npx @luno-cms\/mcp setup/);
    expect(readme).toMatch(/--key/);
    expect(readme).not.toMatch(/Paste an `sk-agent/);
    expect(readme).not.toMatch(/Run `\/luno`/);
    expect(readme).not.toMatch(/Prefer \*\*`luno-stg`\*\*/);
  });

  it("skill does not require /luno or a pasted key", () => {
    const skill = read("templates/skill/SKILL.md");
    expect(skill).toMatch(/npx -y @luno-cms\/mcp setup/);
    expect(skill).not.toMatch(/貼ってください/);
    expect(skill).not.toMatch(/stg`（推奨）/);
    expect(skill).not.toMatch(/まず `\/luno`/);
    expect(skill).toMatch(/luno-prod/);
  });

  it("skill and README send expired / teammate auth to login, not chat", () => {
    const skill = read("templates/skill/SKILL.md");
    const readme = read("README.md");
    const help = read("src/cli.ts");
    expect(skill).toMatch(/npx -y @luno-cms\/mcp login/);
    expect(skill).toMatch(/401|期限切れ|プレースホルダ/);
    expect(readme).toMatch(/npx @luno-cms\/mcp login/);
    expect(help).toMatch(/login \[--key KEY\]/);
  });

  it("README first ask is a read or draft, not publish (luno#214)", () => {
    const readme = read("README.md");
    expect(readme).toMatch(/List the form sets on this LUNO, or draft one entry/i);
    expect(readme).toMatch(/Don't publish/i);
    expect(readme).not.toMatch(/Ask: `What's connected on this LUNO\?`/);
    expect(readme).toMatch(/npx @luno-cms\/mcp login/);
    expect(readme).toMatch(/--env stg/);
  });
});
