import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pengumum bawaan `KegiatanService` (`umumkanLewatEventBus`). Test service
 * lain menyuntikkan pengumum palsu, jadi tanpa berkas ini argumen
 * `eventBus.publish` yang sesungguhnya tidak dijaga siapa pun. Yang dijaga:
 * nama event, payload TANPA nilai catatan (bisa memuat data pribadi), dan
 * `tenantId` baris kegiatan.
 */

const palsu = vi.hoisted(() => ({ publish: vi.fn() }));

vi.mock("@/lib/event-bus", () => ({
  eventBus: { publish: palsu.publish },
  EVENT_NAMES: { PRESURVEI_KEGIATAN_UPDATED: "presurvei:kegiatan.updated" },
}));

import type { KegiatanEntity } from "@/modules/presurvei/domain/entities/Kegiatan";
import type { IKegiatanRepository } from "@/modules/presurvei/domain/ports/IKegiatanRepository";
import { KegiatanService } from "@/modules/presurvei/services/KegiatanService";

const WAKTU = new Date("2026-09-22T04:00:00.000Z");

const kegiatan: KegiatanEntity = {
  id: "kegiatan-1",
  jenis: "TELEPON",
  userId: "sales-1",
  namaSales: null,
  peranPelaku: null,
  departemenPelaku: null,
  prospekId: null,
  iklanId: null,
  waktuMulai: WAKTU,
  waktuSelesai: null,
  latitude: null,
  longitude: null,
  alamatDikunjungi: null,
  ditemuiNama: "Bu Rina",
  hasil: "TERTARIK",
  catatan: "Catatan lama",
  fotoUrls: [],
  odpTerdekat: null,
  estimasiKabelMeter: null,
  catatanTeknis: null,
  siteId: null,
  tenantId: "tenant-7",
  createdAt: WAKTU,
  updatedAt: WAKTU,
};

const bangunRepository = (): IKegiatanRepository => ({
  findMany: vi.fn(),
  findById: vi.fn().mockResolvedValue(kegiatan),
  create: vi.fn(),
  createDenganProspek: vi.fn(),
  hitungPerUser: vi.fn(),
  ubahDenganRiwayat: vi
    .fn()
    .mockResolvedValue({ ...kegiatan, catatan: "Rahasia pelanggan" }),
  findRiwayat: vi.fn().mockResolvedValue([]),
});

describe("KegiatanService — pengumum bawaan event bus", () => {
  beforeEach(() => {
    palsu.publish.mockReset().mockResolvedValue(undefined);
  });

  it("mempublikasikan presurvei:kegiatan.updated dengan payload persis, tanpa nilai catatan", async () => {
    await new KegiatanService(bangunRepository()).ubah(
      "kegiatan-1",
      { catatan: "Rahasia pelanggan", hasil: "DEAL" },
      { idPengubah: "admin-3" },
    );

    await vi.waitFor(() => expect(palsu.publish).toHaveBeenCalledOnce());
    expect(palsu.publish).toHaveBeenCalledWith("presurvei:kegiatan.updated", {
      kegiatanId: "kegiatan-1",
      pelakuId: "sales-1",
      diubahOlehId: "admin-3",
      medanBerubah: ["catatan", "hasil"],
      triggeredBy: "admin-3",
      tenantId: "tenant-7",
    });
    expect(JSON.stringify(palsu.publish.mock.calls[0])).not.toContain(
      "Rahasia pelanggan",
    );
  });
});
