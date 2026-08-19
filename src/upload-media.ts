/** MCP → `POST /v1/media`（multipart）用ヘルパ */

import { readFileSync, statSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type UploadMediaInput = {
  /** 公開 http(s) URL から取得してアップロード（LUNO API ホストが fetch する） */
  sourceUrl?: string;
  /** 生バイナリの base64（data: URL プレフィックスなし） */
  base64?: string;
  /**
   * MCP サーバー（エージェント）ホスト上のローカルファイルパス。
   * stg/prod 向けにローカル画像を上げるときはこちら（sourceUrl の 127.0.0.1 は届かない）。
   */
  filePath?: string;
  /** 保存時ファイル名（省略時は URL / パス末尾 or upload.bin） */
  filename?: string;
  /** MIME（省略時はレスポンス / 拡張子から推定） */
  mimeType?: string;
  /** メディアフォルダ UUID */
  folderId?: string;
};

export function resolveUploadFilename(
  explicit: string | undefined,
  sourceUrl: string | undefined,
  filePath?: string
): string {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed.slice(0, 200);
  if (filePath?.trim()) {
    const base = basename(filePath.trim());
    if (base && base !== "." && base !== "..") return base.slice(0, 200);
  }
  if (sourceUrl) {
    try {
      const u = new URL(sourceUrl);
      const last = u.pathname.split("/").filter(Boolean).pop();
      if (last) {
        const decoded = decodeURIComponent(last).split("?")[0] ?? last;
        if (decoded && decoded !== "/" && !decoded.includes("\0")) {
          return decoded.slice(0, 200);
        }
      }
    } catch {
      /* fall through */
    }
  }
  return "upload.bin";
}

function guessMimeFromFilename(filename: string): string | undefined {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return undefined;
}

function maxBytesForMime(mime: string): number {
  return mime.toLowerCase().startsWith("image/") ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
}

function assertHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("sourceUrl must be a valid http(s) URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("sourceUrl must use http or https");
  }
  return u;
}

function countSources(input: UploadMediaInput): number {
  return [input.sourceUrl, input.base64, input.filePath].filter((v) =>
    Boolean(typeof v === "string" ? v.trim() : v)
  ).length;
}

export async function prepareUploadBlob(
  input: UploadMediaInput
): Promise<{ blob: Blob; filename: string }> {
  if (countSources(input) !== 1) {
    throw new Error("Provide exactly one of sourceUrl, base64, or filePath");
  }

  const filename = resolveUploadFilename(
    input.filename,
    input.sourceUrl,
    input.filePath
  );

  if (input.filePath?.trim()) {
    const resolved = isAbsolute(input.filePath.trim())
      ? input.filePath.trim()
      : resolve(process.cwd(), input.filePath.trim());
    let st;
    try {
      st = statSync(resolved);
    } catch {
      throw new Error(`filePath not found: ${resolved}`);
    }
    if (!st.isFile()) {
      throw new Error(`filePath is not a file: ${resolved}`);
    }
    const buf = readFileSync(resolved);
    const mime =
      input.mimeType?.trim() ||
      guessMimeFromFilename(filename) ||
      "application/octet-stream";
    if (buf.byteLength > maxBytesForMime(mime)) {
      throw new Error(
        `File too large (${buf.byteLength} bytes; max ${maxBytesForMime(mime)})`
      );
    }
    return {
      blob: new Blob([new Uint8Array(buf)], { type: mime }),
      filename,
    };
  }

  if (input.sourceUrl?.trim()) {
    const url = assertHttpUrl(input.sourceUrl.trim());
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch sourceUrl (${res.status}): ${url.href.slice(0, 200)}`
      );
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    const mime =
      (input.mimeType?.trim() ||
        res.headers.get("content-type")?.split(";")[0]?.trim() ||
        guessMimeFromFilename(filename) ||
        "application/octet-stream") as string;
    if (buf.byteLength > maxBytesForMime(mime)) {
      throw new Error(
        `File too large (${buf.byteLength} bytes; max ${maxBytesForMime(mime)})`
      );
    }
    return { blob: new Blob([buf], { type: mime }), filename };
  }

  const raw = input.base64!.trim().replace(/^data:[^;]+;base64,/, "");
  let buf: Buffer;
  try {
    buf = Buffer.from(raw, "base64");
  } catch {
    throw new Error("base64 is not valid");
  }
  if (buf.byteLength === 0) {
    throw new Error("base64 decoded to empty content");
  }
  const mime =
    input.mimeType?.trim() ||
    guessMimeFromFilename(filename) ||
    "application/octet-stream";
  if (buf.byteLength > maxBytesForMime(mime)) {
    throw new Error(
      `File too large (${buf.byteLength} bytes; max ${maxBytesForMime(mime)})`
    );
  }
  return {
    blob: new Blob([buf], { type: mime }),
    filename,
  };
}
