import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SUMMARY_SELECT = {
  id: true,
  mitraId: true,
  mitraName: true,
  createdByName: true,
  generatedAt: true,
  customerCount: true,
  invoiceCount: true,
  fromMonth: true,
  toMonth: true,
  createdAt: true,
} as const;

export type SampleInvoiceBatchSummary = Prisma.SampleInvoiceBatchGetPayload<{
  select: typeof SUMMARY_SELECT;
}>;

export class SampleInvoiceBatchRepository {
  create(data: Omit<Prisma.SampleInvoiceBatchUncheckedCreateInput, "id">) {
    return prisma.sampleInvoiceBatch.create({ data });
  }

  /** Daftar riwayat tanpa set contoh, yang bisa berisi ribuan invoice. */
  async list(filter: { mitraId?: string; page: number; limit: number }) {
    const where = filter.mitraId ? { mitraId: filter.mitraId } : {};
    const [items, total] = await Promise.all([
      prisma.sampleInvoiceBatch.findMany({
        where,
        select: SUMMARY_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      prisma.sampleInvoiceBatch.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string) {
    return prisma.sampleInvoiceBatch.findFirst({ where: { id } });
  }

  /** deleteMany, agar isolasi tenant ikut menyaring baris yang dihapus. */
  async delete(id: string) {
    await prisma.sampleInvoiceBatch.deleteMany({ where: { id } });
  }
}
