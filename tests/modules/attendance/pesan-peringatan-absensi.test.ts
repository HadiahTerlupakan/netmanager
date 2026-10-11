import { describe, expect, it } from "vitest";
import { getCurrentAttendanceWarningMessage } from "@/modules/attendance/services/attendance-current-status-helpers";

function evaluasi(reasonCodes: string[]) {
  return { reasonCodes } as never;
}

describe("pesan peringatan status absensi", () => {
  it("menerjemahkan kode alasan menjadi kalimat untuk pengguna", () => {
    // Aplikasi menampilkan `warningMessage` apa adanya; kode mentah membuat
    // teknisi melihat banner "WEAK_GEOFENCE_EVIDENCE".
    const pesan = getCurrentAttendanceWarningMessage(
      evaluasi(["WEAK_GEOFENCE_EVIDENCE"]),
      null,
    );

    expect(pesan).toBeTruthy();
    expect(pesan).not.toBe("WEAK_GEOFENCE_EVIDENCE");
    expect(pesan).toMatch(/lokasi absensi/i);
  });

  it("tidak pernah membocorkan kode yang belum punya kalimat", () => {
    const pesan = getCurrentAttendanceWarningMessage(
      evaluasi(["KODE_BARU_YANG_BELUM_DITERJEMAHKAN"]),
      null,
    );

    expect(pesan).toBeNull();
  });

  it("memakai pesan cadangan saat tidak ada kode alasan", () => {
    expect(
      getCurrentAttendanceWarningMessage(evaluasi([]), "Pesan cadangan"),
    ).toBe("Pesan cadangan");
  });

  it("memakai pesan cadangan saat evaluasi tidak ada", () => {
    expect(getCurrentAttendanceWarningMessage(null as never, null)).toBeNull();
  });
});
