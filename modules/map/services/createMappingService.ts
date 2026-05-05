import { MappingRepository } from "../repositories/MappingRepository";
import { MappingAdminService } from "./MappingAdminService";
import { MappingService } from "./MappingService";

export function createMappingService(): MappingService {
  return new MappingService(new MappingRepository());
}

export function createMappingAdminService(): MappingAdminService {
  const repository = new MappingRepository();
  const mappingService = new MappingService(repository);
  return new MappingAdminService(repository, mappingService);
}
