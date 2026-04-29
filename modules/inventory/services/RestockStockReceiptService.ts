import { Prisma } from "@prisma/client";
import { RestockAssetCreationService } from "./RestockAssetCreationService";

const DEFAULT_RECEIVED_QUANTITY = 0;

type TransactionClient = Prisma.TransactionClient;

interface PurchaseOrderItemReceiptInput {
  item: {
    id: string;
    barangId: string;
    unitPrice: number;
    receivedQuantity: number | null;
    barang: {
      nama: string;
      jenis: string;
      kategoriAset: string | null;
      kode: string;
    };
  };
  purchaseOrderId: string;
  actorId: string;
  fotoBukti: string[];
  poNumber: string;
  receivedItems: Record<string, number>;
}

export class RestockStockReceiptService {
  private readonly assetCreationService = new RestockAssetCreationService();

  /** Proses penerimaan satu item PO ke stok gudang. */
  async processPurchaseOrderItem(
    transaction: TransactionClient,
    input: PurchaseOrderItemReceiptInput,
  ) {
    const receivedQuantity = this.getReceivedQuantity(
      input.receivedItems,
      input.item.id,
      input.item.barangId,
    );
    if (receivedQuantity < 0) {
      throw new Error(
        `Jumlah diterima untuk ${input.item.barang.nama} tidak boleh negatif`,
      );
    }
    await this.updatePurchaseOrderItemReceipt(
      transaction,
      input.item.id,
      input.item.receivedQuantity,
      receivedQuantity,
    );
    if (receivedQuantity <= 0) return;
    await this.receiveStockInWarehouse(transaction, input, receivedQuantity);
  }

  private getReceivedQuantity(
    receivedItems: Record<string, number>,
    itemId: string,
    barangId: string,
  ) {
    if (receivedItems[barangId] !== undefined) return receivedItems[barangId];
    if (receivedItems[itemId] !== undefined) return receivedItems[itemId];
    return DEFAULT_RECEIVED_QUANTITY;
  }

  private updatePurchaseOrderItemReceipt(
    transaction: TransactionClient,
    itemId: string,
    currentReceivedQuantity: number | null,
    receivedQuantity: number,
  ) {
    return transaction.purchaseOrderItem.update({
      where: { id: itemId },
      data: {
        receivedQuantity:
          (currentReceivedQuantity || DEFAULT_RECEIVED_QUANTITY) +
          receivedQuantity,
      },
    });
  }

  private async receiveStockInWarehouse(
    transaction: TransactionClient,
    input: PurchaseOrderItemReceiptInput,
    receivedQuantity: number,
  ) {
    const targetGudangId = await this.findTargetGudangId(
      transaction,
      input.purchaseOrderId,
    );
    const stockInTimestamp = new Date();
    await this.upsertWarehouseStock(transaction, {
      barangId: input.item.barangId,
      gudangId: targetGudangId,
      quantity: receivedQuantity,
      timestamp: stockInTimestamp,
    });
    const stockInRecord = await this.createStockInRecord(transaction, {
      barangId: input.item.barangId,
      gudangId: targetGudangId,
      quantity: receivedQuantity,
      unitPrice: input.item.unitPrice,
      poNumber: input.poNumber,
      actorId: input.actorId,
      fotoBukti: input.fotoBukti,
      timestamp: stockInTimestamp,
    });
    if (input.item.barang.jenis !== "ASET") return;
    await this.assetCreationService.createAssetsForStockIn(transaction, {
      barangId: input.item.barangId,
      barangKode: input.item.barang.kode,
      kategoriAset: input.item.barang.kategoriAset,
      unitPrice: input.item.unitPrice,
      quantity: receivedQuantity,
      location: stockInRecord.gudang?.nama || "Gudang Utama",
      timestamp: stockInTimestamp,
    });
  }

  private async findTargetGudangId(
    transaction: TransactionClient,
    purchaseOrderId: string,
  ) {
    const linkedPurchaseRequest = await transaction.purchaseRequest.findFirst({
      where: { purchaseOrderId },
      select: { gudangId: true },
    });
    if (linkedPurchaseRequest?.gudangId) return linkedPurchaseRequest.gudangId;
    const activeWarehouse = await transaction.gudang.findFirst({
      where: { isActive: true },
    });
    if (!activeWarehouse?.id) {
      throw new Error(
        "Tidak ada Gudang yang tersedia untuk menyimpan barang. Harap buat Gudang terlebih dahulu.",
      );
    }
    return activeWarehouse.id;
  }

  private upsertWarehouseStock(
    transaction: TransactionClient,
    input: {
      barangId: string;
      gudangId: string;
      quantity: number;
      timestamp: Date;
    },
  ) {
    return transaction.barangGudang.upsert({
      where: {
        barangId_gudangId: {
          barangId: input.barangId,
          gudangId: input.gudangId,
        },
      },
      create: {
        id: crypto.randomUUID(),
        barangId: input.barangId,
        gudangId: input.gudangId,
        stok: input.quantity,
        stokBaru: input.quantity,
        stokBekas: 0,
        stokRusak: 0,
        updatedAt: input.timestamp,
        createdAt: input.timestamp,
      },
      update: {
        stok: { increment: input.quantity },
        stokBaru: { increment: input.quantity },
        updatedAt: input.timestamp,
      },
    });
  }

  private createStockInRecord(
    transaction: TransactionClient,
    input: {
      barangId: string;
      gudangId: string;
      quantity: number;
      unitPrice: number;
      poNumber: string;
      actorId: string;
      fotoBukti: string[];
      timestamp: Date;
    },
  ) {
    return transaction.barangMasuk.create({
      data: {
        id: crypto.randomUUID(),
        barangId: input.barangId,
        gudangId: input.gudangId,
        jumlah: input.quantity,
        hargaBeliSatuan: input.unitPrice,
        tanggal: input.timestamp,
        keterangan: `Penerimaan dari PO #${input.poNumber} (Revisi/Partial)`,
        kondisi: "BARU",
        userId: input.actorId,
        fotoBukti: input.fotoBukti,
      },
      include: { barang: true, gudang: true },
    });
  }
}
