import { describe, expect, it } from "vitest";

import { attendanceFilterSchema } from "@/modules/attendance/validators/attendance";
import { buildOvertimeWhere } from "@/modules/overtime/repositories/OvertimeRepository.helpers";
import { lemburFilterSchema } from "@/modules/overtime/validators/lembur";

// Site CARIU & departemen Technical di produksi ber-ID CUID, bukan UUID.
const CUID_SITE = "cmjfuc4om0000pa19yjsl1qy7";
const CUID_DEPT = "cmjfrgbzt008yp2boy2u9nzxj";

describe("filter lembur & absensi — ID non-UUID", () => {
  it("lembur menerima siteId/departmentId CUID", () => {
    const parsed = lemburFilterSchema.safeParse({
      siteId: CUID_SITE,
      departmentId: CUID_DEPT,
    });
    expect(parsed.success).toBe(true);
  });

  it("absensi menerima siteId/departmentId CUID", () => {
    const parsed = attendanceFilterSchema.safeParse({
      siteId: CUID_SITE,
      departmentId: CUID_DEPT,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("buildOvertimeWhere — rentang tanggal satu sisi", () => {
  const start = new Date("2026-08-01T00:00:00Z");
  const end = new Date("2026-11-25T23:59:59Z");

  it("hanya startDate tetap menyaring", () => {
    expect(buildOvertimeWhere({ startDate: start }).createdAt).toEqual({
      gte: start,
    });
  });

  it("hanya endDate tetap menyaring", () => {
    expect(buildOvertimeWhere({ endDate: end }).createdAt).toEqual({
      lte: end,
    });
  });

  it("tanpa tanggal tidak menyaring", () => {
    expect(buildOvertimeWhere({}).createdAt).toBeUndefined();
  });
});
