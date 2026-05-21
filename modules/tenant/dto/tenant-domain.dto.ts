export interface CreateTenantDomainDto {
  tenantId: string;
  slug: string;
  domain?: string;
}

export interface UpdateDomainDto {
  domain: string;
}

export interface TenantDomainResponseDto {
  id: string;
  tenantId: string;
  tenantName: string;
  domain: string | null;
  slug: string;
  status: string;
  sslStatus: string;
  verifiedAt: string | null;
  cnameTarget: string;
  subdomain: string;
}
