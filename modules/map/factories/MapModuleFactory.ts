import { MappingRepository } from "../repositories/MappingRepository";
import { MappingAdminService } from "../services/MappingAdminService";
import { MappingService } from "../services/MappingService";

/** Create a mapping service with repository implementation. */
export function createMappingService(): MappingService {
  return new MappingService(new MappingRepository());
}

/** Create a mapping admin service with repository implementation. */
export function createMappingAdminService(): MappingAdminService {
  const repository = new MappingRepository();
  const mappingService = new MappingService(repository);
  return new MappingAdminService(repository, mappingService);
}
