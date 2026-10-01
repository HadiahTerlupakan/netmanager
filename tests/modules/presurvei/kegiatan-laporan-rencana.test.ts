import { beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({
  kegiatanCreate: vi.fn(),
  rencanaUpdateMany: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/modules/database", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        presurveiKegiatan: { create: palsu.kegiatanCreate },
        presurveiRencana: { updateMany: palsu.rencanaUpdateMany },
      }),
  },
}));

/**
 * Laporan penugasan = kegiatan yang menutup rencananya. Tanpa penautan ini
 * atasan tidak bisa membedakan rencana yang dikerjakan dari yang dilupakan.
 */

import { KegiatanService } from "@/modules/presurvei/services/KegiatanService";
import { KegiatanRepository } from "@/modules/presurvei/repositories/KegiatanRepository";
import { RencanaSudahDitutupError } from "@/modules/presurvei/domain/rencana-rules";
import type { IKegiatanRepository } from "@/modules/presurvei/domain/ports/IKegiatanRepository";
import type { IRencanaRepository } from "@/modules/presurvei/domain/ports/IRencanaRepository";
import type { RencanaEntity } from "@/modules/presurvei/domain/entities/Rencana";

const WAKTU = new Date("2026-09-26T03:00:00Z");

const masukan = {
  jenis: "KUNJUNGAN" as const,
  userId: "sales-a",
  waktuMulai: WAKTU,
  latitude: -6.2,
  longitude: 106.8,
  hasil: "TERTARIK" as const,
};

const rencana = (over: Partial<RencanaEntity> = {}) =>
  ({
    id: "r-1",
    salesId: "sales-a",
    status: "DIRENCANAKAN",
    prospekId: "p-rencana",
    tenantId: "tenant-1",
    ...over,
  }) as RencanaEntity;

describe("KegiatanService.catat dengan rencanaId", () => {
  let repo: IKegiatanRepository;
  let rencanaRepo: IRencanaRepository;

  const service = () => new KegiatanService(repo, vi.fn(), rencanaRepo);

  beforeEach(() => {
    repo = {
      create: vi.fn().mockResolvedValue({ id: "k-1" }),
      createDenganProspek: vi.fn(),
    } as unknown as IKegiatanRepository;
    rencanaRepo = {
      findById: vi.fn().mockResolvedValue(rencana()),
    } as unknown as IRencanaRepository;
  });

  it("menutup rencana dan memakai prospek rencana bila kegiatan tanpa prospek", async () => {
    await service().catat({ ...masukan, rencanaId: "r-1" });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ prospekId: "p-rencana", userId: "sales-a" }),
      { rencanaId: "r-1", dilaporkanAt: expect.any(Date) },
    );
  });

  it("prospek pilihan sales menang atas prospek rencana", async () => {
    await service().catat({ ...masukan, prospekId: "p-lain", rencanaId: "r-1" });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ prospekId: "p-lain" }),
      expect.anything(),
    );
  });

  it("tanpa rencanaId tidak menyentuh rencana", async () => {
    await service().catat(masukan);

    expect(rencanaRepo.findById).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledWith(expect.anything(), undefined);
  });

  it.each([
    ["tidak ada", null, 404],
    ["milik sales lain", rencana({ salesId: "sales-b" }), 403],
    ["sudah dilaporkan", rencana({ status: "SELESAI" }), 409],
    ["sudah dibatalkan", rencana({ status: "BATAL" }), 409],
  ])("rencana %s ditolak tanpa menyimpan kegiatan", async (_, hasil, status) => {
    rencanaRepo.findById = vi.fn().mockResolvedValue(hasil);

    await expect(service().catat({ ...masukan, rencanaId: "r-1" })).rejects.toMatchObject({ statusCode: status });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("laporan PENUGASAN mengabari pemberi tugas; MANDIRI tidak", async () => {
    const umumkan = vi.fn().mockResolvedValue(undefined);
    repo.create = vi.fn().mockResolvedValue({ id: "k-1", hasil: "TERTARIK" });
    rencanaRepo.findById = vi.fn().mockResolvedValue(
      rencana({ sumber: "PENUGASAN", dibuatOlehId: "kepala", namaSales: "Ani", tujuan: "Demo" }),
    );

    await new KegiatanService(repo, vi.fn(), rencanaRepo, umumkan).catat({ ...masukan, rencanaId: "r-1" });

    expect(umumkan).toHaveBeenCalledWith({
      rencanaId: "r-1",
      kegiatanId: "k-1",
      salesId: "sales-a",
      namaSales: "Ani",
      dibuatOlehId: "kepala",
      tujuan: "Demo",
      hasil: "TERTARIK",
      tenantId: "tenant-1",
    });

    umumkan.mockClear();
    rencanaRepo.findById = vi.fn().mockResolvedValue(rencana({ sumber: "MANDIRI" }));
    await new KegiatanService(repo, vi.fn(), rencanaRepo, umumkan).catat({ ...masukan, rencanaId: "r-1" });
    expect(umumkan).not.toHaveBeenCalled();
  });

  it("gagal mengabari pemberi tugas tidak menggagalkan laporan", async () => {
    const umumkan = vi.fn().mockRejectedValue(new Error("redis mati"));
    rencanaRepo.findById = vi.fn().mockResolvedValue(rencana({ sumber: "PENUGASAN" }));

    await expect(
      new KegiatanService(repo, vi.fn(), rencanaRepo, umumkan).catat({ ...masukan, rencanaId: "r-1" }),
    ).resolves.toMatchObject({ kegiatan: { id: "k-1" } });
  });

  it("balapan dua laporan: penolakan repository diterjemahkan menjadi 409", async () => {
    repo.create = vi.fn().mockRejectedValue(new RencanaSudahDitutupError("r-1"));

    await expect(service().catat({ ...masukan, rencanaId: "r-1" })).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("KegiatanRepository.create dengan laporan", () => {
  beforeEach(() => {
    palsu.kegiatanCreate.mockReset().mockResolvedValue({ id: "k-1", userId: "sales-a", fotoUrls: [] });
    palsu.rencanaUpdateMany.mockReset();
  });

  it("menutup rencana milik pelaku yang masih terbuka di transaksi yang sama", async () => {
    palsu.rencanaUpdateMany.mockResolvedValue({ count: 1 });
    const dilaporkanAt = new Date("2026-09-26T04:00:00Z");

    await new KegiatanRepository().create(
      { ...masukan, hasil: "TERTARIK" },
      { rencanaId: "r-1", dilaporkanAt },
    );

    expect(palsu.rencanaUpdateMany).toHaveBeenCalledWith({
      where: { id: "r-1", salesId: "sales-a", status: "DIRENCANAKAN", kegiatanId: null },
      data: { status: "SELESAI", kegiatanId: "k-1", dilaporkanAt },
    });
  });

  it("rencana sudah tertutup: melempar supaya transaksi (dan kegiatannya) batal", async () => {
    palsu.rencanaUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      new KegiatanRepository().create(masukan, { rencanaId: "r-1", dilaporkanAt: WAKTU }),
    ).rejects.toBeInstanceOf(RencanaSudahDitutupError);
  });
});
