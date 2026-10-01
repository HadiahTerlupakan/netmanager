import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  createNotification: vi.fn(),
  hasNotificationForSource: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/modules/notification", () => palsu);

import { handleRencanaAssignedPresurvei } from "@/modules/presurvei/services/event-handlers/rencana-assigned-presurvei.handler";
import { handleRencanaReportedPresurvei } from "@/modules/presurvei/services/event-handlers/rencana-reported-presurvei.handler";

const job = (payload: Record<string, unknown>) =>
  ({
    data: {
      payload: {
        rencanaId: "r-1",
        salesId: "sales-a",
        namaPembuat: "Kepala",
        tanggal: "2026-09-27",
        tujuan: "Demo paket",
        tenantId: "tenant-1",
        ...payload,
      },
    },
  }) as never;

describe("handleRencanaAssignedPresurvei", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    palsu.hasNotificationForSource.mockResolvedValue(false);
  });

  it("mengabari sales dengan tanggal dan jam, bertaut ke rincian rencana", async () => {
    await handleRencanaAssignedPresurvei(job({ jam: "13:30" }));

    expect(palsu.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "sales-a",
        message: "Kepala menugaskan kunjungan tanggal 2026-09-27 pukul 13:30: Demo paket",
        link: "/presurvei/rencana/r-1",
        sourceType: "PRESURVEI_RENCANA",
        sourceId: "r-1",
        tenantId: "tenant-1",
      }),
    );
  });

  it("tanpa jam: hanya tanggal", async () => {
    await handleRencanaAssignedPresurvei(job({ jam: null }));

    expect(palsu.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Kepala menugaskan kunjungan tanggal 2026-09-27: Demo paket" }),
    );
  });

  it("idempotent: job yang diulang tidak mengirim notifikasi kedua", async () => {
    palsu.hasNotificationForSource.mockResolvedValue(true);

    await handleRencanaAssignedPresurvei(job({}));

    expect(palsu.createNotification).not.toHaveBeenCalled();
  });
});

describe("handleRencanaReportedPresurvei", () => {
  const jobLaporan = (payload: Record<string, unknown> = {}) =>
    ({
      data: {
        payload: {
          rencanaId: "r-1",
          kegiatanId: "k-1",
          salesId: "sales-a",
          namaSales: "Ani",
          dibuatOlehId: "kepala",
          tujuan: "Demo paket",
          hasil: "PERLU_FOLLOWUP",
          tenantId: "tenant-1",
          ...payload,
        },
      },
    }) as never;

  beforeEach(() => {
    vi.clearAllMocks();
    palsu.hasNotificationForSource.mockResolvedValue(false);
  });

  it("mengabari pemberi tugas dengan nama sales dan hasil berlabel", async () => {
    await handleRencanaReportedPresurvei(jobLaporan());

    expect(palsu.hasNotificationForSource).toHaveBeenCalledWith({
      userId: "kepala",
      sourceType: "PRESURVEI_RENCANA",
      sourceId: "r-1",
    });
    expect(palsu.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "kepala",
        title: "✅ Laporan kunjungan masuk",
        message: 'Ani melaporkan "Demo paket" — hasil: Perlu follow-up',
        link: "/presurvei/rencana/r-1",
      }),
    );
  });

  it("idempotent: tidak mengabari dua kali", async () => {
    palsu.hasNotificationForSource.mockResolvedValue(true);
    await handleRencanaReportedPresurvei(jobLaporan());
    expect(palsu.createNotification).not.toHaveBeenCalled();
  });
});
