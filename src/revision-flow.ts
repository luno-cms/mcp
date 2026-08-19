import { lunoJson } from "./luno-api.js";

export type RevisionRow = {
  id: string;
  revision: number;
  status: string;
};

function revisionBase(formSetId: string, entryId: string, revisionRowId?: string, suffix = ""): string {
  const base = `/v1/form-sets/${formSetId}/entries/${entryId}/revisions`;
  if (!revisionRowId) return base;
  return `${base}/${revisionRowId}${suffix}`;
}

/**
 * draft → submit → approve（または pending_review → approve）。
 * サーバー側 `/publish` が中間の revision +1 を吸収するため、save 直後の番号を
 * 1 回渡すだけで完了する（クライアントが approve に古い番号を渡して 409 になる問題を避ける）。
 */
export async function publishRevisionFlow(
  formSetId: string,
  entryId: string,
  revisionRowId: string,
  revision: number,
  publishAt?: string
): Promise<{ steps: string[]; revision: RevisionRow }> {
  return (await lunoJson(`${revisionBase(formSetId, entryId, revisionRowId)}/publish`, {
    method: "POST",
    json: {
      revision,
      ...(publishAt ? { publishAt } : {}),
    },
  })) as { steps: string[]; revision: RevisionRow };
}

export async function saveRevision(
  formSetId: string,
  entryId: string,
  snapshot: unknown,
  idempotencyKey?: string
): Promise<RevisionRow> {
  return (await lunoJson(revisionBase(formSetId, entryId), {
    method: "POST",
    json: {
      snapshot,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    },
  })) as RevisionRow;
}

export async function listRevisions(
  formSetId: string,
  entryId: string
): Promise<{ items: RevisionRow[] }> {
  return (await lunoJson(revisionBase(formSetId, entryId))) as { items: RevisionRow[] };
}
