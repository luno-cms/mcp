import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Resolve package root (directory containing package.json / templates). */
export function getPackageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, ".."), join(here, "../..")];
  for (const c of candidates) {
    if (existsSync(join(c, "package.json")) && existsSync(join(c, "templates"))) {
      return c;
    }
  }
  // Built layout: dist/ next to templates/
  if (existsSync(join(here, "..", "templates"))) {
    return join(here, "..");
  }
  return join(here, "..");
}

export function skillTemplatePath(): string {
  return join(getPackageRoot(), "templates", "skill", "SKILL.md");
}
