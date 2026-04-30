import type {
  NetworkAlertEntity,
  NetworkPerformanceEntity,
} from "../domain/entities";
import type { NetworkAlertDTO, NetworkPerformanceDTO } from "../dto/NetworkDTO";

/** Ubah entity alert ke DTO API. */
export function toNetworkAlertDTO(entity: NetworkAlertEntity): NetworkAlertDTO {
  const resolutionMetadata = mapResolutionMetadata(entity);

  return {
    id: entity.id,
    deviceId: entity.deviceId,
    deviceType: entity.deviceType,
    alertType: entity.alertType,
    title: entity.title,
    message: entity.message,
    severity: entity.severity,
    status: entity.status,
    threshold: entity.threshold ?? null,
    currentValue: entity.currentValue ?? null,
    metricName: entity.metricName ?? null,
    acknowledged: entity.acknowledged,
    acknowledgedBy: resolutionMetadata.acknowledgedBy,
    acknowledgedAt: resolutionMetadata.acknowledgedAt,
    resolved: entity.resolved,
    resolvedBy: resolutionMetadata.resolvedBy,
    resolvedAt: resolutionMetadata.resolvedAt,
    autoResolve: entity.autoResolve,
    autoResolveTime: entity.autoResolveTime ?? null,
    isActive: entity.isActive,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

function mapResolutionMetadata(entity: NetworkAlertEntity) {
  return {
    acknowledgedBy: entity.acknowledgedBy ?? null,
    acknowledgedAt: entity.acknowledgedAt?.toISOString() ?? null,
    resolvedBy: entity.resolvedBy ?? null,
    resolvedAt: entity.resolvedAt?.toISOString() ?? null,
  };
}

/** Ubah banyak entity alert ke DTO API. */
export function toNetworkAlertDTOList(
  entities: NetworkAlertEntity[],
): NetworkAlertDTO[] {
  return entities.map(toNetworkAlertDTO);
}

/** Ubah entity performa ke DTO API. */
export function toNetworkPerformanceDTO(
  entity: NetworkPerformanceEntity,
): NetworkPerformanceDTO {
  return {
    id: entity.id,
    deviceId: entity.deviceId,
    deviceType: entity.deviceType,
    timestamp: entity.timestamp.toISOString(),
    cpuUsage: entity.cpuUsage ?? null,
    memoryUsage: entity.memoryUsage ?? null,
    temperature: entity.temperature ?? null,
    uptime: toNullableNumber(entity.uptime),
    rxBytes: toNullableNumber(entity.rxBytes),
    txBytes: toNullableNumber(entity.txBytes),
    rxPackets: toNullableNumber(entity.rxPackets),
    txPackets: toNullableNumber(entity.txPackets),
    rxDrops: toNullableNumber(entity.rxDrops),
    txDrops: toNullableNumber(entity.txDrops),
    rxErrors: toNullableNumber(entity.rxErrors),
    txErrors: toNullableNumber(entity.txErrors),
    interfaceStatus: entity.interfaceStatus ?? null,
    connectionCount: entity.connectionCount ?? null,
    bandwidthUsage: entity.bandwidthUsage ?? null,
    signalStrength: entity.signalStrength ?? null,
    powerLevel: entity.powerLevel ?? null,
    customMetrics: entity.customMetrics ?? null,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

/** Ubah banyak entity performa ke DTO API. */
export function toNetworkPerformanceDTOList(
  entities: NetworkPerformanceEntity[],
): NetworkPerformanceDTO[] {
  return entities.map(toNetworkPerformanceDTO);
}

/** Ubah bigint nullable ke number nullable. */
function toNullableNumber(value?: bigint | null): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  return Number(value);
}
