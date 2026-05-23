// Public API for Network Module

export type {
  CreateHargaPaketDTO,
  CreateRouterDTO,
  HargaPaketDetailDTO,
  HargaPaketListItemDTO,
  HargaPaketOptionDTO,
  NetworkAlertDTO,
  NetworkPerformanceDTO,
  OdpDetailDTO,
  OdpListItemDTO,
  OdpOptionDTO,
  OdpOutputDTO,
  RouterDetailDTO,
  RouterListItemDTO,
  RouterOptionDTO,
} from "./dto/NetworkDTO";

export * from "./services/RadiusAdminService";
export * from "./services/RadiusMonitor";
export * from "./services/radius-sync-service";
export * from "./services/MikroTikPPPSecretService";
export { createMikroTikPPPSecretService } from "./services/createMikroTikPPPSecretService";
export * from "./services/snmp-optimized";
export * from "./services/HargaPaketService";
export * from "./services/MikroTikProvisioningService";
export * from "./services/MikroTikRouterService";
export * from "./services/AcsDeviceService";
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
export type { MikroTikRouterStatistics } from "./services/mikrotikStatistics.types";
export { createRadiusDashboardService } from "./services/createRadiusDashboardService";
export * from "./services/radius-runtime.helpers";
export * from "./services/snmpService";
export { RadiusDashboardService } from "./services/dashboard/RadiusDashboardService";
export type {
  RadiusDashboardStatsInput,
  RadiusDashboardStatsViewModel,
  RadiusRecentSessionViewModel,
  RadiusRecentSessionsInput,
  RadiusRecentSessionsViewModel,
} from "./services/dashboard/radius-dashboard.contracts";
export {
  acsTaskSchema,
  acsWanConfigSchema,
  configurationRestoreCreateSchema,
  configurationRestoreQuerySchema,
  configurationRestoreUpdateSchema,
  deviceBackupCreateSchema,
  deviceBackupQuerySchema,
  deviceBackupUpdateSchema,
  networkAlertCreateSchema,
  networkAlertQuerySchema,
  networkAlertUpdateSchema,
  networkPerformanceCreateSchema,
  networkPerformanceQuerySchema,
} from "./validation";
export * from "./domain/errors/RouterErrors";
export * from "./domain/errors/AccelPppErrors";

// Accel-PPP module — Public API
export type {
  AccelPppServerCreateData,
  AccelPppServerEntity,
  AccelPppServerFilters,
  AccelPppServerStatusUpdate,
  AccelPppServerUpdateData,
} from "./domain/entities/AccelPppServerEntity";
export type { IAccelPppServerRepository } from "./domain/ports/IAccelPppServerRepository";
export {
  accelPppServerCreateSchema,
  accelPppServerUpdateSchema,
  accelPppServerIdParamSchema,
  accelPppKickParamSchema,
  accelPppServerListQuerySchema,
} from "./validators/accelPppServer";
export type {
  AccelPppServerCreateInput,
  AccelPppServerUpdateInput,
  AccelPppServerListQuery,
} from "./validators/accelPppServer";
export { AccelPppCliClient } from "./services/accel-ppp/AccelPppCliClient";
export type { AccelPppCliClientOptions } from "./services/accel-ppp/AccelPppCliClient";
export { AccelPppServerService } from "./services/accel-ppp/AccelPppServerService";
export type {
  AccelPppCliClientFactory,
  KickResult,
} from "./services/accel-ppp/AccelPppServerService";
export type {
  AccelPppSessionDTO,
  AccelPppStatDTO,
} from "./services/accel-ppp/parsers";
export { AccelPppMonitor } from "./services/accel-ppp/AccelPppMonitor";
export type {
  AccelPppMonitorCliFactory,
  AccelPppMonitorRunResult,
} from "./services/accel-ppp/AccelPppMonitor";

// Event handlers — exposed via public API supaya lib/event-bus tidak
// import path internal services/.
export { handleCustomerStatusEvent } from "./services/event-handlers/customer-status.handler";
export { handlePackageChange } from "./services/event-handlers/package-change.handler";
export { handleProfilePppUpdated } from "./services/event-handlers/profile-ppp-updated.handler";
