import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("AttendancePageContent current status consumer", () => {
  it("uses the dedicated status endpoint while keeping history fetch for history data", () => {
    const content = readFileSync(
      join(
        process.cwd(),
        "components",
        "attendance",
        "AttendancePageContent.tsx",
      ),
      "utf8",
    );

    expect(content).toContain("/api/attendance/status");
    expect(content).toContain("/api/attendance/history?limit=5");
  });

  it("preserves SHIFT mode from backend contract through the web consumer and indicator props", () => {
    const pageContent = readFileSync(
      join(
        process.cwd(),
        "components",
        "attendance",
        "AttendancePageContent.tsx",
      ),
      "utf8",
    );
    const indicatorContent = readFileSync(
      join(
        process.cwd(),
        "components",
        "attendance",
        "AttendanceStatusIndicator.tsx",
      ),
      "utf8",
    );

    expect(pageContent).toContain('currentStatus.workingHourMode === "SHIFT"');
    expect(pageContent).toContain(
      'currentStatus.workingHourMode === "FLEXIBLE"',
    );
    expect(pageContent).not.toContain(
      'setWorkingHourMode(currentStatus.workingHourMode === "FLEXIBLE" ? "FLEXIBLE" : "FIXED")',
    );
    expect(indicatorContent).toContain(
      'workingHourMode: "FIXED" | "SHIFT" | "FLEXIBLE"',
    );
  });

  it("preserves SHIFT mode in the card consumer state passed to the indicator", () => {
    const cardContent = readFileSync(
      join(process.cwd(), "components", "attendance", "AttendanceCard.tsx"),
      "utf8",
    );

    expect(cardContent).toContain(
      "const [workingHourMode, setWorkingHourMode] = useState<",
    );
    expect(cardContent).toContain('"FIXED" | "SHIFT" | "FLEXIBLE"');
    expect(cardContent).toContain("workingHourMode={workingHourMode}");
    expect(cardContent).not.toContain('"FIXED" | "FLEXIBLE"');
  });
});
