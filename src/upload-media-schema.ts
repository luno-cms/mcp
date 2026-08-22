import { z } from "zod";

function countSources(args: {
  sourceUrl?: string;
  base64?: string;
  filePath?: string;
}): number {
  return [args.sourceUrl, args.base64, args.filePath].filter(
    (v) => typeof v === "string" && v.trim().length > 0
  ).length;
}

export const uploadMediaInputSchema = z
  .object({
    sourceUrl: z
      .string()
      .url()
      .optional()
      .describe("http(s) URL the LUNO server fetches (not for localhost from remote MCP)"),
    base64: z.string().min(1).optional().describe("File content as base64"),
    filePath: z
      .string()
      .min(1)
      .optional()
      .describe("Local path on MCP host (recommended for stg/prod uploads)"),
    filename: z.string().min(1).max(200).optional().describe("Upload filename"),
    mimeType: z.string().min(1).max(200).optional().describe("MIME type"),
    folderId: z.string().uuid().optional().describe("Media folder UUID"),
  })
  .superRefine((args, ctx) => {
    const n = countSources(args);
    if (n === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Required: exactly one of sourceUrl, base64, or filePath",
        path: ["sourceUrl"],
      });
    } else if (n > 1) {
      ctx.addIssue({
        code: "custom",
        message: "Provide only one of sourceUrl, base64, or filePath (not multiple)",
        path: ["sourceUrl"],
      });
    }
  })
  .describe(
    "Upload source — pick ONE of sourceUrl / base64 / filePath. Returned id (UUID) goes in image / image_gallery snapshot fields."
  );
