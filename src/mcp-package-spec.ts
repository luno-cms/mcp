/** Bare npm name (docs / one-shot CLI: setup, env, --version). */
export const LUNO_MCP_PACKAGE_NAME = "@luno-cms/mcp";

/**
 * npx argv package spec for long-lived MCP server configs.
 * `@latest` so reconnect fetches the newest publish instead of a stale
 * unpinned npx cache (mcp#47).
 */
export const LUNO_MCP_NPX_SPEC = `${LUNO_MCP_PACKAGE_NAME}@latest`;
