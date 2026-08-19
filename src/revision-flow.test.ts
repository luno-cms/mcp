import { beforeEach, describe, expect, it, vi } from "vitest";

const lunoJson = vi.hoisted(() => vi.fn());

vi.mock("./luno-api.js", () => ({ lunoJson }));

import { publishRevisionFlow } from "./revision-flow.js";

describe("publishRevisionFlow", () => {
  beforeEach(() => {
    lunoJson.mockReset();
  });

  it("calls server /publish with save revision (no client-side bump)", async () => {
    lunoJson.mockResolvedValueOnce({
      steps: ["submit_for_review", "approve"],
      revision: { id: "rev-row", revision: 5, status: "published" },
    });

    const out = await publishRevisionFlow("fs", "entry", "rev-row", 3);

    expect(out.steps).toEqual(["submit_for_review", "approve"]);
    expect(out.revision).toEqual({ id: "rev-row", revision: 5, status: "published" });
    expect(lunoJson).toHaveBeenCalledWith(
      "/v1/form-sets/fs/entries/entry/revisions/rev-row/publish",
      { method: "POST", json: { revision: 3 } }
    );
  });

  it("forwards publishAt", async () => {
    lunoJson.mockResolvedValueOnce({
      steps: ["approve"],
      revision: { id: "rev-row", revision: 5, status: "published" },
    });

    await publishRevisionFlow("fs", "entry", "rev-row", 4, "2026-09-01T00:00:00Z");
    expect(lunoJson).toHaveBeenCalledWith(
      "/v1/form-sets/fs/entries/entry/revisions/rev-row/publish",
      {
        method: "POST",
        json: { revision: 4, publishAt: "2026-09-01T00:00:00Z" },
      }
    );
  });
});
