import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSchema() {
  return readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
}

describe("attendance evaluation schema contract", () => {
  it("defines canonical evaluation and audit trail models", () => {
    const schema = readSchema();

    expect(schema).toContain("model AttendanceEvaluation");
    expect(schema).toContain("model AttendanceEvaluationAudit");
    expect(schema).toContain("reviewState");
    expect(schema).toContain("payrollHoldState");
    expect(schema).toContain("evaluationVersion");
    expect(schema).toContain("reasonCodes");
    expect(schema).toContain("anomalyCodes");
  });
});
