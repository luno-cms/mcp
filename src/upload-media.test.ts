import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prepareUploadBlob, resolveUploadFilename } from "./upload-media.js";

describe("resolveUploadFilename", () => {
  it("prefers explicit filename", () => {
    expect(resolveUploadFilename("hero.png", "https://ex.com/a.jpg")).toBe("hero.png");
  });

  it("derives from URL path", () => {
    expect(resolveUploadFilename(undefined, "https://cdn.ex.com/img/works%2F01.jpg")).toBe(
      "works/01.jpg"
    );
  });

  it("derives from filePath", () => {
    expect(resolveUploadFilename(undefined, undefined, "/tmp/photos/out.jpg")).toBe("out.jpg");
  });

  it("falls back when URL has no path segment", () => {
    expect(resolveUploadFilename(undefined, "https://cdn.ex.com/")).toBe("upload.bin");
  });
});

describe("prepareUploadBlob", () => {
  it("rejects when not exactly one source", async () => {
    await expect(prepareUploadBlob({})).rejects.toThrow(/exactly one/);
    await expect(
      prepareUploadBlob({ sourceUrl: "https://a.com/x.png", base64: "YQ==" })
    ).rejects.toThrow(/exactly one/);
  });

  it("decodes base64 into a Blob", async () => {
    const { blob, filename } = await prepareUploadBlob({
      base64: Buffer.from("hello").toString("base64"),
      filename: "note.txt",
      mimeType: "text/plain",
    });
    expect(filename).toBe("note.txt");
    expect(blob.type).toBe("text/plain");
    expect(await blob.text()).toBe("hello");
  });

  it("strips data-URL prefix from base64", async () => {
    const { blob } = await prepareUploadBlob({
      base64: `data:image/png;base64,${Buffer.from("x").toString("base64")}`,
      filename: "x.png",
    });
    expect(blob.type).toBe("image/png");
    expect(await blob.text()).toBe("x");
  });

  it("rejects non-http sourceUrl", async () => {
    await expect(
      prepareUploadBlob({ sourceUrl: "file:///tmp/a.png" })
    ).rejects.toThrow(/http/);
  });

  it("reads local filePath", async () => {
    const dir = join(tmpdir(), `luno-mcp-upload-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "shot.png");
    writeFileSync(path, "png-bytes");
    const { blob, filename } = await prepareUploadBlob({
      filePath: path,
      mimeType: "image/png",
    });
    expect(filename).toBe("shot.png");
    expect(blob.type).toBe("image/png");
    expect(await blob.text()).toBe("png-bytes");
  });
});
