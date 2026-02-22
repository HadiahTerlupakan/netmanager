import { prismaBilling } from '@/lib/prisma-billing';
import type { Pelanggan } from '@prisma/client';

export class BillingEventDispatcher {
  /**
   * Hook ini dipanggil setelah Pelanggan baru dibuat di database utama.
   * Mensinkronisasikan data dasar ke database billing jika snapshot diaktifkan kelak,
   * atau bisa digunakan untuk auto-generate invoice pertama.
   */
  static async onCustomerCreated(customer: Pelanggan) {
    console.log(`[Hook] Pelanggan baru dibuat: ${customer.id}`);
    // Di sini kita bisa menambahkan logika auto-create invoice
    // menggunakan prismaBilling
  }

  /**
   * Hook ini dipanggil setelah status Invoice berubah menjadi PAID
   * Berguna untuk memberitahu DB Utama (Radius) agar membuka blokir internet
   */
  static async onInvoicePaid(invoiceId: string, pelangganId: string) {
    console.log(`[Hook] Invoice LUNAS: ${invoiceId} untuk pelanggan ${pelangganId}`);
    
    // Import DB utama secara dinamis jika diperlukan
    const { prisma } = await import('@/lib/prisma');
    
    try {
      // Buka blokir pelanggan di DB Utama / Radius
      await prisma.pelanggan.update({
        where: { id: pelangganId },
        data: {
          status: 'AKTIF'
        }
      });
      console.log(`[Hook] Status pelanggan ${pelangganId} berhasil diubah menjadi AKTIF di DB Utama`);
    } catch (error) {
      console.error(`[Hook] Gagal mengubah status pelanggan di DB Utama:`, error);
      // Di sini kita bisa mengimplementasikan Outbox Pattern
      // untuk retry (mengulang) jika DB Utama sedang down.
    }
  }
}
