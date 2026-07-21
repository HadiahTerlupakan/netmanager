import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("WORK_ORDER_CREATED handler", () => {
  it("does not call notifyNewWorkOrder (in-app is sync path only)", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/event-bus/event-handlers.ts"),
      "utf8",
    );
    const start = source.indexOf("WORK_ORDER_CREATED");
    const end = source.indexOf("WORK_ORDER_UPDATED", start);
    const createdBlock = source.slice(start, end === -1 ? undefined : end);
    expect(createdBlock).toContain("socketEmitter.newWorkOrder");
    expect(createdBlock).not.toContain("notifyNewWorkOrder");
  });
});
