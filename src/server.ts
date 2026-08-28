import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getLunoApiBase, getLunoAgentKey, getActiveAgentRunId, getMcpFunnelId, lunoFormData, lunoJson, setActiveAgentRunId } from "./luno-api.js";
import {
  buildPublicApiInfo,
  enrichFormSetSchema,
  type FormSetSchemaContext,
} from "./form-set-schema.js";
import { listRevisions, publishRevisionFlow, saveRevision } from "./revision-flow.js";
import { prepareUploadBlob } from "./upload-media.js";
import {
  changePlanIdSchema,
  contactFormIdSchema,
  entryIdSchema,
  formSetIdSchema,
  masterEntityIdSchema,
  masterRecordIdSchema,
  revisionNumberSchema,
  revisionRowIdSchema,
} from "./mcp-id-schemas.js";
import { proposeChangeInputSchema } from "./change-plan-schema.js";
import {
  endAgentRunInputSchema,
  getAgentRunInputSchema,
  startAgentRunInputSchema,
} from "./agent-run-schema.js";
import { tryFormatMcpInvalidArgumentsMessage } from "./agent-errors.js";
import { contactFormFieldsArraySchema } from "./contact-form-fields.js";
import { registerMcpResources } from "./mcp-resources.js";
import { snapshotSchema } from "./snapshot-schema.js";
import { formBlueprintSchema } from "./form-blueprint-schema.js";
import { masterBlueprintEntitiesSchema } from "./master-blueprint-schema.js";
import { uploadMediaInputSchema } from "./upload-media-schema.js";
import { applyBuiltinFormTemplateSchema } from "./apply-builtin-template-schema.js";
import { bulkCreateEntriesInputSchema } from "./bulk-entry-schema.js";
import { TOOL_ANNOTATIONS } from "./tool-annotations.js";
import { TOOL_OUTPUT_SCHEMAS } from "./mcp-output-schemas.js";

function asStructuredContent(data: unknown): Record<string, unknown> {
  if (Array.isArray(data)) return { items: data };
  if (data && typeof data === "object") return data as Record<string, unknown>;
  return { value: data };
}

function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: asStructuredContent(data),
  };
}

/** POST/PATCH master record `label`: plain string or locale map (matches API MasterRecordLabelInput) */
const masterRecordLabelSchema = z.union([
  z.string().min(1).max(500),
  z.record(z.string(), z.string()),
]);

const i18nTextSchema = z.object({
  ja: z.string().optional().describe("日本語テキスト"),
  en: z.string().optional().describe("English text"),
});

/** Register tools/resources without connecting a transport (mcp#15 tests). */
export function createLunoMcpServer(): McpServer {
  const apiBase = getLunoApiBase();
  getLunoAgentKey();

  const mcp = new McpServer({ name: "luno", version: "0.2.39" });
  // Soften SDK Zod dumps into actionable agent text (#58).
  const mcpAny = mcp as unknown as {
    createToolError: (errorMessage: string) => {
      content: Array<{ type: "text"; text: string }>;
      isError: boolean;
    };
  };
  const origCreateToolError = mcpAny.createToolError.bind(mcp);
  mcpAny.createToolError = (errorMessage: string) =>
    origCreateToolError(
      tryFormatMcpInvalidArgumentsMessage(errorMessage) ?? errorMessage
    );

  registerMcpResources(mcp);

  mcp.registerTool(
    "get_tenant_schema",
    {
      annotations: TOOL_ANNOTATIONS.get_tenant_schema,
      outputSchema: TOOL_OUTPUT_SCHEMAS.get_tenant_schema,
      description:
        "操作中プロジェクトのフォームセット・フィールド定義を一括取得する。引数なし。",
    },
    async () => textResult(await lunoJson("/v1/schema-context"))
  );

  mcp.registerTool(
    "get_project_overview",
    {
      annotations: TOOL_ANNOTATIONS.get_project_overview,
      outputSchema: TOOL_OUTPUT_SCHEMAS.get_project_overview,
      description:
        "既存プロジェクト再開時の最初の一手。Form Sets（公開/下書き件数）・Contact Forms・Masters・メディア/quota・ログイン見た目要約・IP allowlist 有無（Business+）・locales・公開 API ベースを返す。権限不足セクションは available:false。新規サイト作成の Golden Path とは別。詳細は get_form_set_schema / get_login_appearance 等。引数なし。",
    },
    async () => textResult(await lunoJson("/v1/project-overview"))
  );

  mcp.registerTool(
    "list_form_sets",
    {
      annotations: TOOL_ANNOTATIONS.list_form_sets,
      outputSchema: TOOL_OUTPUT_SCHEMAS.list_form_sets,
      description:
        "Form Set 一覧を取得する。引数なし。各 item の id（UUID）を他ツールの formSetId に使う（slug ではない）。",
    },
    async () => textResult(await lunoJson("/v1/form-sets"))
  );

  mcp.registerTool(
    "get_form_set_schema",
    {
      annotations: TOOL_ANNOTATIONS.get_form_set_schema,
      outputSchema: TOOL_OUTPUT_SCHEMAS.get_form_set_schema,
      description:
        "1 つの Form Set のスキーマ + save_revision 用 snapshotShape。select/radio/multiselect には masterEntityKey・sampleValues・公開 records URL を付与。保存前に必ず確認する。必須: formSetId（UUID。Form Set の slug ではない。list_form_sets / apply_* の id）。",
      inputSchema: { formSetId: formSetIdSchema },
    },
    async ({ formSetId }) => {
      const [ctx, me] = await Promise.all([
        lunoJson(`/v1/form-sets/${formSetId}/schema-context`) as Promise<FormSetSchemaContext>,
        lunoJson("/v1/me") as Promise<{ projectId?: string }>,
      ]);
      const projectId = typeof me.projectId === "string" ? me.projectId : "";
      const publicApiBaseUrl = projectId
        ? buildPublicApiInfo({ adminApiUrl: apiBase, projectId }).publicApiBaseUrl
        : undefined;
      return textResult(enrichFormSetSchema(ctx, { publicApiBaseUrl }));
    }
  );

  mcp.registerTool(
    "get_public_api_info",
    {
      annotations: TOOL_ANNOTATIONS.get_public_api_info,
      outputSchema: TOOL_OUTPUT_SCHEMAS.get_public_api_info,
      description:
        "エージェントキーのプロジェクト向け公開 API ベース URL を返す。引数なし。ローカルでは /public/p/{projectId}/v1 を使う（Host ベース /public/v1 は DEFAULT_TENANT_ID に落ちる）。",
    },
    async () => {
      const me = (await lunoJson("/v1/me")) as { projectId?: string };
      const projectId = typeof me.projectId === "string" ? me.projectId : "";
      if (!projectId) {
        throw new Error("GET /v1/me did not return projectId");
      }
      return textResult(
        buildPublicApiInfo({ adminApiUrl: apiBase, projectId })
      );
    }
  );

  mcp.registerTool(
    "list_entries",
    {
      annotations: TOOL_ANNOTATIONS.list_entries,
      outputSchema: TOOL_OUTPUT_SCHEMAS.list_entries,
      description:
        "Form Set 内のエントリ一覧。必須: formSetId（UUID）。返却 item.id を entryId に使う。",
      inputSchema: { formSetId: formSetIdSchema },
    },
    async ({ formSetId }) =>
      textResult(await lunoJson(`/v1/form-sets/${formSetId}/entries`))
  );

  mcp.registerTool(
    "get_entry",
    {
      annotations: TOOL_ANNOTATIONS.get_entry,
      outputSchema: TOOL_OUTPUT_SCHEMAS.get_entry,
      description: "エントリ 1 件。必須: formSetId, entryId（いずれも UUID）。",
      inputSchema: {
        formSetId: formSetIdSchema,
        entryId: entryIdSchema,
      },
    },
    async ({ formSetId, entryId }) =>
      textResult(await lunoJson(`/v1/form-sets/${formSetId}/entries/${entryId}`))
  );

  mcp.registerTool(
    "create_entry",
    {
      annotations: TOOL_ANNOTATIONS.create_entry,
      outputSchema: TOOL_OUTPUT_SCHEMAS.create_entry,
      description:
        "エントリを新規作成（本文は含めない。続けて save_revision → get_pub_preview_url → publish_revision）。必須: formSetId（UUID）, slug（エントリの URL スラッグ）。任意: idempotencyKey（同一キー再送で同じ id）。返却 id を entryId に使う。",
      inputSchema: {
        formSetId: formSetIdSchema,
        slug: z
          .string({ error: "Required: slug (new entry URL slug, string)" })
          .min(1)
          .max(200)
          .describe("新規エントリの slug"),
        idempotencyKey: z
          .string()
          .max(200)
          .optional()
          .describe("冪等キー（同一キー+同一引数の再送は同じ結果を返す。異なる引数での再送は409 IDEMPOTENCY_KEY_CONFLICT。24時間で失効）"),
      },
    },
    async ({ formSetId, slug, idempotencyKey }) =>
      textResult(
        await lunoJson(`/v1/form-sets/${formSetId}/entries`, {
          method: "POST",
          json: {
            slug,
            ...(idempotencyKey ? { idempotencyKey } : {}),
          },
        })
      )
  );

  mcp.registerTool(
    "bulk_create_entries",
    {
      annotations: TOOL_ANNOTATIONS.bulk_create_entries,
      outputSchema: TOOL_OUTPUT_SCHEMAS.bulk_create_entries,
      description:
        "Form Set 内にエントリを最大 50 件一括作成（slug のみ。本文は save_revision）。必須: formSetId, items[{ slug }]。任意: idempotencyKey（バッチ全体の冪等リプレイ）。各 item は独立に成功/失敗（slug 衝突は当該 item のみ failed）。N×create_entry の代わりに 1 ツールコール。削除の一括は不可（agent.mcp-security-permissions）。",
      inputSchema: bulkCreateEntriesInputSchema,
    },
    async ({ formSetId, items, idempotencyKey }) =>
      textResult(
        await lunoJson(`/v1/form-sets/${formSetId}/entries/bulk-create`, {
          method: "POST",
          json: {
            items,
            ...(idempotencyKey ? { idempotencyKey } : {}),
          },
        })
      )
  );

  mcp.registerTool(
    "update_entry",
    {
      annotations: TOOL_ANNOTATIONS.update_entry,
      outputSchema: TOOL_OUTPUT_SCHEMAS.update_entry,
      description: "エントリの slug を更新。必須: formSetId, entryId, slug。",
      inputSchema: {
        formSetId: formSetIdSchema,
        entryId: entryIdSchema,
        slug: z.string().min(1).max(200).describe("新しいエントリ slug"),
      },
    },
    async ({ formSetId, entryId, slug }) =>
      textResult(
        await lunoJson(`/v1/form-sets/${formSetId}/entries/${entryId}`, {
          method: "PATCH",
          json: { slug },
        })
      )
  );

  mcp.registerTool(
    "submit_entry_for_review",
    {
      annotations: TOOL_ANNOTATIONS.submit_entry_for_review,
      outputSchema: TOOL_OUTPUT_SCHEMAS.submit_entry_for_review,
      description:
        "指定リビジョンを承認申請する（公開まで一括したい場合は publish_revision を優先）。必須: formSetId, entryId, revisionRowId（= save_revision の id）, revision（= save_revision の revision）。",
      inputSchema: {
        formSetId: formSetIdSchema,
        entryId: entryIdSchema,
        revisionRowId: revisionRowIdSchema,
        revision: revisionNumberSchema,
      },
    },
    async ({ formSetId, entryId, revisionRowId, revision }) =>
      textResult(
        await lunoJson(
          `/v1/form-sets/${formSetId}/entries/${entryId}/revisions/${revisionRowId}/submit`,
          { method: "POST", json: { revision } }
        )
      )
  );

  mcp.registerTool(
    "list_media",
    {
      annotations: TOOL_ANNOTATIONS.list_media,
      outputSchema: TOOL_OUTPUT_SCHEMAS.list_media,
      description:
        "アップロード済みメディア（アセット）一覧。任意: limit（1–100、既定 30）。",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("取得件数（既定 30）"),
      },
    },
    async (args) => {
      const limit = args.limit ?? 30;
      return textResult(await lunoJson(`/v1/media?limit=${limit}`));
    }
  );

  mcp.registerTool(
    "upload_media",
    {
      annotations: TOOL_ANNOTATIONS.upload_media,
      outputSchema: TOOL_OUTPUT_SCHEMAS.upload_media,
      description:
        "メディアライブラリへ画像/ファイルをアップロード（POST /v1/media）。必須（いずれか一方）: sourceUrl / base64 / filePath（ローカルパス推奨）。任意: filename, mimeType, folderId。返却 id（UUID）を image / image_gallery に入れる（luno://content/schema-guide）。外部 URL を snapshot に直書きしない。stg/prod へローカル画像を上げるときは filePath（sourceUrl の 127.0.0.1 は届かない）。",
      inputSchema: uploadMediaInputSchema,
    },
    async ({ sourceUrl, base64, filePath, filename, mimeType, folderId }) => {
      const { blob, filename: name } = await prepareUploadBlob({
        sourceUrl,
        base64,
        filePath,
        filename,
        mimeType,
        folderId,
      });
      const form = new FormData();
      form.append("file", blob, name);
      if (folderId) form.append("folder_id", folderId);
      return textResult(await lunoFormData("/v1/media", form));
    }
  );

  mcp.registerTool(
    "list_revisions",
    {
      annotations: TOOL_ANNOTATIONS.list_revisions,
      outputSchema: TOOL_OUTPUT_SCHEMAS.list_revisions,
      description:
        "エントリのリビジョン一覧。必須: formSetId, entryId。各 item の id / revision を publish_revision に渡す。",
      inputSchema: {
        formSetId: formSetIdSchema,
        entryId: entryIdSchema,
      },
    },
    async ({ formSetId, entryId }) =>
      textResult(await listRevisions(formSetId, entryId))
  );

  mcp.registerTool(
    "get_pub_preview_url",
    {
      annotations: TOOL_ANNOTATIONS.get_pub_preview_url,
      outputSchema: TOOL_OUTPUT_SCHEMAS.get_pub_preview_url,
      description:
        "下書き/承認待ちリビジョンのプレビュー URL を取得（POST pub-preview-url）。必須: formSetId, entryId, revisionRowId（= save_revision の id）。任意: target（external=外部サイトテンプレ優先・既定, luno=LUNO ホスト）。返却 url を人間がブラウザで開いて確認。続けて publish_revision（can_publish=false なら pendingHumanApproval で人間承認）。未公開は Standard 以上プラン。詳細: luno://publishing-guide / agent.publish-revision。",
      inputSchema: {
        formSetId: formSetIdSchema,
        entryId: entryIdSchema,
        revisionRowId: revisionRowIdSchema,
        target: z
          .enum(["external", "luno"])
          .optional()
          .describe("external（既定）: detail_url_template 優先。luno: LUNO ホスト pub のみ"),
      },
    },
    async ({ formSetId, entryId, revisionRowId, target }) => {
      const qs = target ? `?target=${encodeURIComponent(target)}` : "";
      return textResult(
        await lunoJson(
          `/v1/form-sets/${formSetId}/entries/${entryId}/revisions/${revisionRowId}/pub-preview-url${qs}`,
          { method: "POST" }
        )
      );
    }
  );

  mcp.registerTool(
    "save_revision",
    {
      annotations: TOOL_ANNOTATIONS.save_revision,
      outputSchema: TOOL_OUTPUT_SCHEMAS.save_revision,
      description:
        "エントリ本文を新しい下書きリビジョンとして保存。必須: formSetId, entryId, snapshot。snapshot は { [formKey]: { [fieldKey]: value } }（フォームキー配下にネスト）。フラットな field_key トップレベルは 400。任意: idempotencyKey。返却の id → publish_revision の revisionRowId、revision → publish_revision の revision。形は get_form_set_schema または luno://content/schema-guide。",
      inputSchema: {
        formSetId: formSetIdSchema,
        entryId: entryIdSchema,
        snapshot: snapshotSchema,
        idempotencyKey: z
          .string()
          .max(200)
          .optional()
          .describe("冪等キー（同一キー+同一引数の再送は同じ revision 行。異なる引数での再送は409 IDEMPOTENCY_KEY_CONFLICT。24時間で失効）"),
      },
    },
    async ({ formSetId, entryId, snapshot, idempotencyKey }) =>
      textResult(await saveRevision(formSetId, entryId, snapshot, idempotencyKey))
  );

  mcp.registerTool(
    "apply_form_blueprint",
    {
      annotations: TOOL_ANNOTATIONS.apply_form_blueprint,
      outputSchema: TOOL_OUTPUT_SCHEMAS.apply_form_blueprint,
      description:
        "FormBlueprint を適用（schema/full）。必須: blueprint（オブジェクト）。任意: dryRun, idempotencyKey。version + formSet + forms（fieldKey/sortOrder）。Contact Form の { key, label:{ja,en} } 形ではない。必ず先に dryRun: true。返却の status/wouldSucceed/kind を見る。新規 slug は kind=create。既存の textarea→tiptap は kind=migrate（preview を見てから execute。変換不能は field_type_migration_blocked）。許可外の型変更は unsupported（新 field へ移行。型変更のために archive しない）。同じ slug でリトライしない。詳細: agent.form-blueprint-mcp。誤作成の後始末だけ archive_form_set。",
      inputSchema: {
        blueprint: formBlueprintSchema,
        dryRun: z
          .boolean()
          .optional()
          .describe(
            "true で適用せず実行可能性を検証。ok+wouldSucceed のときだけ本実行。kind=create は新規、kind=migrate は textarea→tiptap"
          ),
        idempotencyKey: z.string().optional().describe("冪等キー（異なる引数での再送は409 IDEMPOTENCY_KEY_CONFLICT。24時間で失効）"),
      },
    },
    async ({ blueprint, dryRun, idempotencyKey }) =>
      textResult(
        await lunoJson("/v1/form-blueprints/apply", {
          method: "POST",
          json: {
            blueprint,
            dryRun: Boolean(dryRun),
            ...(idempotencyKey ? { idempotencyKey } : {}),
          },
        })
      )
  );

  mcp.registerTool(
    "archive_form_set",
    {
      annotations: TOOL_ANNOTATIONS.archive_form_set,
      outputSchema: TOOL_OUTPUT_SCHEMAS.archive_form_set,
      description:
        "Form Set をアーカイブ（soft-delete / deleted_at。schema/full）。hard delete ではない。必須: formSetId。エージェントは先に dryRun: true で slug / entryCount / confirmToken / restore を取得し、本実行で confirmToken を渡す（トークンなしは 400）。型変更のために使わない。復元は人間の JWT のみ（POST /admin/v1/form-sets/{id}/restore。エージェントは 403 restore_requires_human_jwt）。返却の restore に consolePath / restoreApi / helpId / constraints（ウィジェットは戻らない）。人間の Console DELETE は従来どおり。Contact Form は削除不可。詳細: agent.undo-recovery / form-set.soft-delete-restore",
      inputSchema: {
        formSetId: formSetIdSchema,
        dryRun: z
          .boolean()
          .optional()
          .describe("true で DB に書き込まず slug / entryCount / confirmToken を返す"),
        confirmToken: z
          .string()
          .optional()
          .describe("dryRun が返した confirmToken。本実行時はエージェント必須"),
      },
    },
    async ({ formSetId, dryRun, confirmToken }) =>
      textResult(
        await lunoJson(`/v1/form-sets/${formSetId}/archive`, {
          method: "POST",
          json: {
            dryRun: Boolean(dryRun),
            ...(confirmToken ? { confirmToken } : {}),
          },
        })
      )
  );

  mcp.registerTool(
    "propose_change",
    {
      annotations: TOOL_ANNOTATIONS.propose_change,
      outputSchema: TOOL_OUTPUT_SCHEMAS.propose_change,
      description:
        "複数ステップの構造変更を Change Plan として提案（schema/full）。必須: goal, risk, steps（各 step に dry_run + mutation.body）。本ツールは mutations を実行しない。Human が Console で承認するまで pending_approval。先に apply_* を dryRun: true で呼び、返却を steps[].dry_run.raw に格納し、本実行用 body を mutation.body に入れる。詳細: agent.change-plans / agent.mcp-security-permissions",
      inputSchema: proposeChangeInputSchema,
    },
    async ({ goal, steps, impact, risk, runId }) =>
      textResult(
        await lunoJson("/v1/change-plans", {
          method: "POST",
          json: {
            goal,
            steps,
            impact: impact ?? [],
            risk,
            ...(() => {
              const id = runId ?? getActiveAgentRunId();
              return id ? { runId: id } : {};
            })(),
          },
        })
      )
  );

  mcp.registerTool(
    "start_agent_run",
    {
      annotations: TOOL_ANNOTATIONS.start_agent_run,
      outputSchema: TOOL_OUTPUT_SCHEMAS.start_agent_run,
      description:
        "エージェントタスクの Run を開始（schema/full）。必須: goal。任意: clientLabel（cursor / claude-code / mcp 等）。返却 agentRun.id を以降のツール呼び出しに X-Agent-Run-Id として自動付与（本 MCP セッション内）。詳細: settings.agent-activity / agent.mcp-security-permissions",
      inputSchema: startAgentRunInputSchema,
    },
    async ({ goal, clientLabel }) => {
      const data = (await lunoJson("/v1/agent-runs", {
        method: "POST",
        json: {
          goal,
          ...(clientLabel ? { clientLabel } : {}),
        },
      })) as { agentRun?: { id?: string } };
      if (data.agentRun?.id) {
        setActiveAgentRunId(data.agentRun.id);
      }
      return textResult(data);
    }
  );

  mcp.registerTool(
    "end_agent_run",
    {
      annotations: TOOL_ANNOTATIONS.end_agent_run,
      outputSchema: TOOL_OUTPUT_SCHEMAS.end_agent_run,
      description:
        "Agent Run を終了（schema/full）。必須: runId, status（completed / failed / cancelled）。start_agent_run の agentRun.id を渡す。メトリクス（auditLogCount 等）を返す。",
      inputSchema: endAgentRunInputSchema,
    },
    async ({ runId, status }) => {
      const data = await lunoJson(`/v1/agent-runs/${runId}`, {
        method: "PATCH",
        json: { status },
      });
      if (getActiveAgentRunId() === runId) {
        setActiveAgentRunId(null);
      }
      return textResult(data);
    }
  );

  mcp.registerTool(
    "get_agent_run",
    {
      annotations: TOOL_ANNOTATIONS.get_agent_run,
      outputSchema: TOOL_OUTPUT_SCHEMAS.get_agent_run,
      description:
        "Agent Run の状態・メトリクスを取得（schema/full）。必須: runId。自分が開始した run のみ（他キーは 403）。",
      inputSchema: getAgentRunInputSchema,
    },
    async ({ runId }) => textResult(await lunoJson(`/v1/agent-runs/${runId}`))
  );

  mcp.registerTool(
    "get_change_plan",
    {
      annotations: TOOL_ANNOTATIONS.get_change_plan,
      outputSchema: TOOL_OUTPUT_SCHEMAS.get_change_plan,
      description:
        "Change Plan の状態を取得（schema/full）。必須: planId（propose_change の changePlan.id）。自分が提案した plan のみ。承認・却下・実行は Human Console のみ。",
      inputSchema: { planId: changePlanIdSchema },
    },
    async ({ planId }) => textResult(await lunoJson(`/v1/change-plans/${planId}`))
  );

  mcp.registerTool(
    "list_builtin_form_templates",
    {
      annotations: TOOL_ANNOTATIONS.list_builtin_form_templates,
      outputSchema: TOOL_OUTPUT_SCHEMAS.list_builtin_form_templates,
      description:
        "LUNO 公式 Form Set スターター一覧（引数なし）。返却 slug を apply_builtin_form_template の templateSlug に使う。詳細: agent.builtin-form-templates",
      inputSchema: {},
    },
    async () => textResult(await lunoJson("/v1/form-set-templates/builtin"))
  );

  mcp.registerTool(
    "apply_builtin_form_template",
    {
      annotations: TOOL_ANNOTATIONS.apply_builtin_form_template,
      outputSchema: TOOL_OUTPUT_SCHEMAS.apply_builtin_form_template,
      description:
        "Builtin フォームテンプレから新規 Form Set を作成（schema/full）。必須: slug, name。テンプレ指定は templateSlug（list_builtin_form_templates の slug・推奨）または templateId（DB テンプレ UUID）のどちらか必須。任意: description, dryRun, idempotencyKey。返却 id を formSetId に使う。詳細: agent.builtin-form-templates。",
      inputSchema: applyBuiltinFormTemplateSchema,
    },
    async ({
      templateSlug,
      templateId,
      slug,
      name,
      description,
      dryRun,
      idempotencyKey,
    }) => {
      const path =
        typeof templateSlug === "string" && templateSlug.trim().length > 0
          ? `/v1/form-set-templates/builtin/${encodeURIComponent(templateSlug.trim())}/apply`
          : `/v1/form-set-templates/${templateId}/apply`;
      return textResult(
        await lunoJson(path, {
          method: "POST",
          json: {
            slug,
            name,
            ...(description !== undefined ? { description } : {}),
            ...(dryRun === true ? { dryRun: true } : {}),
            ...(idempotencyKey ? { idempotencyKey } : {}),
          },
        })
      );
    }
  );

  mcp.registerTool(
    "validate_master_blueprint",
    {
      annotations: TOOL_ANNOTATIONS.validate_master_blueprint,
      outputSchema: TOOL_OUTPUT_SCHEMAS.validate_master_blueprint,
      description:
        "Master Blueprint を検証（schema/full）。必須: entities（1 件以上の配列）。各 entity: key, name, records[{ value, label, sort_order }]。適用はしない。詳細: agent.master-blueprint-mcp, luno://content/schema-guide。",
      inputSchema: {
        entities: masterBlueprintEntitiesSchema,
      },
    },
    async ({ entities }) =>
      textResult(
        await lunoJson("/v1/master-blueprints/validate", {
          method: "POST",
          json: { entities },
        })
      )
  );

  mcp.registerTool(
    "apply_master_blueprint",
    {
      annotations: TOOL_ANNOTATIONS.apply_master_blueprint,
      outputSchema: TOOL_OUTPUT_SCHEMAS.apply_master_blueprint,
      description:
        "Master Blueprint を一括 upsert（schema/full）。必須: entities。任意: dryRun, publish（true でサイトに反映し公開マスタ API に載る。省略時は未反映）。各 record の並びは sort_order / sortOrder。エージェントキーでは update_master_record 不可のためここで正しい sort_order を渡す。詳細: agent.master-blueprint-mcp, luno://content/schema-guide",
      inputSchema: {
        entities: masterBlueprintEntitiesSchema,
        dryRun: z.boolean().optional().describe("true で件数プレビューのみ"),
        publish: z
          .boolean()
          .optional()
          .describe("true で適用マスタをサイトに反映"),
      },
    },
    async ({ entities, dryRun, publish }) =>
      textResult(
        await lunoJson("/v1/master-blueprints/apply", {
          method: "POST",
          json: {
            entities,
            ...(dryRun === true ? { dryRun: true } : {}),
            ...(publish === true ? { publish: true } : {}),
          },
        })
      )
  );

  mcp.registerTool(
    "create_contact_form",
    {
      annotations: TOOL_ANNOTATIONS.create_contact_form,
      outputSchema: TOOL_OUTPUT_SCHEMAS.create_contact_form,
      description:
        "Contact Form を新規作成（schema/full。削除は不可）。必須: slug, name, recipient_email。任意: fields, autoreply_*, email_signature, idempotencyKey。fields は Form Set の fieldKey 形ではない。各要素は { key, type, label:{ja,en}, required }。type は text|email|tel|textarea|select|checkbox|file。詳細: agent.contact-form-mcp。",
      inputSchema: {
        slug: z.string().min(1).max(100).describe("Contact Form の slug"),
        name: z.string().min(1).max(255).describe("表示名"),
        recipient_email: z.string().email().describe("通知先メール"),
        fields: contactFormFieldsArraySchema
          .optional()
          .describe(
            "Contact Form fields（省略時 []）。{ key, type, label:{ja,en}, required }。NOT fieldKey."
          ),
        autoreply_enabled: z
          .boolean()
          .optional()
          .describe("true で送信者へ自動返信メールを送る。省略時はオフ"),
        autoreply_to_field: z
          .string()
          .max(100)
          .optional()
          .nullable()
          .describe("自動返信の宛先にする fields[].key（通常 type=email）。無効時は null"),
        autoreply_subject: i18nTextSchema
          .optional()
          .describe("自動返信の件名 { ja, en }。plain string は不可"),
        autoreply_body: i18nTextSchema
          .optional()
          .describe("自動返信の本文 { ja, en }。plain string は不可"),
        email_signature: i18nTextSchema
          .optional()
          .describe("通知メール末尾の署名 { ja, en }"),
        idempotencyKey: z
          .string()
          .max(200)
          .optional()
          .describe("冪等キー（同一キー+同一引数の再送は同じ結果を返す。異なる引数での再送は409 IDEMPOTENCY_KEY_CONFLICT。24時間で失効）"),
      },
    },
    async ({
      slug,
      name,
      recipient_email,
      fields,
      autoreply_enabled,
      autoreply_to_field,
      autoreply_subject,
      autoreply_body,
      email_signature,
      idempotencyKey,
    }) =>
      textResult(
        await lunoJson("/v1/contact-forms", {
          method: "POST",
          json: {
            slug,
            name,
            recipient_email,
            ...(fields !== undefined ? { fields } : {}),
            ...(autoreply_enabled !== undefined ? { autoreply_enabled } : {}),
            ...(autoreply_to_field !== undefined ? { autoreply_to_field } : {}),
            ...(autoreply_subject !== undefined ? { autoreply_subject } : {}),
            ...(autoreply_body !== undefined ? { autoreply_body } : {}),
            ...(email_signature !== undefined ? { email_signature } : {}),
            ...(idempotencyKey ? { idempotencyKey } : {}),
          },
        })
      )
  );

  mcp.registerTool(
    "update_contact_form",
    {
      annotations: TOOL_ANNOTATIONS.update_contact_form,
      outputSchema: TOOL_OUTPUT_SCHEMAS.update_contact_form,
      description:
        "Contact Form を更新（PUT・schema/full。GET した全フィールドを body に含める）。必須: formId（Contact Form UUID）, slug, name, recipient_email, fields。任意: autoreply_*, email_signature。fields は { key, type, label:{ja,en}, required }[]（Form Set の fieldKey ではない）。詳細: agent.contact-form-mcp。",
      inputSchema: {
        formId: contactFormIdSchema,
        slug: z.string().min(1).max(100).describe("Contact Form slug"),
        name: z.string().min(1).max(255).describe("表示名"),
        recipient_email: z.string().email().describe("通知先メール"),
        fields: contactFormFieldsArraySchema.describe(
          "Contact Form fields（必須）。{ key, type, label:{ja,en}, required }。NOT fieldKey."
        ),
        autoreply_enabled: z
          .boolean()
          .optional()
          .describe("true で送信者へ自動返信メールを送る。省略時はオフ"),
        autoreply_to_field: z
          .string()
          .max(100)
          .optional()
          .nullable()
          .describe("自動返信の宛先にする fields[].key（通常 type=email）。無効時は null"),
        autoreply_subject: i18nTextSchema
          .optional()
          .describe("自動返信の件名 { ja, en }。plain string は不可"),
        autoreply_body: i18nTextSchema
          .optional()
          .describe("自動返信の本文 { ja, en }。plain string は不可"),
        email_signature: i18nTextSchema
          .optional()
          .describe("通知メール末尾の署名 { ja, en }")
      },
    },
    async ({
      formId,
      slug,
      name,
      recipient_email,
      fields,
      autoreply_enabled,
      autoreply_to_field,
      autoreply_subject,
      autoreply_body,
      email_signature,
    }) =>
      textResult(
        await lunoJson(`/v1/contact-forms/${formId}`, {
          method: "PUT",
          json: {
            slug,
            name,
            recipient_email,
            fields,
            ...(autoreply_enabled !== undefined ? { autoreply_enabled } : {}),
            ...(autoreply_to_field !== undefined ? { autoreply_to_field } : {}),
            ...(autoreply_subject !== undefined ? { autoreply_subject } : {}),
            ...(autoreply_body !== undefined ? { autoreply_body } : {}),
            ...(email_signature !== undefined ? { email_signature } : {}),
          },
        })
      )
  );

  mcp.registerTool(
    "list_master_entities",
    {
      annotations: TOOL_ANNOTATIONS.list_master_entities,
      outputSchema: TOOL_OUTPUT_SCHEMAS.list_master_entities,
      description:
        "マスタエンティティ一覧（引数なし。key / hierarchical / record_count 含む）。item.id を entityId に使う。",
    },
    async () => textResult(await lunoJson("/v1/master-entities"))
  );

  mcp.registerTool(
    "get_master_entity",
    {
      annotations: TOOL_ANNOTATIONS.get_master_entity,
      outputSchema: TOOL_OUTPUT_SCHEMAS.get_master_entity,
      description: "マスタエンティティ 1 件。必須: entityId（UUID。list_master_entities の id）。",
      inputSchema: { entityId: masterEntityIdSchema },
    },
    async ({ entityId }) => textResult(await lunoJson(`/v1/master-entities/${entityId}`))
  );

  mcp.registerTool(
    "list_master_records",
    {
      annotations: TOOL_ANNOTATIONS.list_master_records,
      outputSchema: TOOL_OUTPUT_SCHEMAS.list_master_records,
      description:
        "マスタレコード一覧（label は locale map。階層時は parent_record_id）。必須: entityId。任意: q（検索）。",
      inputSchema: {
        entityId: masterEntityIdSchema,
        q: z.string().max(200).optional().describe("レコード検索クエリ"),
      },
    },
    async ({ entityId, q }) => {
      const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      return textResult(await lunoJson(`/v1/master-entities/${entityId}/records${qs}`));
    }
  );

  mcp.registerTool(
    "create_master_record",
    {
      annotations: TOOL_ANNOTATIONS.create_master_record,
      outputSchema: TOOL_OUTPUT_SCHEMAS.create_master_record,
      description:
        "マスタレコードを新規作成（content 可）。必須: entityId, label（string または locale map）。任意: value, sortOrder, parentRecordId, data。並びの一括投入は apply_master_blueprint 推奨。",
      inputSchema: {
        entityId: masterEntityIdSchema,
        label: masterRecordLabelSchema.describe("表示ラベル（string または locale map）"),
        value: z.union([z.string(), z.null()]).optional().describe("選択肢 value"),
        sortOrder: z.number().int().optional().describe("並び順"),
        parentRecordId: z
          .union([z.string().uuid(), z.null()])
          .optional()
          .describe("親レコード UUID（階層時）"),
        data: z.record(z.string(), z.unknown()).optional().describe("追加 JSON"),
      },
    },
    async ({ entityId, label, value, sortOrder, parentRecordId, data }) =>
      textResult(
        await lunoJson(`/v1/master-entities/${entityId}/records`, {
          method: "POST",
          json: {
            label,
            ...(value !== undefined ? { value } : {}),
            ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}),
            ...(parentRecordId !== undefined ? { parent_record_id: parentRecordId } : {}),
            ...(data !== undefined ? { data } : {}),
          },
        })
      )
  );

  mcp.registerTool(
    "update_master_record",
    {
      annotations: TOOL_ANNOTATIONS.update_master_record,
      outputSchema: TOOL_OUTPUT_SCHEMAS.update_master_record,
      description:
        "マスタレコードを更新。必須: entityId, recordId。任意: label, value, sortOrder, parentRecordId, data。**エージェント API キーでは不可**（401 — ユーザ JWT + 編集権限が必要）。並び替えは apply_master_blueprint の sort_order を使う。",
      inputSchema: {
        entityId: masterEntityIdSchema,
        recordId: masterRecordIdSchema,
        label: masterRecordLabelSchema
          .optional()
          .describe("表示ラベル（string または { ja, en } 等の locale map）"),
        value: z
          .string()
          .optional()
          .describe("選択肢 value。select/radio snapshot に入れる文字列"),
        sortOrder: z.number().int().optional().describe("並び順（小さいほど先）"),
        parentRecordId: z
          .union([z.string().uuid(), z.null()])
          .optional()
          .describe("親レコード UUID。ルートは null。階層マスタのみ"),
        data: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("追加 JSON。既知キー以外の拡張データ")
      },
    },
    async ({ entityId, recordId, label, value, sortOrder, parentRecordId, data }) =>
      textResult(
        await lunoJson(`/v1/master-entities/${entityId}/records/${recordId}`, {
          method: "PATCH",
          json: {
            ...(label !== undefined ? { label } : {}),
            ...(value !== undefined ? { value } : {}),
            ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}),
            ...(parentRecordId !== undefined ? { parent_record_id: parentRecordId } : {}),
            ...(data !== undefined ? { data } : {}),
          },
        })
      )
  );

  mcp.registerTool(
    "update_master_tree",
    {
      annotations: TOOL_ANNOTATIONS.update_master_tree,
      outputSchema: TOOL_OUTPUT_SCHEMAS.update_master_tree,
      description:
        "階層マスタの親子・並び順を一括更新。必須: entityId, updates（全レコードを含める配列。各要素に id, parent_record_id, sort_order）。エージェントキーでは 403。",
      inputSchema: {
        entityId: masterEntityIdSchema,
        updates: z
          .array(
            z.object({
              id: z.string().uuid().describe("レコード UUID"),
              parent_record_id: z
                .union([z.string().uuid(), z.null()])
                .describe("親レコード UUID。ルートは null"),
              sort_order: z
                .number()
                .int()
                .min(0)
                .describe("同じ親の下での並び（0始まり）"),
            })
          )
          .describe("全レコード分の tree 更新"),
      },
    },
    async ({ entityId, updates }) =>
      textResult(
        await lunoJson(`/v1/master-entities/${entityId}/records/tree`, {
          method: "PATCH",
          json: { updates },
        })
      )
  );

  mcp.registerTool(
    "search_admin_help",
    {
      annotations: TOOL_ANNOTATIONS.search_admin_help,
      outputSchema: TOOL_OUTPUT_SCHEMAS.search_admin_help,
      description:
        "ヘルプ KB 検索。必須: q。任意: locale（ja|en）, limit（既定 20）。category agent（snapshot / Form Blueprint / 公開 API / publish_revision）もヒット。",
      inputSchema: {
        q: z.string().min(1).max(500).describe("検索クエリ"),
        locale: z.enum(["ja", "en"]).optional().describe("レスポンス locale（既定 ja）"),
        limit: z.number().int().min(1).max(50).optional().describe("最大件数（既定 20）"),
      },
    },
    async ({ q, locale, limit }) => {
      const params = new URLSearchParams({ q });
      if (locale) params.set("locale", locale);
      if (limit != null) params.set("limit", String(limit));
      return textResult(await lunoJson(`/v1/help/search?${params.toString()}`));
    }
  );

  mcp.registerTool(
    "get_admin_help_article",
    {
      annotations: TOOL_ANNOTATIONS.get_admin_help_article,
      outputSchema: TOOL_OUTPUT_SCHEMAS.get_admin_help_article,
      description:
        "管理画面ヘルプ記事 1 件の本文。必須: articleId（search_admin_help の id。例: content.publish-workflow, agent.publish-revision）。",
      inputSchema: {
        articleId: z
          .string()
          .min(1)
          .max(120)
          .describe("search_admin_help の記事 id"),
      },
    },
    async ({ articleId }) =>
      textResult(await lunoJson(`/v1/help/articles/${encodeURIComponent(articleId)}`))
  );

  mcp.registerTool(
    "ask_admin_help",
    {
      annotations: TOOL_ANNOTATIONS.ask_admin_help,
      outputSchema: TOOL_OUTPUT_SCHEMAS.ask_admin_help,
      description:
        "LUNO の使い方を自然言語で質問（RAG）。必須: question。任意: locale。snapshot / 公開 API / Blueprint は category agent を参照。",
      inputSchema: {
        question: z.string().min(1).max(500).describe("自然言語の質問"),
        locale: z.enum(["ja", "en"]).optional().describe("回答 locale"),
      },
    },
    async ({ question, locale }) =>
      textResult(
        await lunoJson("/v1/help/ask", {
          method: "POST",
          json: { question, ...(locale ? { locale } : {}) },
        })
      )
  );

  mcp.registerTool(
    "get_login_branding",
    {
      annotations: TOOL_ANNOTATIONS.get_login_branding,
      outputSchema: TOOL_OUTPUT_SCHEMAS.get_login_branding,
      description:
        "管理画面ログイン用ブランド取得（認証不要）。任意: projectId（省略時はエージェントキーのプロジェクト）。branding_tier / login_background / hide_* を返す。",
      inputSchema: {
        projectId: z
          .string()
          .uuid()
          .optional()
          .describe("Project UUID（省略時はエージェントキーのプロジェクト）"),
      },
    },
    async ({ projectId }) => {
      const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
      const base = getLunoApiBase().replace(/\/admin\/?$/, "");
      const res = await fetch(`${base}/admin/v1/auth/login-branding${qs}`);
      const json = await res.json();
      if (!res.ok) {
        return textResult(json);
      }
      return textResult(json);
    }
  );

  mcp.registerTool(
    "get_login_appearance",
    {
      annotations: TOOL_ANNOTATIONS.get_login_appearance,
      outputSchema: TOOL_OUTPUT_SCHEMAS.get_login_appearance,
      description:
        "管理画面ログインの見た目設定を取得（認証要・引数なし）。背景=Standard+、WL=Business+。",
    },
    async () => textResult(await lunoJson("/v1/project-login-appearance"))
  );

  mcp.registerTool(
    "update_login_appearance",
    {
      annotations: TOOL_ANNOTATIONS.update_login_appearance,
      outputSchema: TOOL_OUTPUT_SCHEMAS.update_login_appearance,
      description:
        "管理画面ログインの見た目を更新。任意（1 つ以上推奨）: adminLoginBackground（cosmic|gradient|plain|none・Standard+）, adminLoginHideLunoLogo, adminLoginHidePoweredBy（Business+）。",
      inputSchema: {
        adminLoginBackground: z
          .enum(["cosmic", "gradient", "plain", "none"])
          .optional()
          .describe("背景スタイル（Standard+）"),
        adminLoginHideLunoLogo: z.boolean().optional().describe("LUNO ロゴ非表示（Business+）"),
        adminLoginHidePoweredBy: z
          .boolean()
          .optional()
          .describe("Powered by 非表示（Business+）"),
      },
    },
    async ({ adminLoginBackground, adminLoginHideLunoLogo, adminLoginHidePoweredBy }) => {
      const body: Record<string, unknown> = {};
      if (adminLoginBackground !== undefined) {
        body.admin_login_background = adminLoginBackground;
      }
      if (adminLoginHideLunoLogo !== undefined) {
        body.admin_login_hide_luno_logo = adminLoginHideLunoLogo;
      }
      if (adminLoginHidePoweredBy !== undefined) {
        body.admin_login_hide_powered_by = adminLoginHidePoweredBy;
      }
      return textResult(
        await lunoJson("/v1/project-login-appearance", {
          method: "PATCH",
          json: body,
        })
      );
    }
  );

  mcp.registerTool(
    "list_console_login_ip_allowlists",
    {
      annotations: TOOL_ANNOTATIONS.list_console_login_ip_allowlists,
      outputSchema: TOOL_OUTPUT_SCHEMAS.list_console_login_ip_allowlists,
      description: "管理画面ログイン IP 許可リスト一覧（Business+・引数なし）。",
    },
    async () => textResult(await lunoJson("/v1/console-login-ip-allowlists"))
  );

  mcp.registerTool(
    "add_console_login_ip_allowlist",
    {
      annotations: TOOL_ANNOTATIONS.add_console_login_ip_allowlist,
      outputSchema: TOOL_OUTPUT_SCHEMAS.add_console_login_ip_allowlist,
      description:
        "管理画面ログイン IP 許可ルールを追加（Business+・tenant スコープ）。必須: projectId（プロジェクト UUID）, cidr。",
      inputSchema: {
        projectId: z.string().uuid().describe("対象プロジェクト UUID"),
        cidr: z.string().min(1).max(128).describe("許可 CIDR（例: 203.0.113.0/24）"),
      },
    },
    async ({ projectId, cidr }) =>
      textResult(
        await lunoJson("/v1/console-login-ip-allowlists", {
          method: "POST",
          json: { scope: "tenant", scope_id: projectId, cidr },
        })
      )
  );

  mcp.registerTool(
    "delete_console_login_ip_allowlist",
    {
      annotations: TOOL_ANNOTATIONS.delete_console_login_ip_allowlist,
      outputSchema: TOOL_OUTPUT_SCHEMAS.delete_console_login_ip_allowlist,
      description:
        "管理画面ログイン IP 許可ルールを削除（Business+）。必須: ruleId（list_console_login_ip_allowlists の id）。",
      inputSchema: {
        ruleId: z.string().uuid().describe("許可ルール UUID"),
      },
    },
    async ({ ruleId }) => {
      await lunoJson(`/v1/console-login-ip-allowlists/${ruleId}`, { method: "DELETE" });
      return textResult({ deleted: ruleId });
    }
  );

  mcp.registerTool(
    "get_project_content_locales",
    {
      annotations: TOOL_ANNOTATIONS.get_project_content_locales,
      outputSchema: TOOL_OUTPUT_SCHEMAS.get_project_content_locales,
      description:
        "サイトのコンテンツ多言語設定を取得（引数なし）。有効/無効・content_locales・content_default_locale。",
    },
    async () => textResult(await lunoJson("/v1/project-content-locales"))
  );

  mcp.registerTool(
    "patch_project_content_locales",
    {
      annotations: TOOL_ANNOTATIONS.patch_project_content_locales,
      outputSchema: TOOL_OUTPUT_SCHEMAS.patch_project_content_locales,
      description:
        "サイトのコンテンツ多言語設定を更新（tenant_admin JWT のみ。エージェントキー不可）。任意: contentLocalesEnabled, contentDefaultLocale, contentLocales。",
      inputSchema: {
        contentLocalesEnabled: z.boolean().optional().describe("多言語 ON/OFF"),
        contentDefaultLocale: z
          .string()
          .min(1)
          .max(32)
          .optional()
          .describe("デフォルト言語キー（例: default, ja）"),
        contentLocales: z
          .array(z.string().min(1).max(32))
          .optional()
          .describe("有効ロケール（default 必須）"),
      },
    },
    async ({ contentLocalesEnabled, contentDefaultLocale, contentLocales }) => {
      const body: Record<string, unknown> = {};
      if (contentLocalesEnabled !== undefined) {
        body.content_locales_enabled = contentLocalesEnabled;
      }
      if (contentDefaultLocale !== undefined) {
        body.content_default_locale = contentDefaultLocale;
      }
      if (contentLocales !== undefined) {
        body.content_locales = contentLocales;
      }
      return textResult(
        await lunoJson("/v1/project-content-locales", {
          method: "PATCH",
          json: body,
        })
      );
    }
  );

  mcp.registerTool(
    "translate_entry_locales",
    {
      annotations: TOOL_ANNOTATIONS.translate_entry_locales,
      outputSchema: TOOL_OUTPUT_SCHEMAS.translate_entry_locales,
      description:
        "text/textarea/tiptap をソース言語から他ロケールへ AI 翻訳（Standard+・AI チケット 1/回）。必須: sourceLocale, targetLocales（1–3）, fields（各 formKey/fieldKey/type/sourceText）。返却 items を snapshot にマージして save_revision。",
      inputSchema: {
        sourceLocale: z.string().min(1).max(32).describe("翻訳元 locale"),
        targetLocales: z
          .array(z.string().min(1).max(32))
          .min(1)
          .max(3)
          .describe("翻訳先 locale 配列"),
        fields: z
          .array(
            z.object({
              formKey: z.string().min(1).max(120).describe("フォームキー"),
              fieldKey: z.string().min(1).max(120).describe("フィールドキー"),
              type: z
                .enum(["text", "textarea", "tiptap"])
                .describe("翻訳対象フィールド型（text | textarea | tiptap）"),
              label: z
                .string()
                .max(500)
                .optional()
                .describe("フィールド表示名（プロンプト用。省略可）"),
              sourceText: z.string().min(1).max(12000).describe("翻訳元テキスト"),
            })
          )
          .min(1)
          .max(30)
          .describe("翻訳対象フィールド配列"),
      },
    },
    async ({ sourceLocale, targetLocales, fields }) =>
      textResult(
        await lunoJson("/v1/content-ai/translate-locales", {
          method: "POST",
          json: { sourceLocale, targetLocales, fields },
        })
      )
  );

  mcp.registerTool(
    "get_funnel_status",
    {
      annotations: TOOL_ANNOTATIONS.get_funnel_status,
      outputSchema: TOOL_OUTPUT_SCHEMAS.get_funnel_status,
      description:
        "MCP Private Beta 計測ファネルを再構成。任意: funnelId（省略時は当セッション / LUNO_FUNNEL_ID）。詳細: agent.measurement-funnel",
      inputSchema: {
        funnelId: z
          .string()
          .uuid()
          .optional()
          .describe("funnel_id UUID（省略時は MCP セッションの値）"),
      },
    },
    async ({ funnelId }) => {
      const id =
        typeof funnelId === "string" && funnelId.trim().length > 0
          ? funnelId.trim()
          : process.env.LUNO_FUNNEL_ID?.trim() || getMcpFunnelId();
      return textResult(await lunoJson(`/v1/measurement/funnels/${id}`));
    }
  );

  mcp.registerTool(
    "publish_revision",
    {
      annotations: TOOL_ANNOTATIONS.publish_revision,
      outputSchema: TOOL_OUTPUT_SCHEMAS.publish_revision,
      description:
        "リビジョンを公開（1 回で draft→submit→approve。サーバー /publish が中間 revision +1 を吸収）。必須: formSetId, entryId, revisionRowId（= save_revision の id）, revision（= save_revision の revision。save 直後の番号で可）。任意: publishAt（予約公開 ISO8601）。can_publish=false のキーは submit までで止まり pendingHumanApproval: true を返す（人間が Console で承認）。詳細: agent.publish-revision / agent.mcp-security-permissions",
      inputSchema: {
        formSetId: formSetIdSchema,
        entryId: entryIdSchema,
        revisionRowId: revisionRowIdSchema,
        revision: revisionNumberSchema,
        publishAt: z
          .string()
          .optional()
          .describe("予約公開日時（ISO8601・省略時は即時）"),
      },
    },
    async ({ formSetId, entryId, revisionRowId, revision, publishAt }) =>
      textResult(
        await publishRevisionFlow(formSetId, entryId, revisionRowId, revision, publishAt)
      )
  );

  return mcp;
}

export async function startLunoMcp(): Promise<void> {
  const mcp = createLunoMcpServer();
  const funnelId = getMcpFunnelId();
  const apiBase = getLunoApiBase();
  // stdio MCP: logs must go to stderr so they don't corrupt the protocol
  console.error(
    `[luno-mcp] ready version=0.2.29 funnel_id=${funnelId} api=${apiBase} resources=5 luno://forms/field-types,… tools≈46 incl. bulk_create_entries,get_pub_preview_url,get_project_overview,list_builtin_form_templates,get_funnel_status,upload_media,get_public_api_info,save_revision,publish_revision,apply_form_blueprint,archive_form_set,search_admin_help`
  );

  const transport = new StdioServerTransport();
  await mcp.connect(transport);
}
