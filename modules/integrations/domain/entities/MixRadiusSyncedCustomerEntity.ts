export interface MixRadiusSyncedCustomerEntity {
  id: string;
  mixRadiusId: string;
  tenantId: string;
  username: string;
  fullName: string | null;
  address: string | null;
  phoneNumber: string | null;
  planName: string | null;
  ownerName: string | null;
  status: string | null;
  expiredOn: Date | null;
  lastSyncedAt: Date;
}
