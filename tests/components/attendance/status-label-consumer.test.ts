import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("AttendanceClient status label consumer", () => {
  it("uses canonical attendance label helper and removes legacy mangkir wording from canonical UI labels", () => {
    const content = readFileSync(
      join(process.cwd(), "app", "admin", "attendance", "AttendanceClient.tsx"),
      "utf8",
    );

    expect(content).toContain("getCanonicalAttendanceLabel");
    expect(content).toContain("Lupa Absen Pulang");
    expect(content).toContain("Tidak Hadir");
    expect(content).toContain("Sync Ketidakhadiran");
    expect(content).toContain('(item.status === "ALPHA" ||');
    expect(content).toContain('item.status === "NO_CHECKOUT")');
    expect(content).toContain('item.status === "NO_CHECKOUT"');
    expect(content).toContain('"bg-yellow-100 dark:bg-yellow-900/30"');
    expect(content).toContain('"bg-red-100 dark:bg-red-900/30"');
    expect(content).toContain('"text-yellow-800 dark:text-yellow-400"');
    expect(content).toContain('"text-red-800 dark:text-red-400"');
    expect(content).not.toContain("Lupa Check-in (Mangkir)");
    expect(content).not.toContain("Sync Mangkir");
    expect(content).not.toContain("console.error(");
    expect(content).not.toMatch(/label:\s*["']Mangkir["']/);
  });
});
