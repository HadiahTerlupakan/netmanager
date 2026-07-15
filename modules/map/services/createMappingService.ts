import { getUserService } from "@/modules/users";
import { MappingRepository } from "../repositories/MappingRepository";
import { MappingAdminService } from "./MappingAdminService";
import { MappingService } from "./MappingService";
import { MapCsvImportService } from "./MapCsvImportService";

export function createMappingService(): MappingService {
  return new MappingService(new MappingRepository());
}

export function createMappingAdminService(): MappingAdminService {
  const repository = new MappingRepository();
  const mappingService = new MappingService(repository);
  return new MappingAdminService(repository, mappingService, getUserService());
}

export function createMapCsvImportService(): MapCsvImportService {
  return new MapCsvImportService(new MappingRepository());
}
