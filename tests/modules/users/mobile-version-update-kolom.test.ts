import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  buildVersionUpdate,
  buildVersionUpdatePengguna,
} from "@/modules/users/services/MobileAuthVersionService";

/**
 * Pencatatan versi aplikasi saat login menulis ke dua model berbeda:
 * `Pelanggan` dan `User`. Keduanya sempat memakai satu fungsi yang ikut
 * menulis `lastOtaUpdateId` dan `lastLoginAt` — dua kolom yang hanya ada di
 * `User`. Setiap login pelanggan karenanya melempar validasi Prisma dan route
 * menjawab 500: tidak satu pun pelanggan bisa membuka aplikasi mobile, dan
 * tidak ada yang merah sampai seseorang benar-benar mencoba login.
 *
 * TypeScript tidak bisa menjaga ini: hasil pemanggilan fungsi tidak kena
 * pemeriksaan properti berlebih, dan assignability struktural mengizinkan
 * medan tambahan. Jadi penjaganya mencocokkan kunci yang benar-benar dikirim
 * dengan daftar kolom yang digenerate Prisma dari skema.
 */

const MASUKAN = {
  versionCode: 42,
  versionName: "1.0.9",
  otaUpdateId: "update-abc",
};

const kolomPelanggan = new Set(Object.keys(Prisma.PelangganScalarFieldEnum));
const kolomUser = new Set(Object.keys(Prisma.UserScalarFieldEnum));

describe("medan pencatatan versi login mobile", () => {
  it("hanya menulis kolom yang benar-benar ada di Pelanggan", () => {
    const takDikenal = Object.keys(buildVersionUpdate(MASUKAN)).filter(
      (kunci) => !kolomPelanggan.has(kunci),
    );

    expect(takDikenal).toEqual([]);
  });

  // Medan bersama dipakai juga untuk `User`, jadi harus sah di sana juga.
  it("medan bersama juga sah untuk User", () => {
    const takDikenal = Object.keys(buildVersionUpdate(MASUKAN)).filter(
      (kunci) => !kolomUser.has(kunci),
    );

    expect(takDikenal).toEqual([]);
  });

  it("hanya menulis kolom yang benar-benar ada di User", () => {
    const takDikenal = Object.keys(buildVersionUpdatePengguna(MASUKAN)).filter(
      (kunci) => !kolomUser.has(kunci),
    );

    expect(takDikenal).toEqual([]);
  });

  // Jejak OTA & waktu login tetap tercatat untuk karyawan; tanpa penegasan ini
  // "perbaikan" termudah adalah membuang keduanya dari kedua model.
  it("tetap mencatat jejak OTA dan waktu login untuk User", () => {
    const medan = buildVersionUpdatePengguna(MASUKAN);

    expect(medan.lastOtaUpdateId).toBe("update-abc");
    expect(medan.lastLoginAt).toBeInstanceOf(Date);
    expect(medan.lastVersionCode).toBe(42);
  });
});
