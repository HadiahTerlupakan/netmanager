import { prismaMitra } from "@/lib/prisma-mitra";

export type MitraOption = { id: string; name: string };

/**
 * Mitra untuk form invoice contoh, lewat client mitra yang terisolasi
 * tenant. Tidak memakai /api/admin/mitra: route itu butuh izin mitra:read dan
 * dibatasi 100 baris, padahal modul ini cukup dengan izin invoice_contoh.
 */
export function listMitraOptions(): Promise<MitraOption[]> {
  return prismaMitra.mitra.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export function findMitraOption(id: string): Promise<MitraOption | null> {
  return prismaMitra.mitra.findFirst({
    where: { id },
    select: { id: true, name: true },
  });
}
