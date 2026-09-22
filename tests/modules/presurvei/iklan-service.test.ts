import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kode kampanye adalah kunci atribusi: ia dipasangkan dengan `utm_campaign`
 * pada tautan yang sudah tersebar. Dua iklan berkode sama membuat prospek
 * teratribusi ke kampanye yang salah tanpa jejak untuk memperbaikinya.
 */

import { IklanService } from "@/modules/presurvei/services/IklanService";
import type { IIklanRepository } from "@/modules/presurvei/domain/ports/IIklanRepository";
import type { IklanEntity } from "@/modules/presurvei/domain/entities/Iklan";

const WAKTU = new Date("2026-09-22T00:00:00.000Z");

const iklan = (over: Partial<IklanEntity> = {}): IklanEntity =>
  ({
    id: "iklan-1",
    nama: "Promo Ramadan",
    kode: "promo-ramadan",
    channel: "META",
    tanggalMulai: WAKTU,
    tanggalSelesai: null,
    biaya: null,
    penanggungJawabId: null,
    isAktif: true,
    tenantId: "tenant-1",
    createdAt: WAKTU,
    updatedAt: WAKTU,
    ...over,
  }) as IklanEntity;

const bangunRepository = (): IIklanRepository => ({
  findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  findById: vi.fn().mockResolvedValue(null),
  findByKode: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue(iklan()),
  update: vi.fn().mockResolvedValue(iklan()),
});

const masukan = {
  nama: "Promo Ramadan",
  kode: "promo-ramadan",
  channel: "META" as const,
  tanggalMulai: WAKTU,
};

describe("IklanService.buat", () => {
  let repository: IIklanRepository;

  beforeEach(() => {
    repository = bangunRepository();
  });

  it("menolak kode yang sudah dipakai iklan lain", async () => {
    vi.mocked(repository.findByKode).mockResolvedValue(
      iklan({ id: "iklan-lama" }),
    );

    await expect(
      new IklanService(repository).buat(masukan),
    ).rejects.toMatchObject({ statusCode: 409, code: "DUPLIKAT" });

    expect(repository.create).not.toHaveBeenCalled();
  });

  it("menyimpan saat kodenya belum dipakai", async () => {
    await new IklanService(repository).buat(masukan);

    expect(repository.create).toHaveBeenCalledWith(masukan);
  });

  it("menolak tanggal selesai yang mendahului tanggal mulai", async () => {
    await expect(
      new IklanService(repository).buat({
        ...masukan,
        tanggalSelesai: new Date("2026-09-01T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(repository.create).not.toHaveBeenCalled();
  });

  it("menerima tanggal selesai yang sama dengan tanggal mulai", async () => {
    // Kampanye satu hari itu wajar dan tidak boleh ditolak.
    await new IklanService(repository).buat({
      ...masukan,
      tanggalSelesai: WAKTU,
    });

    expect(repository.create).toHaveBeenCalledWith({
      ...masukan,
      tanggalSelesai: WAKTU,
    });
  });
});

describe("IklanService.detail", () => {
  it("melempar 404 saat iklan tidak ditemukan", async () => {
    await expect(
      new IklanService(bangunRepository()).detail("tidak-ada"),
    ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
  });
});

describe("IklanService.ubah", () => {
  let repository: IIklanRepository;

  beforeEach(() => {
    repository = bangunRepository();
    vi.mocked(repository.findById).mockResolvedValue(iklan());
  });

  it("menolak tanggal selesai yang mendahului tanggal mulai tersimpan", async () => {
    await expect(
      new IklanService(repository).ubah("iklan-1", {
        tanggalSelesai: new Date("2026-09-01T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("memeriksa terhadap tanggal mulai baru bila keduanya diubah sekaligus", async () => {
    await new IklanService(repository).ubah("iklan-1", {
      tanggalMulai: new Date("2026-08-01T00:00:00.000Z"),
      tanggalSelesai: new Date("2026-08-15T00:00:00.000Z"),
    });

    expect(repository.update).toHaveBeenCalledWith("iklan-1", {
      tanggalMulai: new Date("2026-08-01T00:00:00.000Z"),
      tanggalSelesai: new Date("2026-08-15T00:00:00.000Z"),
    });
  });
});
