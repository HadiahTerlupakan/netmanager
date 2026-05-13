import { prisma } from "@/lib/prisma";

export interface CustomerContact {
  userId: string | null;
  customerId: string;
  customerName: string;
  email: string | null;
  noTelp: string | null;
  isBillNotifEnabled: boolean;
  tenantId: string | null;
}

/** Resolve informasi kontak pelanggan untuk dispatch notifikasi. */
export async function resolveCustomerContact(
  pelangganId: string,
): Promise<CustomerContact | null> {
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
