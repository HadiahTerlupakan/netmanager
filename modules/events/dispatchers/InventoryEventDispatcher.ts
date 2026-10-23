import { eventBus, EVENT_NAMES } from '@/lib/event-bus';

export class InventoryEventDispatcher {
  /**
   * Dipanggil setelah stok barang masuk.
   */
  static async onStockIn(data: {
    barangId: string
    barangName?: string
    gudangId?: string | null
    jumlah: number
    totalStok?: number
    userId: string
    tenantId?: string
    siteId?: string
  }) {
    await eventBus.publish(EVENT_NAMES.INVENTORY_STOCK_IN, {
      type: 'masuk',
      barangId: data.barangId,
      barangName: data.barangName,
      gudangId: data.gudangId ?? undefined,
      jumlah: data.jumlah,
      totalStok: data.totalStok,
      userId: data.userId,
      tenantId: data.tenantId,
      siteId: data.siteId,
    });
  }

  /**
   * Dipanggil setelah stok barang keluar.
   */
  static async onStockOut(data: {
    barangId: string
    barangName?: string
    gudangId?: string | null
    jumlah: number
    totalStok?: number
    userId: string
    tenantId?: string
    siteId?: string
  }) {
    await eventBus.publish(EVENT_NAMES.INVENTORY_STOCK_OUT, {
      type: 'keluar',
      barangId: data.barangId,
      barangName: data.barangName,
      gudangId: data.gudangId ?? undefined,
      jumlah: data.jumlah,
      totalStok: data.totalStok,
      userId: data.userId,
      tenantId: data.tenantId,
      siteId: data.siteId,
    });
  }

  /**
   * Dipanggil ketika stok barang mencapai batas minimum.
   */
  static async onLowStock(data: {
    barangId: string
    barangName?: string
    gudangId?: string | null
    jumlah: number
    totalStok?: number
    userId: string
    tenantId?: string
    siteId?: string
  }) {
    await eventBus.publish(EVENT_NAMES.INVENTORY_LOW_STOCK, {
      type: 'keluar',
      barangId: data.barangId,
      barangName: data.barangName,
      gudangId: data.gudangId ?? undefined,
      jumlah: data.jumlah,
      totalStok: data.totalStok,
      userId: data.userId,
      tenantId: data.tenantId,
      siteId: data.siteId,
    }, {
      priority: 2, // HIGH priority for low stock alerts
    });
  }
}
