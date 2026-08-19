import { describe, expect, it } from "vitest";
import {
  adminUrlToOrigin,
  buildPublicApiInfo,
  buildSnapshotExample,
  enrichFormSetSchema,
  type FormSetSchemaContext,
} from "./form-set-schema.js";

const sampleCtx: FormSetSchemaContext = {
  formSet: {
    id: "fs",
    slug: "works",
    name: "事例",
    description: null,
  },
  forms: [
    {
      key: "main",
      fields: [
        { field_key: "title", type: "text" },
        {
          field_key: "category",
          type: "select",
          master_entity_id: "entity-1",
        },
        {
          field_key: "tags",
          type: "multiselect",
          master_entity_id: "entity-1",
        },
      ],
    },
  ],
  masters: [
    {
      id: "entity-1",
      key: "work-category",
      name: "カテゴリ",
      hierarchical: false,
      records: [
        { id: "r1", value: "education", label: "教育" },
        { id: "r2", value: "art", label: "芸術" },
      ],
    },
  ],
};

describe("buildSnapshotExample", () => {
  it("uses master record value for choice fields", () => {
    const mastersById = new Map(
      (sampleCtx.masters ?? []).map((m) => [m.id, m])
    );
    const example = buildSnapshotExample(sampleCtx.forms, mastersById);
    expect(example).toEqual({
      main: {
        title: "サンプル",
        category: "education",
        tags: ["education"],
      },
    });
  });
});

describe("enrichFormSetSchema", () => {
  it("links choice fields to master key and public records URL", () => {
    const enriched = enrichFormSetSchema(sampleCtx, {
      publicApiBaseUrl:
        "http://127.0.0.1:8787/public/p/00000000-0000-4000-8000-0000000000a1/v1",
    });
    expect(enriched.snapshotShape.formKeys).toEqual(["main"]);
    expect(enriched.snapshotShape.example).toEqual({
      main: {
        title: "サンプル",
        category: "education",
        tags: ["education"],
      },
    });
    const category = enriched.forms[0]!.fields!.find(
      (f) => f.field_key === "category"
    ) as {
      masterEntityKey: string;
      sampleValues: string[];
      publicRecordsUrl: string;
    };
    expect(category.masterEntityKey).toBe("work-category");
    expect(category.sampleValues).toEqual(["education", "art"]);
    expect(category.publicRecordsUrl).toBe(
      "http://127.0.0.1:8787/public/p/00000000-0000-4000-8000-0000000000a1/v1/master-entities/work-category/records"
    );
    expect(enriched.mastersSummary).toEqual([
      expect.objectContaining({
        key: "work-category",
        recordCount: 2,
      }),
    ]);
  });
});

describe("buildPublicApiInfo", () => {
  it("derives project-scoped public base and master URLs", () => {
    const info = buildPublicApiInfo({
      adminApiUrl: "http://127.0.0.1:8787/admin",
      projectId: "ad39d2d5-6289-4778-a499-3a7f8287baae",
    });
    expect(adminUrlToOrigin("http://127.0.0.1:8787/admin")).toBe(
      "http://127.0.0.1:8787"
    );
    expect(info.publicApiBaseUrl).toBe(
      "http://127.0.0.1:8787/public/p/ad39d2d5-6289-4778-a499-3a7f8287baae/v1"
    );
    expect(info.exampleMasterEntitiesUrl).toContain("/master-entities");
    expect(info.exampleMasterRecordsUrl).toContain(
      "/master-entities/{entityKey}/records"
    );
    expect(info.notes.some((n) => n.includes("master-entities"))).toBe(true);
  });
});
