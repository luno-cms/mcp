---
name: luno
description: Interactive LUNO MCP setup and env switch (dev/stg/prod). Use when the user runs /luno or needs agent API keys / MCP for LUNO.
disable-model-invocation: true
argument-hint: "[init|init-dev|init-stg|init-prod|dev|stg|prod|status|help]"
---

# /luno — LUNO MCP インタラクティブ設定

ユーザー引数: `$ARGUMENTS`

あなたはプロジェクト（ドキュメントルート）上で LUNO 管理 API を MCP 経由で使うためのガイドです。キーや URL はローカルの gitignore 対象ファイルにだけ書き、チャットにはキー全体を復唱しないでください（末尾数文字のみ確認可）。

## 事前チェック（必ず最初に実行）

```bash
npx -y @luno-cms/mcp env bootstrap
npx -y @luno-cms/mcp env status
```

## 引数ルーティング

`$ARGUMENTS` を trim した値で分岐する。空文字は **初回セットアップ扱い（init 相当）**。

| 引数 | 動作 |
|------|------|
| （空） / `init` | フル初期化ウィザード |
| `init-dev` / `init-stg` / `init-prod` | その環境だけの初期化 |
| `dev` / `stg` / `prod` | その環境に切替（キー未設定なら入力を促す） |
| `status` | `npx -y @luno-cms/mcp env status` の結果を分かりやすく説明 |
| `help` または不明 | 使い方を短く表示 |

不明な引数のときは help を出して終了する（推測で別コマンドを実行しない）。

## 共通ルール

1. **質問は 1 つずつ**。ユーザーの回答を待ってから次へ。
2. エージェントキーは管理画面 **設定 → エージェント API キー**（`/settings/api-keys`）で発行する `sk-agent-…`。普段は **full**（記事＋フォーム定義）。記事のみに絞るなら **content**。
3. Form Set / Contact Form の **削除** や課金・メンバー管理はエージェントキーでは不可。
4. エントリ保存前に `get_form_set_schema` の `snapshotShape.example` を使い、`{ [formKey]: { [fieldKey]: value } }` で `save_revision` する。select は `masterEntityKey` / `sampleValues`（record **value**）を使う。公開確認は `get_public_api_info` の `/public/p/{projectId}/v1`（マスタは `…/master-entities/{key}/records`）。
5. キー保存は必ず CLI 経由:

```bash
npx -y @luno-cms/mcp env set-key <env> '<ユーザーが貼ったキー>'
```

6. URL を変えるときだけ:

```bash
npx -y @luno-cms/mcp env set-url <env> '<url>'
```

7. 切替:

```bash
npx -y @luno-cms/mcp env switch <env>
```

8. 以降の MCP ツールは **`luno-<env>`**（例: `luno-stg`）を優先して使う。アクティブ環境は `npx -y @luno-cms/mcp env active` で確認。
9. セットアップ完了後、必要なら「MCP を再接続してください（Claude: `/mcp`、Cursor: Reload / Tools & MCP）」と一言案内する。

デフォルト URL（ユーザーが上書きしない限り）:

- dev → `http://127.0.0.1:8787/admin`
- stg → `https://stg-api.luno.rest/admin`
- prod → `https://api.luno.rest/admin`

## フロー: init（空引数または `init`）

1. `env bootstrap` + `env status` を実行。
2. どれを設定するか聞く（複数可）。選択肢例: `stg`（推奨） / `dev` / `prod` / 全部。
3. 選ばれた各環境について:
   - キーが未設定なら「`<env>` のエージェント API キー（sk-agent-…）を貼ってください」と聞く。
   - 受け取ったら `env set-key` する。
   - URL をカスタムするか聞く（通常は No → デフォルトのまま）。
4. 最初に使う環境を聞く（未指定なら stg 優先、なければ設定済みの最初の環境）。
5. `env switch` してアクティブにする。
6. `env status` を再表示し、次の一歩を提案。強制で MCP ツールを連打しない。

## フロー: `init-dev` / `init-stg` / `init-prod`

対象環境だけを init する。

1. `env bootstrap` + `env status`
2. その環境のキーを聞く（未設定時。設定済みなら「上書きしますか？」）
3. 任意で URL 確認
4. `env set-key`（必要なら `env set-url`）→ `env switch`
5. 完了サマリ

## フロー: `dev` / `stg` / `prod`（切替）

1. `env bootstrap`
2. `npx -y @luno-cms/mcp env has-key <env>` を確認
   - 失敗（キーなし）→ その環境のキー入力を促し `env set-key`
   - 成功 → 上書きは聞かない（切替のみ）
3. `npx -y @luno-cms/mcp env switch <env>`
4. 「アクティブは `<env>`。MCP は `luno-<env>` を使います」と短く報告
5. ユーザーが作業内容を言っていれば続行。なければ次に何をしたいか聞く。

## フロー: `status` / `help`

- `status`: CLI 出力を根拠に active / 各キーの有無だけ簡潔に。
- `help`:

```text
/luno              初回セットアップ（init と同じ）
/luno init         フル初期化ウィザード
/luno init-dev     dev だけ初期化
/luno init-stg     stg だけ初期化
/luno init-prod    prod だけ初期化
/luno dev|stg|prod 環境切替（キー未設定なら入力）
/luno status       状態表示
```

## やってはいけないこと

- キーを git にコミットする
- プレースホルダ `sk-agent-xxxxxxxx` のまま `switch` や MCP 接続を成功扱いにする
- ユーザーが選んでいない環境のキーを勝手に要求し続ける
- prod を黙ってアクティブにする（明示選択時のみ）
