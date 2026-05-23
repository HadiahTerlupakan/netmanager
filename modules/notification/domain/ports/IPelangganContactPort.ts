export interface PelangganContactSnapshot {
  userId: string | null;
  customerId: string;
  customerName: string;
  email: string | null;
  noTelp: string | null;
  isBillNotifEnabled: boolean;
  tenantId: string | null;
}

export interface IPelangganContactPort {
  findContactById(
    pelangganId: string,
  ): Promise<PelangganContactSnapshot | null>;
}
