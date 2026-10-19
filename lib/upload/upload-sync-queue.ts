import { prisma } from "@/lib/prisma";

/** Berkas yang tersimpan di volume lokal tetapi belum berhasil masuk R2. */
export interface UploadTertunda {
  key: string;
  contentType: string;
}

export async function tandaiTertunda(
  key: string,
  contentType: string,
): Promise<void> {
  await prisma.uploadSyncPending.upsert({
    where: { key },
    create: { key, contentType },
    update: { contentType },
  });
}

/** Yang paling jarang dicoba lebih dulu, supaya satu berkas rusak tidak menyumbat antrean. */
export async function ambilTertunda(batas: number): Promise<UploadTertunda[]> {
  return prisma.uploadSyncPending.findMany({
    select: { key: true, contentType: true },
    orderBy: [{ attempts: "asc" }, { createdAt: "asc" }],
    take: batas,
  });
}

export async function hapusTertunda(key: string): Promise<void> {
  await prisma.uploadSyncPending.deleteMany({ where: { key } });
}

export async function catatGagalSinkron(
  key: string,
  pesan: string,
): Promise<void> {
  await prisma.uploadSyncPending.update({
    where: { key },
    data: {
      attempts: { increment: 1 },
      lastError: pesan.slice(0, 500),
      lastAttemptAt: new Date(),
    },
  });
}
