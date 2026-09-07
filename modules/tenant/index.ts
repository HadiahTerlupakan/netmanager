export { TenantDomainService } from "./services/TenantDomainService";
export { DnsVerificationService } from "./services/DnsVerificationService";
export { K8sCertificateService } from "./services/K8sCertificateService";
export { K8sIngressRouteService } from "./services/K8sIngressRouteService";
export {
  buildSlugCandidate,
  buildSlugVariant,
  isReservedSlug,
  TENANT_SLUG_PATTERN,
} from "./services/tenant-slug";
export type { TenantDomain } from "./domain/TenantDomain";
export type {
  TenantDomainResponseDto,
  CreateTenantDomainDto,
  UpdateDomainDto,
} from "./dto/tenant-domain.dto";

export {
  createTenantDomainSchema,
  updateDomainSchema,
} from "./validators/tenant-domain.validator";
