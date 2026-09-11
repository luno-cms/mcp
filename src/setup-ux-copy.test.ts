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
});
