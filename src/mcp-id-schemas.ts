import { z } from "zod";

/** Shared UUID/id schemas with agent-facing .describe() (Issue #55) + plain errors (#58). */

function uuidField(label: string, describe: string) {
  return z
    .string({ error: `Required: ${label} (UUID string)` })
    .uuid({ error: `Invalid ${label}: must be a UUID (not a slug)` })
    .describe(describe);
}

export const formSetIdSchema = uuidField(
  "formSetId",
  "Form Set の UUID（list_form_sets / apply_builtin_form_template / apply_form_blueprint / archive_form_set のレスポンス id。Form Set の slug 文字列ではない）"
);

export const entryIdSchema = uuidField(
  "entryId",
  "エントリの UUID（list_entries / create_entry / get_entry の id）"
);

export const revisionRowIdSchema = uuidField(
  "revisionRowId",
  "リビジョン行の UUID（save_revision / list_revisions のレスポンス id。revision 番号ではない）"
);

export const revisionNumberSchema = z
  .number({ error: "Required: revision (integer from save_revision)" })
  .int()
  .describe(
    "リビジョン番号（save_revision / list_revisions の revision。publish_revision は save 直後の値で可）"
  );

export const masterEntityIdSchema = uuidField(
  "entityId",
  "マスタエンティティ UUID（list_master_entities の id）"
);

export const masterRecordIdSchema = uuidField(
  "recordId",
  "マスタレコード UUID（list_master_records / create_master_record の id）"
);

export const contactFormIdSchema = uuidField(
  "contactFormId",
  "Contact Form の UUID（作成・一覧レスポンスの id）"
);

export const changePlanIdSchema = uuidField(
  "planId",
  "Change Plan の UUID（propose_change レスポンス changePlan.id）"
);

export const agentRunIdSchema = uuidField(
  "runId",
  "Agent Run の UUID（start_agent_run レスポンス agentRun.id）"
);
