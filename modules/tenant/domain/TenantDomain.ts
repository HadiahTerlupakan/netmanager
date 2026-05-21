export interface TenantDomain {
  id: string;
  tenantId: string;
  domain: string | null;
  slug: string;
  status: "pending" | "verified" | "active" | "failed";
  sslStatus: "pending" | "provisioning" | "active" | "failed";
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
