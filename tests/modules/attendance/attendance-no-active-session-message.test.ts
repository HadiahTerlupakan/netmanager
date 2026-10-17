import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logActivitySafe: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  getNoActiveSessionMessage,
  NoActiveSessionError,
} from "@/modules/attendance/domain/errors";
import { AttendanceMutationService } from "@/modules/attendance/services/AttendanceMutationService";

const SEKARANG = new Date("2026-10-13T01:00:00.000Z"); // 08:00 WIB, 13 Okt

function createService(latestAttendance: unknown) {
  return new AttendanceMutationService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { getTimezone: vi.fn().mockResolvedValue("Asia/Jakarta") } as never,
    {
      findFirstActiveForCheckout: vi.fn().mockResolvedValue(null),
      findFirstForCurrentStatus: vi.fn().mockResolvedValue(latestAttendance),
    } as never,
    {} as never,
    {} as never,
  );
}

async function pesanPenolakan(latestAttendance: unknown) {
  const error = await createService(latestAttendance)
    .checkOut({
      userId: "user-1",
      tenantId: "tenant-1",
      photoUrl: null,
      location: null,
    })
    .catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(NoActiveSessionError);
  expect((error as Error).message).toBe("NO_ACTIVE_SESSION");
  return getNoActiveSessionMessage(error);
}

describe("Pesan check-out tanpa sesi aktif", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: SEKARANG });
  });

  it("menjelaskan sesi kemarin sudah ditutup otomatis dan meminta check-in", async () => {
    const pesan = await pesanPenolakan({
      id: "att-12",
      checkIn: new Date("2026-10-12T00:24:50.000Z"),
      checkOut: new Date("2026-10-12T13:00:00.000Z"),
      status: "NO_CHECKOUT",
    });

    expect(pesan).toBe(
      "Sesi absen tanggal 2026-10-12 sudah ditutup otomatis karena belum check-out. Silakan check-in untuk hari ini.",
    );
    vi.useRealTimers();
  });

  it("memberi tahu bila sudah check-out hari ini", async () => {
    const pesan = await pesanPenolakan({
      id: "att-13",
      checkIn: new Date("2026-10-13T00:10:00.000Z"),
      checkOut: new Date("2026-10-13T00:50:00.000Z"),
      status: "ON_TIME",
    });

    expect(pesan).toBe("Anda sudah check-out hari ini.");
    vi.useRealTimers();
  });

  it("meminta check-in bila belum ada absensi hari ini", async () => {
    const pesan = await pesanPenolakan({
      id: "att-11",
      checkIn: new Date("2026-10-11T00:10:00.000Z"),
      checkOut: new Date("2026-10-11T10:00:00.000Z"),
      status: "ON_TIME",
    });

    expect(pesan).toBe(
      "Anda belum check-in hari ini. Silakan check-in terlebih dahulu.",
    );
    vi.useRealTimers();
  });

  it("memakai pesan bawaan untuk galat NO_ACTIVE_SESSION lama", () => {
    expect(getNoActiveSessionMessage(new Error("NO_ACTIVE_SESSION"))).toBe(
      "Anda belum melakukan check-in atau sudah check-out hari ini",
    );
  });
});
