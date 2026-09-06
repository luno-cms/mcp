import { LUNO_MCP_PACKAGE_NAME } from "./mcp-package-spec.js";
import { readPackageVersion } from "./package-version.js";
import { TOOL_REGISTRY } from "./tool-registry.js";

/** Newer Admin routes that 404 when the hosted API is older than this MCP. */
export const CAPABILITY_SENSITIVE_API_PATHS = [
  "/v1/schema-migrations/to-master-reference",
  "/v1/master-records/rename-slug",
] as const;

export type McpApiContractRow = {
  tool: string;
  api: string;
  sinceMcp?: string;
};

/**
 * Capability-sensitive tools. Listing a tool here does not mean the
 * connected Admin API has deployed that route (mcp#48).
 */
export const MCP_API_CONTRACT: readonly McpApiContractRow[] = [
  {
    tool: "migrate_field_to_master_reference",
    api: "POST /v1/schema-migrations/to-master-reference",
    sinceMcp: "0.2.43",
  },
  {
    tool: "rename_master_record_slug",
    api: "POST /v1/master-records/rename-slug",
    sinceMcp: "0.2.45",
  },
  {
    tool: "apply_form_blueprint",
    api: "POST /v1/form-blueprints/apply",
  },
  {
    tool: "propose_change",
    api: "POST /v1/change-plans",
  },
  {
    tool: "get_change_plan",
    api: "GET /v1/change-plans/:id",
  },
  {
    tool: "apply_master_blueprint",
    api: "POST /v1/master-blueprints/apply",
  },
  {
    tool: "create_contact_form",
    api: "POST /v1/contact-forms",
  },
];

export const MCP_RUNTIME_NOTE =
  "A tool listed here does not mean the hosted Admin API has deployed that route. 404 on a contract path usually means the API is older than this MCP. Call get_mcp_runtime; do not invent a substitute mutation.";

export type McpRuntimeSnapshot = {
  package: typeof LUNO_MCP_PACKAGE_NAME;
  mcpVersion: string;
  toolCount: number;
  apiBase: string;
  contract: McpApiContractRow[];
  note: string;
};

/** Local snapshot — does not call LUNO. */
export function buildMcpRuntimeSnapshot(apiBase: string): McpRuntimeSnapshot {
  return {
    package: LUNO_MCP_PACKAGE_NAME,
    mcpVersion: readPackageVersion(),
    toolCount: TOOL_REGISTRY.length,
    apiBase,
    contract: MCP_API_CONTRACT.map((row) => ({ ...row })),
    note: MCP_RUNTIME_NOTE,
  };
}

export function formatMcpReadyLog(opts: {
  version: string;
  funnelId: string;
  apiBase: string;
  resourceCount: number;
  toolCount: number;
}): string {
  return `[luno-mcp] ready version=${opts.version} funnel_id=${opts.funnelId} api=${opts.apiBase} resources=${opts.resourceCount} luno://forms/field-types,… tools=${opts.toolCount} incl. get_mcp_runtime,get_project_overview,apply_form_blueprint,migrate_field_to_master_reference`;
}

export function isCapabilitySensitiveApiUrl(url: string): boolean {
  return CAPABILITY_SENSITIVE_API_PATHS.some((path) => url.includes(path));
}
