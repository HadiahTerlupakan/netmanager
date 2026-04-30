import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const hookSource = readFileSync(
  "lib/websocket/hooks/useRealtimePaymentApprovals.ts",
  "utf8",
);

describe("realtime payment approvals error handling", () => {
  it("checks the pending manual payments response before parsing JSON", () => {
    const okCheckIndex = hookSource.indexOf("res.ok");
    const jsonParseIndex = hookSource.indexOf("res.json()");

    expect(okCheckIndex).toBeGreaterThan(-1);
    expect(okCheckIndex).toBeLessThan(jsonParseIndex);
  });
});
