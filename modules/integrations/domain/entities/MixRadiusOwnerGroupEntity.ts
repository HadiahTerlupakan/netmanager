export interface MixRadiusOwnerGroupEntity {
  id: string;
  name: string;
  owners: string[];
  siteId: string | null;
  isActive: boolean;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
