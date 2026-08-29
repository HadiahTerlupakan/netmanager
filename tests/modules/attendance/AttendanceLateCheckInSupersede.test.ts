import { beforeEach, describe, expect, it } from "vitest";

import { prismaMock } from "../../setup";
import { AttendanceCrudRepository } from "@/modules/attendance/repositories/AttendanceCrudRepository";

/**
 * Check-in yang tiba setelah sistem sudah membuat placeholder harian
 * (ABSENT/ALPHA/DAY_OFF — umum terjadi pada sinkronisasi offline yang telat)
 * harus MENGGANTIKAN placeholder itu, bukan menambah baris kedua di hari sama.
 *
 * Baris yang digantikan dilepas dari slot hariannya (checkInDate = null)
 * supaya unique index (userId, checkInDate, tenantId) tidak menolak baris baru.
 */

const USER_ID = "user-1";
const TENANT_ID = "tenant-1";
const CHECK_IN_DATE = new Date("2026-08-20T00:00:00.000+07:00");

describe("check-in menggantikan placeholder harian buatan sistem", () => {
  let repository: AttendanceCrudRepository;

  beforeEach(() => {
    repository = new AttendanceCrudRepository();
    // mockReset global menghapus implementasi $transaction, pasang ulang.
    prismaMock.$transaction.mockImplementation((callback: unknown) =>
      typeof callback === "function"
        ? (callback as (tx: unknown) => unknown)(prismaMock)
        : Promise.resolve(callback),
    );
    prismaMock.attendance.updateMany.mockResolvedValue({ count: 1 } as never);
    prismaMock.attendance.create.mockResolvedValue({ id: "att-new" } as never);
  });

  it("melepas placeholder sistem pada hari yang sama sebelum membuat baris check-in", async () => {
    await repository.createReplacingSystemGenerated({
      id: "att-new",
      userId: USER_ID,
      tenantId: TENANT_ID,
      checkIn: new Date("2026-08-20T08:33:00.000+07:00"),
      checkInDate: CHECK_IN_DATE,
      status: "ON_TIME",
      updatedAt: new Date(),
    });

    expect(prismaMock.attendance.updateMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        tenantId: TENANT_ID,
        checkInDate: CHECK_IN_DATE,
        correctedAt: null,
        status: { in: ["ABSENT", "ALPHA", "DAY_OFF"] },
      },
      data: expect.objectContaining({
        correctedAt: expect.any(Date),
        checkInDate: null,
      }),
    });
    expect(prismaMock.attendance.create).toHaveBeenCalled();
  });

  it("menjalankan pelepasan dan pembuatan dalam satu transaksi", async () => {
    await repository.createReplacingSystemGenerated({
      id: "att-new",
      userId: USER_ID,
      tenantId: TENANT_ID,
      checkIn: new Date("2026-08-20T08:33:00.000+07:00"),
      checkInDate: CHECK_IN_DATE,
      status: "ON_TIME",
      updatedAt: new Date(),
    });

    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it("tidak menyentuh baris cuti (PERMIT/SICK) yang disetujui", async () => {
    await repository.createReplacingSystemGenerated({
      id: "att-new",
      userId: USER_ID,
      tenantId: TENANT_ID,
      checkIn: new Date("2026-08-20T08:33:00.000+07:00"),
      checkInDate: CHECK_IN_DATE,
      status: "ON_TIME",
      updatedAt: new Date(),
    });

    const where = prismaMock.attendance.updateMany.mock.calls[0][0].where as {
      status: { in: string[] };
    };
    expect(where.status.in).not.toContain("PERMIT");
    expect(where.status.in).not.toContain("SICK");
  });
});
