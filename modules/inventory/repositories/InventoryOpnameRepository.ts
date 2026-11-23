import type { PrismaClient } from "@prisma/client";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import type {
  InventoryOpnameRecord,
  PelakuPerubahanOpname,
  UpdateStockOpnameInput,
  UpdatedStockOpnameResult,
} from "../domain/ports/IInventoryOperationRepository";
import {
  ringkasPenghapusan,
  ringkasPerubahan,
} from "../domain/riwayat-stock-opname";
import { getStockOpnameRiwayatRepository } from "./StockOpnameRiwayatRepository";
import type { Prisma } from "./prisma-boundary";
import { OPNAME_PESAN } from "../domain/opname-pesan";
import {
  planOpnameMovement,
  resolveOpnameStockCondition,
} from "../domain/opname-mutasi";
import {
  applyConditionDelta,
  computeStockEffect,
  toStoredStockEffect,
} from "../domain/opname-stock-condition";
import {
  createOpnameMovement,
  readOpnameStock,
  reverseOpnameEffect,
  writeOpnameStock,
} from "./opname-stock-effect";

/**
 * Alasan selisih setelah diubah: alasan baru bila dikirim (null = dihapus),
 * alasan lama bila tidak dikirim; dikosongkan bila selisihnya kini 0 karena
 * tidak ada yang dijelaskan.
 */
function resolveUpdatedAlasan(
  input: { alasanSelisih?: string | null },
  existingRecord: { alasanSelisih: string | null },
  selisih: number,
): string | null {
  if (selisih === 0) return null;
  return input.alasanSelisih === undefined
    ? existingRecord.alasanSelisih
    : input.alasanSelisih;
}

export class InventoryOpnameRepository {
  constructor(private readonly db: PrismaClient) {}

  /** Find opname record with item and warehouse details, scoped to tenant. */
  async getOpnameRecord(id: string): Promise<InventoryOpnameRecord | null> {
    const tenantFilter = await this.buildTenantFilter();
    return this.db.stockOpname.findFirst({
      where: { id, ...tenantFilter },
      include: {
        barang: { select: { id: true, kode: true, nama: true, satuan: true } },
        gudang: { select: { id: true, kode: true, nama: true, lokasi: true } },
      },
    }) as unknown as Promise<InventoryOpnameRecord | null>;
  }

  /**
   * Ubah opname terakhir lalu sinkronkan stok: efek lama (mutasi dan kolom
   * kondisi) dibatalkan, lalu selisih baru diterapkan dengan mutasi baru.
   */
  async updateOpname(
    input: UpdateStockOpnameInput,
    pelaku: PelakuPerubahanOpname,
  ): Promise<UpdatedStockOpnameResult> {
    await this.ensureOpnameBelongsToTenant(input.id);

    return this.db.$transaction(async (tx) => {
      const existingRecord = await this.findOpnameForMutation(tx, input.id);
      await this.ensureLatestOpname(tx, existingRecord);

      const stock = await readOpnameStock(tx, existingRecord);
      const reversed = await reverseOpnameEffect(
        tx,
        existingRecord,
        stock.columns,
      );
      const selisihBaru = input.stokFisik - existingRecord.stokSistem;
      const alasanSelisih = resolveUpdatedAlasan(
        input,
        existingRecord,
        selisihBaru,
      );
      const updatedRecord = await tx.stockOpname.update({
        where: { id: existingRecord.id },
        data: this.buildUpdatePayload(input, existingRecord, {
          selisih: selisihBaru,
          alasanSelisih,
        }),
      });

      const plan = planOpnameMovement({
        opnameId: existingRecord.id,
        selisih: selisihBaru,
        alasanSelisih,
        kondisiBaik: updatedRecord.kondisiBaik,
        kondisiRusak: updatedRecord.kondisiRusak,
        kondisiExpire: updatedRecord.kondisiExpire,
      });
      if (plan) {
        await createOpnameMovement(tx, {
          location: existingRecord,
          opnameId: existingRecord.id,
          plan,
        });
      }
      const columns = applyConditionDelta(
        reversed,
        resolveOpnameStockCondition(plan),
        selisihBaru,
      );
      await writeOpnameStock(tx, existingRecord, {
        exists: stock.exists,
        columns,
      });
      await tx.stockOpname.update({
        where: { id: existingRecord.id },
        data: toStoredStockEffect(computeStockEffect(reversed, columns)),
      });

      await this.catatPerubahan(tx, {
        pelaku,
        sebelum: existingRecord,
        sesudah: updatedRecord,
        namaBarang: existingRecord.barang.nama,
      });

      return {
        record: updatedRecord as unknown as Record<string, unknown>,
        stokSistem: existingRecord.stokSistem,
        selisih: selisihBaru,
      };
    });
  }

  /**
   * Hapus opname terakhir dan batalkan efeknya: mutasi yang dibuatnya dihapus
   * dan kolom stok per kondisi dikembalikan, dalam satu transaksi.
   */
  async deleteOpname(id: string, pelaku: PelakuPerubahanOpname): Promise<void> {
    await this.ensureOpnameBelongsToTenant(id);

    await this.db.$transaction(async (tx) => {
      const existingRecord = await this.findOpnameForMutation(tx, id);
      await this.ensureLatestOpname(tx, existingRecord);

      const stock = await readOpnameStock(tx, existingRecord);
      const reversed = await reverseOpnameEffect(
        tx,
        existingRecord,
        stock.columns,
      );
      if (stock.exists) {
        await writeOpnameStock(tx, existingRecord, {
          exists: true,
          columns: reversed,
        });
      }
      await tx.stockOpname.delete({ where: { id: existingRecord.id } });

      await getStockOpnameRiwayatRepository().catat(tx, {
        opnameId: existingRecord.id,
        gudangId: existingRecord.gudangId,
        barangId: existingRecord.barangId,
        tenantId: existingRecord.tenantId,
        aksi: "DIHAPUS",
        dilakukanOlehId: pelaku.id,
        namaPelaku: pelaku.nama,
        namaBarang: existingRecord.barang.nama,
        perubahan: ringkasPenghapusan(
          existingRecord as unknown as Record<string, unknown>,
        ),
      });
    });
  }

  /** Ambil catatan opname yang akan diubah/dihapus, di dalam transaksi. */
  private async findOpnameForMutation(
    tx: Prisma.TransactionClient,
    id: string,
  ) {
    const record = await tx.stockOpname.findUnique({
      where: { id: id.trim() },
      include: { barang: { select: { nama: true } } },
    });
    if (!record) throw new Error("Record stock opname tidak ditemukan");
    return record;
  }

  /**
   * Hanya opname terakhir untuk barang & gudangnya yang boleh diubah/dihapus.
   * Opname lama sudah ditimpa hitungan sesudahnya; membatalkan efeknya akan
   * menggeser stok yang sudah dikoreksi opname berikutnya.
   */
  private async ensureLatestOpname(
    tx: Prisma.TransactionClient,
    record: {
      id: string;
      barangId: string;
      gudangId: string;
      tenantId: string | null;
    },
  ): Promise<void> {
    const latest = await tx.stockOpname.findFirst({
      where: {
        barangId: record.barangId,
        gudangId: record.gudangId,
        tenantId: record.tenantId,
      },
      orderBy: [{ tanggal: "desc" }, { id: "desc" }],
      select: { id: true },
    });
    if (latest?.id !== record.id) {
      throw new Error(OPNAME_PESAN.bukanOpnameTerakhir);
    }
  }

  /**
   * Catat satu penyuntingan ke jejak perubahan.
   *
   * Hanya ditulis bila ada yang benar-benar berubah: menyimpan baris untuk
   * penyimpanan yang tidak mengubah apa pun membuat riwayat penuh derau dan
   * menutupi perubahan yang sebenarnya.
   */
  private async catatPerubahan(
    tx: Prisma.TransactionClient,
    input: {
      pelaku: PelakuPerubahanOpname;
      sebelum: Record<string, unknown> & {
        id: string;
        gudangId: string;
        barangId: string;
        tenantId: string | null;
      };
      sesudah: Record<string, unknown>;
      namaBarang: string;
    },
  ): Promise<void> {
    const perubahan = ringkasPerubahan(input.sebelum, input.sesudah);
    if (Object.keys(perubahan).length === 0) return;

    await getStockOpnameRiwayatRepository().catat(tx, {
      opnameId: input.sebelum.id,
      gudangId: input.sebelum.gudangId,
      barangId: input.sebelum.barangId,
      tenantId: input.sebelum.tenantId,
      aksi: "DIUBAH",
      dilakukanOlehId: input.pelaku.id,
      namaPelaku: input.pelaku.nama,
      namaBarang: input.namaBarang,
      perubahan,
    });
  }

  /** Build tenant filter for queries. SuperAdmin bypasses tenant isolation. */
  private async buildTenantFilter(): Promise<{ tenantId?: string }> {
    const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
    if (isSuperAdmin) return {};
    if (!tenantId) return { tenantId: "___MISSING_TENANT_ID___" };
    return { tenantId };
  }

  /** Verify the opname record belongs to the current tenant before mutation. */
  private async ensureOpnameBelongsToTenant(id: string): Promise<void> {
    const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
    if (isSuperAdmin) return;

    const record = await this.db.stockOpname.findUnique({
      where: { id: id.trim() },
      select: { tenantId: true },
    });

    if (!record) {
      throw new Error("Record stock opname tidak ditemukan");
    }

    if (record.tenantId !== tenantId) {
      throw new Error("Akses ditolak: record bukan milik tenant Anda");
    }
  }

  private buildUpdatePayload(
    input: UpdateStockOpnameInput,
    existingRecord: {
      kondisiBaik: number | null;
      kondisiRusak: number | null;
      kondisiExpire: number | null;
      tanggalExpire: Date | null;
    },
    hasil: { selisih: number; alasanSelisih: string | null },
  ) {
    return {
      stokFisik: input.stokFisik,
      selisih: hasil.selisih,
      alasanSelisih: hasil.alasanSelisih,
      keterangan: input.keterangan,
      kondisiBaik: input.kondisiBaik ?? existingRecord.kondisiBaik,
      kondisiRusak: input.kondisiRusak ?? existingRecord.kondisiRusak,
      kondisiExpire: input.kondisiExpire ?? existingRecord.kondisiExpire,
      lokasiPenyimpanan: input.lokasiPenyimpanan,
      nomorRak: input.nomorRak,
      nomorBox: input.nomorBox,
      pic: input.pic,
      suhuPenyimpanan: this.toNullableNumber(input.suhuPenyimpanan),
      kelembaban: this.toNullableNumber(input.kelembaban),
      tanggalExpire: input.tanggalExpire
        ? new Date(input.tanggalExpire)
        : existingRecord.tanggalExpire,
      nomorBatch: input.nomorBatch,
      catatanDetail: input.catatanDetail,
    };
  }

  private toNullableNumber(value: unknown) {
    return value !== undefined && value !== null ? Number(value) : null;
  }
}
