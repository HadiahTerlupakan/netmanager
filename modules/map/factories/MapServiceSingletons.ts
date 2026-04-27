import {
  createMappingAdminService,
  createMappingService,
} from "./MapModuleFactory";
import type { MappingAdminService } from "../services/MappingAdminService";
import type { MappingService } from "../services/MappingService";

let mappingServiceInstance: MappingService | null = null;
let mappingAdminServiceInstance: MappingAdminService | null = null;

/** Get shared mapping service instance. */
export function getMappingService(): MappingService {
  if (!mappingServiceInstance) {
    mappingServiceInstance = createMappingService();
  }

  return mappingServiceInstance;
}

/** Get shared mapping admin service instance. */
export function getMappingAdminService(): MappingAdminService {
  if (!mappingAdminServiceInstance) {
    mappingAdminServiceInstance = createMappingAdminService();
  }

  return mappingAdminServiceInstance;
}
