import {
  NetworkAlertRepository,
  NetworkPerformanceRepository,
} from "./repositories";
import { NetworkAlertService } from "./services/NetworkAlertService";
import { NetworkPerformanceService } from "./services/NetworkPerformanceService";

let networkAlertServiceInstance: NetworkAlertService | null = null;
let networkPerformanceServiceInstance: NetworkPerformanceService | null = null;

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

// Repositories
export * from "./repositories";
export * from "./repositories/MikroTikRouterRepository";
export * from "./repositories/RadiusRepository";
export * from "./repositories/IMikroTikRouterRepository";
export * from "./repositories/IRadiusRepository";
export type { NetworkAlertFilters } from "./domain/entities/NetworkAlertEntity";
export type { NetworkPerformanceFilters } from "./domain/entities/NetworkPerformanceEntity";

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
export * from "./services/AcsDeviceService";
export * from "./services/MobileTopologyService";
export * from "./services/DeviceBackupService";
export * from "./validators/device-backup";
export { RadiusDashboardService } from "./services/dashboard/RadiusDashboardService";
export type {
  RadiusDashboardStatsViewModel,
  RadiusRecentSessionViewModel,
  RadiusRecentSessionsViewModel,
} from "./services/dashboard/radius-dashboard.contracts";

// Validators
export * from "./validators/network-performance";
