import { randomUUID } from "crypto";
import { prismaAuth } from "@/lib/prisma";

const FULL_RADIUS_MODE_KEY = "FULL_RADIUS_MODE";

/**
 * Setting global yang menentukan apakah jalur accel-ppp / pure RADIUS
 * boleh digunakan oleh aplikasi.
 *
 * Why: dipakai sebagai single switch untuk memutus jalur accel-ppp tanpa
 * menghapus data server yang sudah teregistrasi.
 *
 * **Storage scope**: system-wide dengan `tenantId = null`. Karena itu read
 * dan write keduanya pakai `prismaAuth` (base client tanpa tenant
 * isolation extension). Jika dipakai `prisma` yang sudah di-extend,
 * tenant context request akan meng-inject `tenantId = user.tenantId`
 * sehingga row tersimpan per-tenant—dan read tanpa tenant context akan
 * gagal match.
 *
 * How to apply: panggil `getFullRadiusMode()` dari middleware/route guard
 * sebelum memproses request modul accel-ppp; gunakan `setFullRadiusMode()`
 * dari halaman pengaturan untuk toggle.
 */
export async function getFullRadiusMode(): Promise<boolean> {
  const row = await prismaAuth.settings.findFirst({
    where: { key: FULL_RADIUS_MODE_KEY, tenantId: null },
    select: { value: true },
  });
  return row?.value === "true";
}

/** Set Full RADIUS Mode toggle. Disimpan sebagai string "true"|"false". */
export async function setFullRadiusMode(enabled: boolean): Promise<void> {
  const value = enabled ? "true" : "false";
  const now = new Date();
  const existing = await prismaAuth.settings.findFirst({
    where: { key: FULL_RADIUS_MODE_KEY, tenantId: null },
    select: { id: true },
  });

  if (existing) {
    await prismaAuth.settings.update({
      where: { id: existing.id },
      data: { value, updatedAt: now },
    });
    return;
  }

  await prismaAuth.settings.create({
    data: {
      id: randomUUID(),
      key: FULL_RADIUS_MODE_KEY,
      value,
      description: "Toggle global untuk jalur accel-ppp pure RADIUS",
      encrypted: false,
      tenantId: null,
      updatedAt: now,
    },
  });
}

export { FULL_RADIUS_MODE_KEY };
