/** Form Set schema-context from GET /v1/form-sets/:id/schema-context */

export type SchemaMasterRecord = {
  id: string;
  value: string;
  label?: unknown;
  sort_order?: number;
  parent_record_id?: string | null;
};

export type SchemaMasterEntity = {
  id: string;
  key: string;
  name: string;
  hierarchical?: boolean;
  records?: SchemaMasterRecord[];
};

export type SchemaField = {
  id?: string;
  /** Admin schema-context uses snake_case */
  field_key: string;
  type: string;
  label?: string | null;
  constraints?: unknown;
  master_entity_id?: string | null;
  localizable?: boolean | null;
  locale_shared?: boolean | null;
  sort_order?: number;
};

export type SchemaForm = {
  id?: string;
  key: string;
  label?: string | null;
  sort_order?: number;
  fields?: SchemaField[];
};

export type FormSetSchemaContext = {
  formSet: {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    content_list_columns?: unknown;
    content_search_columns?: unknown;
  };
  forms: SchemaForm[];
  masters?: SchemaMasterEntity[];
};

/** @deprecated Prefer FormSetSchemaContext — kept for older call sites */
export type SchemaFormSet = {
  id: string;
  slug: string;
  name: string;
  forms?: Array<{
    key: string;
    label?: string | null;
    fields?: Array<{ fieldKey: string; type: string; label?: string | null }>;
  }>;
};

const CHOICE_TYPES = new Set(["select", "radio", "multiselect"]);
const SAMPLE_VALUE_LIMIT = 8;

function sampleValueForFieldType(type: string): unknown {
  switch (type) {
    case "number":
      return 0;
    case "boolean":
      return false;
    case "date":
      return "2025-01-01";
    case "multiselect":
    case "image_gallery":
      return [];
    case "tiptap":
      return {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "サンプル本文" }],
          },
        ],
      };
    case "image":
    case "file":
    case "entry_ref":
      return "00000000-0000-0000-0000-000000000000";
    default:
      return "サンプル";
  }
}

function sampleChoiceValue(
  type: string,
  master: SchemaMasterEntity | undefined
): unknown {
  const first = master?.records?.find((r) => r.value.trim() !== "");
  if (!first) {
    return type === "multiselect" ? [] : "sample_value";
  }
  return type === "multiselect" ? [first.value] : first.value;
}

/**
 * save_revision 用の見本 snapshot。
 * 必ず { [form.key]: { [field.field_key]: value } }。
 * マスタ参照の select/radio/multiselect は record **value** を使う（UUID ではない）。
 */
export function buildSnapshotExample(
  forms: SchemaForm[],
  mastersById: Map<string, SchemaMasterEntity>
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const form of forms) {
    const block: Record<string, unknown> = {};
    for (const field of form.fields ?? []) {
      const mid = field.master_entity_id ?? null;
      if (CHOICE_TYPES.has(field.type) && mid) {
        block[field.field_key] = sampleChoiceValue(
          field.type,
          mastersById.get(mid)
        );
      } else {
        block[field.field_key] = sampleValueForFieldType(field.type);
      }
    }
    out[form.key] = block;
  }
  return out;
}

export type EnrichFormSetSchemaOptions = {
  /** e.g. http://127.0.0.1:8787/public/p/{projectId}/v1 */
  publicApiBaseUrl?: string;
};

export function enrichFormSetSchema(
  ctx: FormSetSchemaContext,
  opts?: EnrichFormSetSchemaOptions
) {
  const masters = ctx.masters ?? [];
  const mastersById = new Map(masters.map((m) => [m.id, m]));
  const publicBase = (opts?.publicApiBaseUrl ?? "").replace(/\/$/, "");

  const forms = (ctx.forms ?? []).map((form) => ({
    ...form,
    fields: (form.fields ?? []).map((field) => {
      const mid = field.master_entity_id ?? null;
      if (!mid || !CHOICE_TYPES.has(field.type)) {
        return {
          fieldKey: field.field_key,
          ...field,
        };
      }
      const master = mastersById.get(mid);
      const sampleValues = (master?.records ?? [])
        .map((r) => r.value)
        .filter((v) => v.trim() !== "")
        .slice(0, SAMPLE_VALUE_LIMIT);
      const publicRecordsUrl = master
        ? publicBase
          ? `${publicBase}/master-entities/${master.key}/records`
          : `/public/p/{projectId}/v1/master-entities/${master.key}/records`
        : null;
      return {
        fieldKey: field.field_key,
        ...field,
        masterEntityId: mid,
        masterEntityKey: master?.key ?? null,
        masterEntityName: master?.name ?? null,
        sampleValues,
        publicRecordsUrl,
        choiceValueNote:
          "snapshot / columnFilters には master record の value 文字列を使う（record UUID は互換のみ）。ラベル解決は公開マスタ API。",
      };
    }),
  }));

  const formKeys = forms.map((f) => f.key);
  const firstField = forms[0]?.fields?.[0];
  const firstFieldKey =
    firstField && "field_key" in firstField
      ? String((firstField as SchemaField).field_key)
      : firstField && "fieldKey" in firstField
        ? String((firstField as { fieldKey: string }).fieldKey)
        : null;

  const mastersSummary = masters.map((m) => ({
    id: m.id,
    key: m.key,
    name: m.name,
    hierarchical: Boolean(m.hierarchical),
    recordCount: m.records?.length ?? 0,
    publicRecordsUrl: publicBase
      ? `${publicBase}/master-entities/${m.key}/records`
      : `/public/p/{projectId}/v1/master-entities/${m.key}/records`,
    note: "サイトに反映済みマスタのみ公開 API で取得可。未反映は 404。エントリのリビジョン公開とは別操作。",
  }));

  return {
    formSet: ctx.formSet,
    forms,
    mastersSummary,
    snapshotShape: {
      description:
        "save_revision の snapshot は { [formKey]: { [fieldKey]: value } } 必須。トップレベルに fieldKey を置かない。select/radio/multiselect（マスタ参照）は record value 文字列。",
      formKeys,
      example: buildSnapshotExample(ctx.forms ?? [], mastersById),
      wrongExample:
        formKeys[0] && firstFieldKey
          ? {
              [firstFieldKey]: "…",
              _note: "← これは誤り（fieldKey がトップレベル）",
            }
          : { title: "…", _note: "← これは誤り" },
    },
  };
}

/** LUNO_API_URL (…/admin) → origin for public API */
export function adminUrlToOrigin(adminUrl: string): string {
  const u = adminUrl.trim().replace(/\/$/, "");
  if (u.endsWith("/admin")) return u.slice(0, -"/admin".length);
  return u;
}

export function buildPublicApiInfo(opts: {
  adminApiUrl: string;
  projectId: string;
}): {
  projectId: string;
  adminApiUrl: string;
  publicApiBaseUrl: string;
  hostBasedPublicApiBaseUrl: string;
  exampleEntryUrl: string;
  exampleMasterEntitiesUrl: string;
  exampleMasterRecordsUrl: string;
  notes: string[];
} {
  const origin = adminUrlToOrigin(opts.adminApiUrl);
  const publicApiBaseUrl = `${origin}/public/p/${opts.projectId}/v1`;
  const hostBasedPublicApiBaseUrl = `${origin}/public/v1`;
  return {
    projectId: opts.projectId,
    adminApiUrl: opts.adminApiUrl.replace(/\/$/, ""),
    publicApiBaseUrl,
    hostBasedPublicApiBaseUrl,
    exampleEntryUrl: `${publicApiBaseUrl}/form-sets/{formSetSlug}/entries/{entrySlug}`,
    exampleMasterEntitiesUrl: `${publicApiBaseUrl}/master-entities`,
    exampleMasterRecordsUrl: `${publicApiBaseUrl}/master-entities/{entityKey}/records?locale=ja`,
    notes: [
      "Prefer /public/p/{projectId}/v1 — resolves the agent key's project explicitly.",
      "Host-based /public/v1 on localhost falls back to DEFAULT_TENANT_ID (not your project). Use /public/p/… locally.",
      "Public reads do not use the agent key. Optional X-Luno-Public-Api-Key if the site requires it.",
      "Masters: GET …/master-entities and …/master-entities/{entityKey}/records (site-published only). Use record value in select snapshots / columnFilters — see agent.public-masters.",
      "get_form_set_schema attaches masterEntityKey + publicRecordsUrl on choice fields (from form-set schema-context).",
    ],
  };
}
