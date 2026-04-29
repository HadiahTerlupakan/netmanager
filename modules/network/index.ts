import {
  NetworkAlertRepository,
  NetworkPerformanceRepository,
} from "./repositories";
import { NetworkAlertService } from "./services/NetworkAlertService";
import { NetworkPerformanceService } from "./services/NetworkPerformanceService";

let networkAlertServiceInstance: NetworkAlertService | null = null;
let networkPerformanceServiceInstance: NetworkPerformanceService | null = null;
let acsDeviceServiceInstance:
  | import("./services/AcsDeviceService").AcsDeviceService
  | null = null;

/** Ambil singleton service alert jaringan. */
export function getNetworkAlertService(): NetworkAlertService {
  if (!networkAlertServiceInstance) {
    networkAlertServiceInstance = new NetworkAlertService(
      new NetworkAlertRepository(),
    );
  }

  return networkAlertServiceInstance;
}

/** Ambil singleton service performa jaringan. */
export function getNetworkPerformanceService(): NetworkPerformanceService {
  if (!networkPerformanceServiceInstance) {
    networkPerformanceServiceInstance = new NetworkPerformanceService(
      new NetworkPerformanceRepository(),
    );
  }

  return networkPerformanceServiceInstance;
}

/** Ambil singleton ACS device service tanpa eager import saat build. */
export async function getAcsDeviceService() {
  if (!acsDeviceServiceInstance) {
    const { AcsDeviceService } = await import("./services/AcsDeviceService");
    acsDeviceServiceInstance = new AcsDeviceService();
  }

  return acsDeviceServiceInstance;
}

// Services
export * from "./services/RadiusAdminService";
export * from "./services/RadiusMonitor";
export * from "./services/radius-sync-service";
export * from "./services/MikroTikPPPSecretService";
export * from "./services/snmp-optimized";
export * from "./services/HargaPaketService";
export * from "./services/MikroTikProvisioningService";
export * from "./services/MikroTikRouterService";
export * from "./services/ProfilePPPService";
export * from "./services/BandwidthRouteService";
export * from "./services/HealthCheckRouteService";
export * from "./services/OdpRouteService";
export * from "./services/RouterReconfigureRouteService";
export * from "./services/mikrotik-ping-check";
export * from "./services/mikrotik-ppp-profile";
export * from "./services/NetworkPerformanceService";
export * from "./services/NetworkAlertService";
export * from "./services/MobileTopologyService";
export * from "./services/DeviceBackupService";
export * from "./services/MikroTikStatisticsService";
export type { MikroTikRouterStatistics } from "./domain/entities/MikroTikRouterEntity";
export { RadiusDashboardService } from "./services/dashboard/RadiusDashboardService";
export type {
  RadiusDashboardStatsViewModel,
  RadiusRecentSessionViewModel,
  RadiusRecentSessionsViewModel,
} from "./services/dashboard/radius-dashboard.contracts";
export type { NetworkPerformanceFilters } from "./domain/entities/NetworkPerformanceEntity";
export {
  configurationRestoreCreateSchema,
  configurationRestoreQuerySchema,
  configurationRestoreUpdateSchema,
  deviceBackupCreateSchema,
  deviceBackupQuerySchema,
  deviceBackupUpdateSchema,
} from "./validators/device-backup";
export {
  networkAlertCreateSchema,
  networkAlertQuerySchema,
  networkAlertUpdateSchema,
  networkPerformanceCreateSchema,
  networkPerformanceQuerySchema,
} from "./validators/network-performance";
