export interface MixRadiusConfigEntity {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  username: string;
  password: string;
  isDefault: boolean;
  lastSyncedAt: Date | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}
