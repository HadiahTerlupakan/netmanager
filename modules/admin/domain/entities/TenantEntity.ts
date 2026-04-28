export interface TenantEntity {
  id: string;
  name: string;
  domain: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
