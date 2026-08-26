import { z } from "zod";

/**
 * Contact Form field item — matches admin API `contactFormFieldSchema`.
 * This is NOT the Form Set / Form Blueprint field shape (`fieldKey` / `sortOrder` / `constraints`).
 */
export const contactFormI18nTextSchema = z
  .object({
    ja: z.string().optional().describe("日本語ラベル"),
    en: z.string().optional().describe("English label"),
  })
  .describe("Locale map { ja, en }. A plain string is invalid.");

export const contactFormFieldTypeSchema = z.enum([
  "text",
  "email",
  "tel",
  "textarea",
  "select",
  "checkbox",
  "file",
]);

export const contactFormFieldSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .max(100)
      .describe("Field key (NOT fieldKey / field_key / id)"),
    type: contactFormFieldTypeSchema.describe(
      "text | email | tel | textarea | select | checkbox | file"
    ),
    label: contactFormI18nTextSchema.describe("Required locale object { ja, en }"),
    required: z.boolean().optional().describe("Default false"),
    placeholder: contactFormI18nTextSchema
      .optional()
      .describe("入力欄プレースホルダ { ja, en }"),
    options: z
      .array(
        z.object({
          value: z.string().describe("選択肢 value（送信値）"),
          label: contactFormI18nTextSchema.describe("選択肢ラベル { ja, en }"),
        })
      )
      .optional()
      .describe("Required for type=select"),
    maxFileSizeMb: z
      .number()
      .positive()
      .max(50)
      .optional()
      .describe("type=file の最大サイズ（MB）"),
    acceptedTypes: z
      .string()
      .max(255)
      .optional()
      .describe("type=file の accept 属性（例: image/*）"),
  })
  .describe(
    "Contact Form field. Use key + label:{ja,en}. Do not use Form Set fieldKey/sortOrder/constraints."
  );

export const contactFormFieldsArraySchema = z
  .array(contactFormFieldSchema)
  .describe(
    "Contact Form fields array. Each item: { key, type, label:{ja,en}, required }. Not Form Blueprint fields."
  );
