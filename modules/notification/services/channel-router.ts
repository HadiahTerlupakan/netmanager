import { pelangganContactService } from "@/modules/pelanggan";

import type { IPelangganContactPort } from "../domain/ports/IPelangganContactPort";

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
  contactPort: IPelangganContactPort = pelangganContactService,
): Promise<CustomerContact | null> {
  const contact = await contactPort.findContactById(pelangganId);
  if (!contact) return null;

  return {
    userId: contact.userId,
    customerId: contact.customerId,
    customerName: contact.customerName,
    email: contact.email,
    noTelp: contact.noTelp,
    isBillNotifEnabled: contact.isBillNotifEnabled,
    tenantId: contact.tenantId,
  };
}
