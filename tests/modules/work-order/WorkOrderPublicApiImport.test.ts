import { describe, expect, it } from "vitest";

describe("work-order public API import", () => {
  it("loads without triggering circular repository initialization", async () => {
    await expect(import("@/modules/work-order")).resolves.toBeDefined();
  });
});
