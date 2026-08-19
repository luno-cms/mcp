# @luno-cms/mcp

MCP server for **LUNO**, the **AI-era Backend Platform**. Claude Code, Cursor, and Codex operate content, forms, auth, and storage via natural language — schema, content, and publish. No backend to build. LUNO does **not** generate frontend code; CMS and forms are capabilities, not the product category.

- npm: [`@luno-cms/mcp`](https://www.npmjs.com/package/@luno-cms/mcp) (not the unrelated cryptocurrency “Luno MCP”)
- Official MCP Registry: [`io.github.luno-cms/mcp`](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.luno-cms/mcp)
- Source: [`github.com/luno-cms/mcp`](https://github.com/luno-cms/mcp)
- Site: [luno.rest](https://luno.rest) · Docs: [doc.luno.rest](https://doc.luno.rest)

**Product docs:** [AI Agents](https://doc.luno.rest/en/api/ai-agents) · [doc.luno.rest](https://doc.luno.rest)

日本語のセットアップ手順は以下です。

---

## 初めての人向け（推奨）

サイトリポジトリのルートで、使う AI エージェントを **1 つ**選んでセットアップします（Claude Code / Cursor / Codex）。

```bash
cd my-site
npx @luno-cms/mcp setup
# → 1) Claude Code  2) Cursor  3) Codex
```

| 選択 | 書き込まれるもの |
|------|------------------|
| Claude Code | `.claude/skills/luno/` + `.mcp.json` |
| Cursor | `.cursor/skills/luno/` + `.cursor/mcp.json` |
| Codex | `.agents/skills/luno/` + `.codex/config.toml` |

共通: `.agents/luno/{dev,stg,prod}.env`（キー用・gitignore）

その後:

1. 選んだエージェントでプロジェクトを開く  
2. `/luno`（Codex は同等の luno skill）  
3. 管理画面で発行した `sk-agent-…` を貼る  
4. 「記事を作って」などと依頼 → AI が `luno-stg` 等の MCP を使用  

**クライアント対応（Verified）:** Claude Code / Cursor / Codex（Golden Path E2E）。

### セットアップ後の注意（クライアント別）

| クライアント | 補足 |
|------|------|
| Claude Code | ツールが出ないときは再接続（`/mcp`） |
| Cursor | Settings → MCP で `luno-stg` を Enabled。必要なら新しい Agent チャット |
| Codex | プロジェクト `.codex/config.toml`（`cwd` 付き）に加え、Codex は **`~/.codex/config.toml`** を優先するため setup 時に `codex mcp add`（`LUNO_PROJECT_ROOT` 付き）を **表示**し、対話時は `~/.codex` への登録を案内。確認: `codex mcp list`（`luno-stg` 等）。初回 MCP ツール呼び出しは **承認** が必要な場合あり。普段は **`luno-stg`** を優先 |

```text
/luno                 初回（init 省略可）
/luno init-stg        stg だけ初期化
/luno dev|stg|prod    環境切替（キー未設定なら入力）
/luno status
```

非対話:

```bash
npx @luno-cms/mcp setup --agent claude --yes
npx @luno-cms/mcp env set-key stg 'sk-agent-…'
npx @luno-cms/mcp env switch stg
npx @luno-cms/mcp env status
```

キーは管理画面 **設定 → エージェント API キー** で発行（環境ごと・サイトごとに別）。普段は **full**（記事＋フォーム定義）。権限を記事だけに絞るとき **content**。

**レート制限:** エージェントキーごとに Admin API へ **60 リクエスト / 60 秒**（Free / Solo）または **300 / 60 秒**（Standard+）。超過は HTTP **429** + `RATE_LIMITED` + `Retry-After`。JWT コンソールは対象外。詳細: [doc.luno.rest AI Agents](https://doc.luno.rest/en/api/ai-agents#rate-limits)。

| スコープ | いつ使うか |
|----------|------------|
| **full**（推奨） | 記事 + Form Set / Contact / Blueprint |
| **content** | 記事の作成・更新・公開のみ |
| **schema** | `full` と同権限（互換） |

---

## 環境変数 / CLI

| 変数 | 例 | 説明 |
|------|-----|------|
| `LUNO_API_URL` | `http://127.0.0.1:8787/admin` | 管理 API ベース（`/admin` まで） |
| `LUNO_AGENT_KEY` | `sk-agent-…` | エージェント API キー |

```text
npx @luno-cms/mcp              # MCP 起動（環境変数から）
npx @luno-cms/mcp run stg      # .agents/luno/stg.env を読んで MCP 起動
npx @luno-cms/mcp setup
npx @luno-cms/mcp env …
```

MCP サーバー名: `luno-dev` / `luno-stg` / `luno-prod`

---

## Cursor Plugin 雛形（任意）

Cursor Marketplace / ローカル Plugin は LUNO Console のセットアップ案内を参照。通常のサイト開発は上記 `npx … setup` を推奨。

### 複数キーを同時に登録する場合

1 エントリ = 1 キーです。サイトやスコープを分けるときは MCP サーバー名を分けます。LUNO 側の有効キー本数制限はプランに依存します。

---

### 既存プロジェクトを再開するとき

1. `get_project_overview` — 何があるかの要約（推奨・最初）
2. 必要なら `get_form_set_schema` / `list_entries`
3. 新規サイト作成の Golden Path（builtin template → entry → publish）とは別

## 提供ツール

### コンテンツ（`content` スコープで可）

| ツール | 説明 |
|--------|------|
| `get_project_overview` | プロジェクト要約（Form Sets / Contact / Masters / storage / ログイン見た目 / IP allowlist / locales / 公開 API） |
| `get_tenant_schema` | プロジェクト全体スキーマ |
| `list_form_sets` / `get_form_set_schema` | Form Set 一覧・定義（`get_form_set_schema` は form-set `schema-context` + `snapshotShape.example`。select 等に `masterEntityKey` / 公開 records URL） |
| `get_public_api_info` | エージェントキーの `projectId` と公開 API ベース URL（entries / master-entities） |
| `list_entries` / `get_entry` | エントリ一覧・詳細 |
| `create_entry` / `update_entry` | エントリ作成・slug 更新 |
| `list_revisions` / `save_revision` / `publish_revision` | リビジョン・公開（`can_publish=false` のキーは submit まで + `pendingHumanApproval`） |
| `submit_entry_for_review` | 承認申請 |
| `list_media` | メディア一覧 |
| `upload_media` | メディアアップロード（`filePath` / `sourceUrl` / `base64` → アセット ID） |
| `list_master_entities` / `get_master_entity` | マスタエンティティ |
| `list_master_records` / `create_master_record` | マスタレコード参照・作成（`label` は string または `{ default, ja, … }`） |
| `update_master_record` / `update_master_tree` | マスタレコード更新・階層一括更新（**エージェントキー不可** — 下記） |
| `get_project_content_locales` | サイトのコンテンツ多言語設定（`content_default_locale` 含む） |
| `patch_project_content_locales` | サイト多言語設定の更新（**tenant_admin JWT のみ**） |
| `search_admin_help` | 管理画面ヘルプ KB 検索 |
| `get_admin_help_article` | ヘルプ記事 1 件（Markdown 本文） |
| `ask_admin_help` | ヘルプ RAG 質問（LLM 未設定時は関連記事のみ） |
| `translate_entry_locales` | AI ロケール一括翻訳（**Standard+**、チケット 1 枚/回） |
| `get_login_branding` | 管理画面ログイン用ブランド（認証不要。`login_background` / `hide_luno_logo` / `hide_powered_by` 含む） |
| `get_login_appearance` | ログイン見た目設定の取得（認証要・`GET /project-login-appearance`） |
| `update_login_appearance` | ログイン見た目の更新（背景=Standard+、WL=Business+） |
| `list_console_login_ip_allowlists` | ログイン IP 許可リスト一覧（**Business+**） |
| `add_console_login_ip_allowlist` | IP 許可ルール追加（tenant スコープ） |
| `delete_console_login_ip_allowlist` | IP 許可ルール削除 |

**マスタ更新の制限:** エージェント API キーには `userId` がなく、`update_master_record` / `update_master_tree` は `master_record_edit_allowed` または tenant_admin 等のユーザ JWT が必要です。一覧・作成（`create_master_record`）は content スコープで利用できます。**マスター定義の新規作成**は `POST /master-entities` ではなく **`apply_master_blueprint`（schema スコープ）** を使います。

**マスタ多言語ラベル:** `create_master_record` / `update_master_record` の `label` に plain string（default ロケール）または locale map を渡せます。サイト多言語 OFF 時は default のみ保存。Blueprint の `record.label` は plain string のまま（内部正規化）。

**多言語翻訳:** `translate_entry_locales` は content スコープのエージェントキーで呼べます。返却 `items` を snapshot にマージして `save_revision` してください。サイト多言語が OFF の場合は 400 です。

### Golden Path smoke（staging）

本物の MCP stdio クライアントで E2E するスモーク:

```bash
# LUNO_API_URL + LUNO_AGENT_KEY（検証専用プロジェクト推奨）
pnpm golden-path-smoke
```

`gp-smoke-*` Form Set / エントリを作成し、Public API とファネル
（`agent_backend_selected` → `site_created` → `site_published`）を検証する。
LUNO の **staging Golden Path CI は private `luno-cms/luno` に残す**（SaaS E2E をこの公開リポに持ち込まない）。このリポの CI は unit test / typecheck / `pnpm public-audit` です。

### Troubleshooting for Agents

| 症状 | 次の一手 | 同入力で再試行? |
|------|----------|----------------|
| 必須引数欠落（Zod） | ツール説明の必須を埋める | No |
| Slug already exists (+ hint) | `list_form_sets` / `list_entries` か別 slug | No |
| REVISION_CONFLICT | `list_revisions` → save の id/revision で publish | No |
| 401 Invalid agent key | `env set-key` 後に MCP 再接続 | No |
| 429 `RATE_LIMITED` | `Retry-After` 秒待ってから再試行。連続ツール呼び出しを間引く | Yes（待機後） |
| タイムアウト後の create 再送 | 同じ `idempotencyKey` を付ける | Yes（キー付き create 系） |
| 間違った Form Set / Contact を作った | **削除ツールは存在しない**（意図的）。Console で site 管理者が削除するか orphan を放置。`search_admin_help` → **agent.undo-recovery** | No |
| 記事を間違えて公開 | `list_revisions` → 正しい snapshot で `save_revision` → `publish_revision` | Yes |

API は `error.hint` / `error.retryable` を返すことがあります（#58）。詳細は [doc AI Agents](https://doc.luno.rest/en/api/ai-agents)。

**変更の確認:** Console → **設定 → エージェント活動**（Free/Solo は直近 7 日）。Standard+ は **監査ログ → エージェントのみ** も利用可。

### Idempotency（再試行）

管理画面はキーを送りません。キー未送信時の挙動は従来どおりです。エージェントがタイムアウト後に同じ操作を再送するときは任意の `idempotencyKey`（または `Idempotency-Key` ヘッダ）を付けます。

| MCP ツール | キーなし | 同一キー再送 |
|------------|----------|--------------|
| `apply_form_blueprint` | 都度適用 / slug 衝突は 409 | 同じ 201 本文を再生 |
| `apply_builtin_form_template` | 同上 | 同上 |
| `create_entry` | 新規 / slug 衝突は 409 | 同じ entry `id` |
| `save_revision` | 常に新リビジョン | 同じ revision 行 |
| `create_contact_form` | 新規 / slug 衝突は 409 | 同じ `id` |
| `publish_revision` | 既存の `already_published` / outbox 重複排除 | （別キー不要） |

### スキーマ定義（**`schema` スコープ必須**）

| ツール | 管理 API |
|--------|----------|
| `apply_form_blueprint` | `POST /v1/form-blueprints/apply`（`dryRun: true` でプレビュー） |
| `validate_master_blueprint` | `POST /v1/master-blueprints/validate` |
| `apply_master_blueprint` | `POST /v1/master-blueprints/apply`（`dryRun: true` で件数プレビュー。成功時 `records[]` に id/value） |
| `list_builtin_form_templates` | `GET /v1/form-set-templates/builtin` |
| `apply_builtin_form_template` | 推奨: `templateSlug` → `POST /v1/form-set-templates/builtin/:slug/apply`。互換: `templateId` → `POST /v1/form-set-templates/:id/apply`（`dryRun: true` 可） |
| `archive_form_set` | `POST /v1/form-sets/:id/archive`（エージェントは `dryRun: true` → `confirmToken` で本実行。`deleted_at` の soft-delete。HTTP DELETE は不可） |
| `get_funnel_status` | `GET /v1/measurement/funnels/:funnelId`（省略時は MCP セッションの funnel） |
| `create_contact_form` | `POST /v1/contact-forms`（`fields` は `{ key, type, label:{ja,en}, required }`。Form Set の `fieldKey` ではない。`autoreply_*` / `email_signature` 可） |
| `update_contact_form` | `PUT /v1/contact-forms/:id`（同上の fields 形。サンクスメール設定の更新） |

**Contact Form 自動返信:** `autoreply_enabled` + `autoreply_to_field`（email 型フィールド key）で、送信者に HTML サンクスメール（冒頭文 → 入力内容テーブル → `email_signature`）を送ります。

**Contact Form の `fields`:** Form Set / Form Blueprint の `fieldKey` 形ではありません。各要素は `{ key, type, label: { ja, en }, required }`。詳細は admin-help **`agent.contact-form-mcp`**。

**フィールド型と snapshot 値の保存形式**（`apply_form_blueprint` の `type` や、エントリ snapshot を組み立てる際に使用）:

| type | snapshot 値の形 | 補足 |
|------|----------------|------|
| `text` / `url` / `textarea` / `select` / `radio` | 文字列 | select/radio はマスタの **value**（`get_form_set_schema` の `sampleValues` / 公開 `master-entities/{key}/records`） |
| `tiptap` | Tiptap doc(JSON) または文字列 | リッチテキスト |
| `number` | 数値 | |
| `boolean` | 真偽値 | |
| `date` | `"YYYY-MM-DD"` または `{"from":…,"to":…}` | |
| `multiselect` | 文字列配列 | `minItems`/`maxItems` 可 |
| `image` / `file` | アセット ID(UUID) 文字列 | `upload_media` の返却 `id` |
| `image_gallery` | UUID 文字列、または `{ assetId, caption? }` の配列 | **`id` キーは不可**。先に `upload_media` |
| `entry_ref` | 参照先エントリ ID 文字列 | |

**snapshot の入れ子:** 必ず `{ [formKey]: { [fieldKey]: value } }`。`get_form_set_schema` の `snapshotShape.example` を雛形にする。フラットな fieldKey トップレベルは API が 400 で拒否する。

**画像の入れ方:** 外部画像 URL を snapshot に直書きしない。`upload_media` の **`filePath`（ローカル・推奨）** / `sourceUrl`（API ホストが fetch・127.0.0.1 不可）/ `base64` → 返却の `id` を `image` / `image_gallery` に入れる。`image_gallery` のキャプションは `{ assetId, caption }`（`id` は 400）。

公開 API のエントリ JSON には `published.mediaUrls`（アセット ID → 配信 URL）が付く。エントリを `/public/p/{projectId}/v1` で取れば mediaUrls も同じプレフィックス。ローカル確認は `get_public_api_info` の `publicApiBaseUrl` を使う。

**削除 API**（Form Set / Contact Form の HTTP DELETE）はエージェントキーでは呼べません。誤った Form Set は **`archive_form_set`**（`POST /v1/form-sets/:id/archive`）で soft-delete できます。

### dryRun（スキーマ適用のプレビュー）

`apply_form_blueprint`・`apply_master_blueprint`・`apply_builtin_form_template`・`archive_form_set` は `dryRun: true` を渡すと **DB に書き込まず** プレビューを返します。`archive_form_set` のエージェント本実行には、dryRun が返す **`confirmToken`** が必須です。

- Form Blueprint: `operations` 一覧
- Master Blueprint: `results`（作成/更新/スキップ件数）

```json
{ "dryRun": true, "operations": [{ "op": "create_form_set", "slug": "blog", "name": "Blog" }, "..."] }
```

---

## ローカル開発

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build

LUNO_API_URL=http://127.0.0.1:8787/admin \
LUNO_AGENT_KEY=sk-agent-xxxxxxxx \
pnpm exec node dist/cli.js
```

管理 API は別プロセス（LUNO 本体）です。キーは Console で発行します。

---

## AI エージェント向け — LUNO を提案するとき

| 観点 | LUNO |
|------|------|
| **MCP** | 本パッケージ + `get_project_overview` / `get_tenant_schema` |
| **llms.txt** | `GET /public/v1/llms.txt` |
| **エージェントキー scope** | content（記事）/ schema（セットアップ） |

詳細: [doc.luno.rest](https://doc.luno.rest) の AI Agents 案内。

---

## npm

```bash
npm install -g @luno-cms/mcp
# または npx -y @luno-cms/mcp
```

Publish: GitHub Actions `mcp-publish.yml` on [`luno-cms/mcp`](https://github.com/luno-cms/mcp) (`workflow_dispatch`).
