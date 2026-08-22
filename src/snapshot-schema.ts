import { z } from "zod";

const snapshotFieldValueSchema = z
  .unknown()
  .describe(
    "Field value (string, number, boolean, array, Tiptap doc JSON, asset UUID, etc.). Shapes: luno://content/schema-guide or get_form_set_schema.snapshotShape.example"
  );

const snapshotFormBlockSchema = z
  .record(z.string().describe("fieldKey from get_form_set_schema (NOT form key)"), snapshotFieldValueSchema)
  .describe(
    "Per-form field map { [fieldKey]: value }. Do NOT put fieldKey at the snapshot top level."
  );

/**
 * save_revision / publish_revision snapshot — nested by form key.
 * Aligns with GET form-set schema-context and agent.snapshot-field-values.
 */
export const snapshotSchema = z
  .record(z.string().describe("form key from get_form_set_schema.forms[].key"), snapshotFormBlockSchema)
  .describe(
    "Nested snapshot: { [formKey]: { [fieldKey]: value } }. NOT flat { fieldKey: value }. NOT Contact Form fields[]. See luno://content/schema-guide."
  );
