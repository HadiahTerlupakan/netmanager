export type { PrismaClient } from "@prisma/client";
export type {
  NetworkPerformanceCreateData,
  NetworkPerformanceEntity as NetworkPerformancePublic,
  NetworkPerformanceFilters,
  NetworkPerformanceUpdateData,
} from "../domain/entities/NetworkPerformanceEntity";
export type { INetworkPerformanceRepository } from "../domain/ports/INetworkPerformanceRepository";
