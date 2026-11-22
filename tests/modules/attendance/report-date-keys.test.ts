import { describe, expect, it } from "vitest";

import {
  countLeaveDaysByUser,
  getDateKeyInTimezone,
  listDateKeysInRange,
} from "@/modules/attendance/domain/report-date-keys";

describe("report-date-keys", () => {
  it("tanggal lokal WIB, bukan tanggal UTC", () => {
    // 06:30 WIB 2 Nov = 23:30 UTC 1 Nov
    expect(
      getDateKeyInTimezone(new Date("2026-11-01T23:30:00Z"), "Asia/Jakarta"),
    ).toBe("2026-11-02");
  });

  it("daftar tanggal dipotong ke rentang laporan", () => {
    expect(
      listDateKeysInRange(
        "2026-10-30",
        "2026-11-02",
        "2026-11-01",
        "2026-11-30",
      ),
    ).toEqual(["2026-11-01", "2026-11-02"]);
    expect(
      listDateKeysInRange(
        "2026-10-01",
        "2026-10-03",
        "2026-11-01",
        "2026-11-30",
      ),
    ).toEqual([]);
  });

  it("hari izin per pegawai melewati akhir bulan", () => {
    const days = countLeaveDaysByUser(
      [
        {
          userId: "u1",
          startDate: new Date("2026-02-26T17:00:00Z"), // 27 Feb WIB
          endDate: new Date("2026-03-01T17:00:00Z"), // 2 Mar WIB
        },
      ],
      {
        startDate: new Date("2026-02-28T17:00:00Z"), // 1 Mar WIB
        endDate: new Date("2026-03-31T16:59:59Z"),
        timezone: "Asia/Jakarta",
      },
    );
    expect(days.get("u1")).toBe(2);
  });
});
