import { prisma } from "@/lib/prisma";

export interface PelangganContactSnapshot {
  userId: string | null;
  customerId: string;
  customerName: string;
  email: string | null;
  noTelp: string | null;
  isBillNotifEnabled: boolean;
  tenantId: string | null;
}

/**
 * Adapter untuk port `IPelangganContactPort` modul notification.
 *
 * Why: modul notification tidak boleh akses tabel pelanggan langsung.
 * Adapter ini diekspos via `modules/pelanggan/index.ts` agar konsumen
 * eksternal (notification dispatcher) tetap melewati public boundary.
 */
export class PelangganContactService {
  async findContactById(
    pelangganId: string,
  ): Promise<PelangganContactSnapshot | null> {
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      select: {
        id: true,
        nama: true,
        userId: true,
        email: true,
        noTelp: true,
        isBillNotifEnabled: true,
        tenantId: true,
      },
    });

    if (!pelanggan) return null;

    return {
      userId: pelanggan.userId,
      customerId: pelanggan.id,
      customerName: pelanggan.nama,
      email: pelanggan.email,
      noTelp: pelanggan.noTelp,
      isBillNotifEnabled: pelanggan.isBillNotifEnabled,
      tenantId: pelanggan.tenantId,
    };
  }
}

export const pelangganContactService = new PelangganContactService();
