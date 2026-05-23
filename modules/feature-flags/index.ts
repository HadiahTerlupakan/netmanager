import { FeatureFlagService } from "./services/FeatureFlagService";

export { FeatureFlagService } from "./services/FeatureFlagService";
export type {
  FeatureFlagDTO,
  TenantFeatureFlagsResponseDTO,
  AdminFeatureFlagListItemDTO,
} from "./dto/FeatureFlagDTO";
export {
  featureFlagUpdateSchema,
  featureFlagBatchUpdateSchema,
  type FeatureFlagUpdateInput,
  type FeatureFlagBatchUpdateInput,
} from "./validators/feature-flag";
export type {
  IFeatureFlagRepository,
  TenantFeatureFlagRow,
} from "./domain/ports/IFeatureFlagRepository";

let _featureFlagService: FeatureFlagService | null = null;

/** Singleton accessor. Pakai untuk konsumen yang tidak butuh DI custom. */
export function getFeatureFlagService(): FeatureFlagService {
  if (!_featureFlagService) {
    _featureFlagService = new FeatureFlagService();
  }
  return _featureFlagService;
}
