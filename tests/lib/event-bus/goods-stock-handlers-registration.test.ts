import { describe, expect, it } from "vitest";

import {
  getEventHandlers,
  registerDefaultHandlers,
  type EventHandlerFn,
} from "@/lib/event-bus/event-handlers";
import { EVENT_NAMES } from "@/lib/event-bus/types";
import {
  handleGoodsReceiptCreatedAccounting,
  handleGoodsReturnSentAccounting,
} from "@/modules/accounting";
import * as inventoryModule from "@/modules/inventory";
import { handleGoodsReceiptCreatedTax } from "@/modules/tax";

/**
 * Stok GRN dan retur ditulis di transaksi repository procurement
 * (`GoodsReceiptRepository.createAndPost` menaikkan stok dan menulis
 * barang_masuk; `GoodsReturnRepository.createAndSend` menurunkan stok dan
 * menulis barang_keluar). Handler stok untuk event yang diterbitkan sesudah
 * transaksi itu menggandakan stok setiap kali worker event berjalan, jadi
 * aturan ini dijaga untuk handler apa pun yang didaftarkan, bukan hanya
 * handler lama yang sudah dihapus.
 */
const STOCK_WRITTEN_IN_TRANSACTION_EVENTS = [
  EVENT_NAMES.GOODS_RECEIPT_CREATED,
  EVENT_NAMES.GOODS_RETURN_SENT,
];

/** Nama yang menandai handler stok, di modul mana pun ia ditulis. */
const STOCK_HANDLER_NAME = /inventory|stock|stok/i;

const inventoryExports = new Set<unknown>(Object.values(inventoryModule));

/** Handler yang menulis stok: berasal dari modul inventory, atau bernama stok. */
function isStockHandler(handler: EventHandlerFn): boolean {
  return inventoryExports.has(handler) || STOCK_HANDLER_NAME.test(handler.name);
}

describe("handler event GRN dan retur barang", () => {
  registerDefaultHandlers();

  it.each(STOCK_WRITTEN_IN_TRANSACTION_EVENTS)(
    "%s tidak punya handler stok",
    (eventName) => {
      const stockHandlers = getEventHandlers(eventName)
        .filter(isStockHandler)
        .map((handler) => handler.name);

      expect(stockHandlers).toEqual([]);
    },
  );

  it("jurnal akuntansi dan PPN tetap mendengar event GRN dan retur", () => {
    expect(getEventHandlers(EVENT_NAMES.GOODS_RECEIPT_CREATED)).toEqual(
      expect.arrayContaining([
        handleGoodsReceiptCreatedAccounting,
        handleGoodsReceiptCreatedTax,
      ]),
    );
    expect(getEventHandlers(EVENT_NAMES.GOODS_RETURN_SENT)).toContain(
      handleGoodsReturnSentAccounting,
    );
  });
});
