import {
  createMappingAdminService,
  createMappingService,
} from "./createMappingService";
import type { MappingAdminService } from "./MappingAdminService";
import type { MappingService } from "./MappingService";

let mappingServiceInstance: MappingService | null = null;
let mappingAdminServiceInstance: MappingAdminService | null = null;

export function getMappingService(): MappingService {
  if (!mappingServiceInstance) {
    mappingServiceInstance = createMappingService();
  }

  return mappingServiceInstance;
}

export function getMappingAdminService(): MappingAdminService {
  if (!mappingAdminServiceInstance) {
    mappingAdminServiceInstance = createMappingAdminService();
  }

  return mappingAdminServiceInstance;
}
