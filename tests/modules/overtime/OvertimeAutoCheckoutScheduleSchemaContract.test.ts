import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSchema() {
  return readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
}

function extractBlock(
  schema: string,
  blockType: "model" | "enum",
  blockName: string,
): string {
  const blockRegex = new RegExp(
    `${blockType}\\s+${blockName}\\s*\\{([\\s\\S]*?)\\n\\}`,
  );
  const matchedBlock = schema.match(blockRegex);

  expect(matchedBlock, `${blockType} ${blockName} should exist`).not.toBeNull();
  return matchedBlock![1];
}

describe("overtime auto checkout scheduler schema contract", () => {
  it("defines overtime auto checkout scheduling metadata", () => {
    const schema = readSchema();
    const modelBlock = extractBlock(
      schema,
      "model",
      "OvertimeAutoCheckoutSchedule",
    );
    const enumBlock = extractBlock(
      schema,
      "enum",
      "OvertimeAutoCheckoutScheduleStatus",
    );

    expect(modelBlock).toMatch(/overtimeId\s+String\s+@unique\b/);
    expect(modelBlock).toMatch(
      /scheduleStatus\s+OvertimeAutoCheckoutScheduleStatus\s+@default\(SCHEDULED\)/,
    );
    expect(modelBlock).toMatch(/@@index\(\[scheduleStatus,\s*scheduledFor\]\)/);
    expect(modelBlock).not.toMatch(/@@unique\(\[\s*overtimeId\s*\]\)/);

    const enumValues = enumBlock
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    expect(enumValues).toEqual([
      "SCHEDULED",
      "COMPLETED",
      "CANCELLED",
      "FAILED",
    ]);
  });
});
