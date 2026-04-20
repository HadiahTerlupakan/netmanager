import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("AttendanceClient status detail filter consumer", () => {
  it("exposes a grouped statusDetail filter with specific labels for permit and day-off variants", () => {
    const content = readFileSync(
      join(process.cwd(), "app", "admin", "attendance", "AttendanceClient.tsx"),
      "utf8",
    );

    expect(content).toContain("statusDetail");
    expect(content).toContain('<optgroup label="Kehadiran">');
    expect(content).toContain('<optgroup label="Ketidakhadiran">');
    expect(content).toContain('<optgroup label="Libur & Pengganti">');
    expect(content).toContain('<optgroup label="Masalah Absensi">');
    expect(content).toContain("Cuti");
    expect(content).toContain("Izin");
    expect(content).toContain("Tukar Libur");
    expect(content).toContain("Libur Nasional");
    expect(content).toContain("Hari Libur");
    expect(content).toContain('<option value="ABSENT">Tidak Hadir</option>');
    expect(content).toContain(
      '<option value="NO_CHECKOUT">Lupa Absen Pulang</option>',
    );
    expect(content).toContain(
      '<option value="ABSENT">Tidak Hadir (ABSENT)</option>',
    );
    expect(content).toMatch(
      /<option value="NO_CHECKOUT">\s*Lupa Absen Pulang \(NO_CHECKOUT\)\s*<\/option>/,
    );
    expect(content).not.toContain("Alpha (ABSENT)");
    expect(content).not.toContain("Tidak Checkout (NO_CHECKOUT)");
  });

  it("trusts backend displayStatus instead of hard-coded 08:00 heuristics for no-checkout labels", () => {
    const content = readFileSync(
      join(process.cwd(), "app", "admin", "attendance", "AttendanceClient.tsx"),
      "utf8",
    );

    expect(content).toContain("displayStatus");
    expect(content).not.toContain(
      "checkInHour < 8 || (checkInHour === 8 && checkInMinute === 0)",
    );
    expect(content).not.toContain(
      "const checkInHour = checkInDate.getHours();",
    );
    expect(content).not.toContain(
      "const checkInMinute = checkInDate.getMinutes();",
    );
  });
});
