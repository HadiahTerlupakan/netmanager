const READABLE_TRANSACTION_TYPES = [
  "inventory-masuk",
  "inventory-keluar",
] as const;

type ReadableTransactionType = (typeof READABLE_TRANSACTION_TYPES)[number];

export type InventoryPhotoQuerySuccess = {
  transactionId: string;
  transactionType: ReadableTransactionType;
  message: string;
  note: string;
  expectedPhotoPattern: {
    inventoryMasuk: string;
    inventoryKeluar: string;
  };
};

export type InventoryPhotoQueryResult =
  | { ok: true; body: InventoryPhotoQuerySuccess }
  | { ok: false; status: number; body: { error: string } };

export class InventoryPhotoQueryService {
  /** Ambil metadata response foto inventory berdasarkan transaksi. */
  getTransactionPhotoInfo(input: {
    transactionId: string | null;
    transactionType: string | null;
  }): InventoryPhotoQueryResult {
    if (!input.transactionId) {
      return this.createError(400, "ID Transaksi wajib disertakan");
    }

    if (!this.isReadableTransactionType(input.transactionType)) {
      return this.createError(
        400,
        'Tipe transaksi harus "inventory-masuk" atau "inventory-keluar"',
      );
    }

    return {
      ok: true,
      body: {
        transactionId: input.transactionId,
        transactionType: input.transactionType,
        message:
          "Transaction found. Photo URLs would be returned here if stored in database.",
        note: "This endpoint can be extended to return uploaded photo URLs from a database table.",
        expectedPhotoPattern: {
          inventoryMasuk: `/uploads/inventory-masuk/[year]/[month]/${input.transactionId}_photo_[index].webp`,
          inventoryKeluar: `/uploads/inventory-keluar/[year]/[month]/${input.transactionId}_photo_[index].webp`,
        },
      },
    };
  }

  private isReadableTransactionType(
    transactionType: string | null,
  ): transactionType is ReadableTransactionType {
    return READABLE_TRANSACTION_TYPES.includes(
      transactionType as ReadableTransactionType,
    );
  }

  private createError(
    status: number,
    error: string,
  ): InventoryPhotoQueryResult {
    return { ok: false, status, body: { error } };
  }
}

export const inventoryPhotoQueryService = new InventoryPhotoQueryService();
