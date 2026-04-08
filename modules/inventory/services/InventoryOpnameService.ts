import { randomUUID } from "crypto";

import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { logActivitySafe } from "@/lib/logger";
import { prisma } from "@/modules/database";
import type { Prisma } from "@prisma/client";
import type { Session } from "next-auth";

import { validateGudangAccess } from "../utils/validation";

type InventoryUserContext = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  permissions?: string[];
  siteId?: string | null;
};

export type ListInventoryOpnameInput = {
  user: InventoryUserContext;
  barangId?: string;
  gudangId?: string;
  page: number;
  limit: number;
};

export type CreateInventoryOpnameInput = {
  user: InventoryUserContext;
  barangId: string;
  gudangId: string;
  stokFisik: number;
  keterangan?: string;
  kondisiBaik?: number;
  kondisiRusak?: number;
  kondisiExpire?: number;
  lokasiPenyimpanan?: string;
  nomorRak?: string;
  nomorBox?: string;
  suhuPenyimpanan?: string;
  kelembaban?: string;
  tanggalExpire?: string;
  nomorBatch?: string;
  catatanDetail?: string;
  alasanSelisih?: string;
};

const ALASAN_LABELS: Record<string, string> = {
  hilang: "Barang hilang",
  rusak: "Barang rusak/tidak layak",
  revisi: "Revisi stok/koreksi data",
  salah_input: "Kesalahan input sebelumnya",
  terpakai: "Terpakai tidak tercatat",
  expired: "Barang kadaluarsa",
  lebih: "Stok lebih/ditemukan",
  lainnya: "Lainnya",
};

export class InventoryOpnameService {
  async listOpname(input: ListInventoryOpnameInput) {
    const offset = (input.page - 1) * input.limit;
    const where: Prisma.StockOpnameWhereInput = {};

    if (input.barangId) {
      where.barangId = input.barangId;
    }

    if (input.gudangId) {
      where.gudangId = input.gudangId;
    }

    const permissions = await getUserPermissions(input.user.id);
    const isSuper = isSuperAdmin(input.user as never);
    const dbUser = await prisma.user.findUnique({
      where: { id: input.user.id },
      select: { siteId: true },
    });

    if (!isSuper && permissions.includes("opname:site_only")) {
      if (!dbUser?.siteId) {
        return {
          opnameList: [],
          pagination: {
            page: input.page,
            limit: input.limit,
            total: 0,
            totalPages: 0,
          },
        };
      }

      where.gudang = {
        sites: {
          some: {
            id: dbUser.siteId,
          },
        },
      };
    }

    const [opnameList, total] = await Promise.all([
      prisma.stockOpname.findMany({
        where,
        include: {
          barang: {
            select: {
              id: true,
              kode: true,
              nama: true,
              satuan: true,
            },
          },
          gudang: {
            select: {
              id: true,
              kode: true,
              nama: true,
            },
          },
        },
        orderBy: {
          tanggal: "desc",
        },
        skip: offset,
        take: input.limit,
      }),
      prisma.stockOpname.count({ where }),
    ]);

    return {
      opnameList,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  async createOpname(input: CreateInventoryOpnameInput) {
    const accessSession = await this.buildGudangAccessSession(input.user);
    const access = await validateGudangAccess(accessSession, input.gudangId);

    if (!access.allowed) {
      throw new Error(access.error || "Akses ditolak");
    }

    const result = await prisma.$transaction(async (tx) => {
      const [barang, gudang, currentStock] = await Promise.all([
        tx.barang.findUnique({ where: { id: input.barangId } }),
        tx.gudang.findUnique({ where: { id: input.gudangId, isActive: true } }),
        tx.barangGudang.findUnique({
          where: {
            barangId_gudangId: {
              barangId: input.barangId,
              gudangId: input.gudangId,
            },
          },
        }),
      ]);

      if (!barang) {
        throw new Error("Barang tidak ditemukan");
      }

      if (!gudang) {
        throw new Error("Gudang tidak ditemukan atau tidak aktif");
      }

      const stokSistem = currentStock?.stok || 0;
      const selisih = input.stokFisik - stokSistem;

      const opnameRecord = await tx.stockOpname.create({
        data: {
          id: randomUUID(),
          barangId: input.barangId,
          gudangId: input.gudangId,
          stokFisik: input.stokFisik,
          stokSistem,
          selisih,
          keterangan: input.keterangan,
          kondisiBaik: input.kondisiBaik ?? 0,
          kondisiRusak: input.kondisiRusak ?? 0,
          kondisiExpire: input.kondisiExpire ?? 0,
          lokasiPenyimpanan: input.lokasiPenyimpanan,
          nomorRak: input.nomorRak,
          nomorBox: input.nomorBox,
          pic: input.user.name || input.user.email || "Admin",
          suhuPenyimpanan:
            input.suhuPenyimpanan !== undefined && input.suhuPenyimpanan !== ""
              ? Number(input.suhuPenyimpanan)
              : null,
          kelembaban:
            input.kelembaban !== undefined && input.kelembaban !== ""
              ? Number(input.kelembaban)
              : null,
          tanggalExpire: input.tanggalExpire
            ? new Date(input.tanggalExpire)
            : null,
          nomorBatch: input.nomorBatch,
          catatanDetail: input.catatanDetail,
          alasanSelisih: input.alasanSelisih,
        },
      });

      if (selisih !== 0) {
        const alasanText = input.alasanSelisih
          ? ALASAN_LABELS[input.alasanSelisih] || input.alasanSelisih
          : "Penyesuaian stok";

        if (selisih > 0) {
          await tx.barangMasuk.create({
            data: {
              id: randomUUID(),
              barangId: input.barangId,
              gudangId: input.gudangId,
              jumlah: selisih,
              kondisi: "BARU",
              keterangan: `Opname: ${alasanText} (+${selisih}). Ref: ${opnameRecord.id}`,
            },
          });
        } else {
          await tx.barangKeluar.create({
            data: {
              id: randomUUID(),
              barangId: input.barangId,
              gudangId: input.gudangId,
              jumlah: Math.abs(selisih),
              kondisi: input.alasanSelisih === "rusak" ? "RUSAK" : "BARU",
              isHilang: input.alasanSelisih === "hilang",
              keterangan: `Opname: ${alasanText} (${selisih}). Ref: ${opnameRecord.id}`,
            },
          });
        }
      }

      if (currentStock) {
        const updateData: {
          stok: number;
          stokBaru?: number;
          stokBekas?: number;
          stokRusak?: number;
        } = {
          stok: input.stokFisik,
        };

        if (selisih !== 0) {
          if (selisih < 0) {
            const absSelisih = Math.abs(selisih);
            updateData.stokBaru = Math.max(
              0,
              (currentStock.stokBaru || 0) - absSelisih,
            );
          } else {
            updateData.stokBaru = (currentStock.stokBaru || 0) + selisih;
          }
        }

        await tx.barangGudang.update({
          where: {
            barangId_gudangId: {
              barangId: input.barangId,
              gudangId: input.gudangId,
            },
          },
          data: updateData,
        });
      } else if (input.stokFisik > 0) {
        await tx.barangGudang.create({
          data: {
            id: randomUUID(),
            barangId: input.barangId,
            gudangId: input.gudangId,
            stok: input.stokFisik,
            stokBaru: input.stokFisik,
            stokBekas: 0,
            stokRusak: 0,
            updatedAt: new Date(),
          },
        });
      }

      return {
        opnameRecord,
        previousStock: stokSistem,
        newStock: input.stokFisik,
        selisih,
      };
    });

    logActivitySafe({
      action: "CREATE",
      subject: "Stock Opname",
      userId: input.user.id,
      details: {
        id: result.opnameRecord.id,
        barangId: input.barangId,
        gudangId: input.gudangId,
        diff: result.selisih,
      },
    });

    return result;
  }

  private async buildGudangAccessSession(
    user: InventoryUserContext,
  ): Promise<Session> {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { siteId: true, role: true },
    });

    return {
      user: {
        ...user,
        siteId: dbUser?.siteId,
        role: dbUser?.role || user.role,
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as Session;
  }
}

let inventoryOpnameServiceInstance: InventoryOpnameService | null = null;

export function getInventoryOpnameService(): InventoryOpnameService {
  if (!inventoryOpnameServiceInstance) {
    inventoryOpnameServiceInstance = new InventoryOpnameService();
  }

  return inventoryOpnameServiceInstance;
}
