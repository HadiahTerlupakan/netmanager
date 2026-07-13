import { randomUUID } from "crypto";
import { PurchaseRequestStatus, Prisma } from "@prisma/client";

type PrismaClientLike = Prisma.TransactionClient;

export class InventoryPurchaseRequestRepository {
  constructor(private readonly db: PrismaClientLike) {}

  /** Ambil daftar purchase request restock. */
  async findPurchaseRequests(input: {
    tenantId: string;
    status?: string | null;
  }) {
    const requests = await this.db.purchaseRequest.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.status
          ? { status: input.status as PurchaseRequestStatus }
          : {}),
      },
      include: {
        items: { include: { barang: true } },
        jasaItems: { include: { jasa: true } },
        requester: { select: { name: true } },
        approver: { select: { name: true } },
        gudang: { select: { nama: true, id: true } },
        purchaseOrder: { include: { items: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return requests.map((request) => ({
      ...request,
      items: request.items.map((item) => ({
        ...item,
        receivedQuantity:
          request.purchaseOrder?.items.find(
            (purchaseOrderItem) => purchaseOrderItem.barangId === item.barangId,
          )?.receivedQuantity || 0,
      })),
    }));
  }

  /** Ambil purchase request milik tenant tertentu. */
  async findPurchaseRequestById(input: { id: string; tenantId: string }) {
    return this.db.purchaseRequest.findUnique({
      where: { id: input.id, tenantId: input.tenantId },
    });
  }

  /** Perbarui item purchase request draft/submitted. */
  async updatePurchaseRequest(input: {
    id: string;
    tenantId: string;
    gudangId: string;
    keterangan?: string;
    items: Array<{
      barangId: string;
      quantity: number;
      keterangan?: string | null;
    }>;
    jasaItems?: Array<{
      jasaId: string;
      jumlah: number;
      hargaPerUnit?: number;
      keterangan?: string | null;
    }>;
  }) {
    return this.db.$transaction(async (tx) => {
      await tx.purchaseRequestItem.deleteMany({
        where: { purchaseRequestId: input.id },
      });
      await tx.purchaseRequestJasaItem.deleteMany({
        where: { purchaseRequestId: input.id },
      });
      const updated = await tx.purchaseRequest.update({
        where: { id: input.id },
        data: {
          gudangId: input.gudangId,
          keterangan: input.keterangan,
        },
      });

      if (input.items.length > 0) {
        await tx.purchaseRequestItem.createMany({
          data: input.items.map((item) => ({
            id: randomUUID(),
            purchaseRequestId: input.id,
            barangId: item.barangId,
            jumlah: item.quantity,
            keterangan: item.keterangan || null,
            hargaPerUnit: 0,
            totalHarga: 0,
            tenantId: input.tenantId,
          })),
        });
      }

      if (input.jasaItems && input.jasaItems.length > 0) {
        await tx.purchaseRequestJasaItem.createMany({
          data: input.jasaItems.map((item) => {
            const hargaPerUnit = Number(item.hargaPerUnit) || 0;
            return {
              id: randomUUID(),
              purchaseRequestId: input.id,
              jasaId: item.jasaId,
              jumlah: item.jumlah,
              hargaPerUnit,
              totalHarga: hargaPerUnit * item.jumlah,
              keterangan: item.keterangan || null,
              statusKonfirmasi: "PENDING",
              tenantId: input.tenantId,
            };
          }),
        });
      }

      return tx.purchaseRequest.findUnique({
        where: { id: updated.id },
        include: { items: true, jasaItems: { include: { jasa: true } } },
      });
    });
  }

  /** Hapus purchase request. */
  async deletePurchaseRequest(id: string) {
    await this.db.purchaseRequest.delete({ where: { id } });
  }

  /** Setujui purchase request sederhana untuk route approve. */
  async approvePurchaseRequest(input: { id: string; approverId: string }) {
    return this.db.purchaseRequest.update({
      where: { id: input.id },
      data: {
        status: "APPROVED",
        approvedBy: input.approverId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /** Ambil ringkasan purchase request untuk proses receive/start shopping. */
  async findPurchaseRequestProcessInfo(id: string, tenantId: string) {
    return this.db.purchaseRequest.findFirst({
      where: { id, tenantId },
      select: { purchaseOrderId: true, status: true },
    });
  }
}
