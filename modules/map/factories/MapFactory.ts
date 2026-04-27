/**
 * MapFactory
 *
 * Factory pattern for creating map node payloads.
 */

import type { CreateMapNodeDTO } from "../dto/MapDTO";
import {
  CUSTOMER_DEFAULT_CAPACITY,
  FULL_USED_PORTS,
  INITIAL_USED_PORTS,
  ODC_DEFAULT_CAPACITY,
  ODP_DEFAULT_CAPACITY,
  OLT_DEFAULT_CAPACITY,
} from "../utils/mapConstants";

export interface CreateMapNodeInput {
  nodeId: string;
  type: string;
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  capacity?: number;
  metadata?: Record<string, unknown> | null;
}

export class MapFactory {
  /** Create ODP node payload. */
  static createODP(dto: CreateMapNodeDTO): CreateMapNodeInput {
    return {
      nodeId: dto.nodeId,
      name: dto.name,
      type: "odp",
      latitude: dto.latitude,
      longitude: dto.longitude,
      capacity: dto.capacity ?? ODP_DEFAULT_CAPACITY,
      metadata: this.withUsedPorts(dto.metadata, INITIAL_USED_PORTS),
    };
  }

  /** Create ODC node payload. */
  static createODC(dto: CreateMapNodeDTO): CreateMapNodeInput {
    return {
      nodeId: dto.nodeId,
      name: dto.name,
      type: "odc",
      latitude: dto.latitude,
      longitude: dto.longitude,
      capacity: dto.capacity ?? ODC_DEFAULT_CAPACITY,
      metadata: this.withUsedPorts(dto.metadata, INITIAL_USED_PORTS),
    };
  }

  /** Create OLT node payload. */
  static createOLT(dto: CreateMapNodeDTO): CreateMapNodeInput {
    return {
      nodeId: dto.nodeId,
      name: dto.name,
      type: "olt",
      latitude: dto.latitude,
      longitude: dto.longitude,
      capacity: dto.capacity ?? OLT_DEFAULT_CAPACITY,
      metadata: this.withUsedPorts(dto.metadata, INITIAL_USED_PORTS),
    };
  }

  /** Create pole node payload. */
  static createPole(dto: CreateMapNodeDTO): CreateMapNodeInput {
    return {
      nodeId: dto.nodeId,
      name: dto.name,
      type: "pole",
      latitude: dto.latitude,
      longitude: dto.longitude,
      capacity: 0,
      metadata: dto.metadata ?? null,
    };
  }

  /** Create customer node payload. */
  static createCustomer(dto: CreateMapNodeDTO): CreateMapNodeInput {
    return {
      nodeId: dto.nodeId,
      name: dto.name,
      type: "customer",
      latitude: dto.latitude,
      longitude: dto.longitude,
      capacity: CUSTOMER_DEFAULT_CAPACITY,
      metadata: this.withUsedPorts(dto.metadata, FULL_USED_PORTS),
    };
  }

  /** Create node payload from generic DTO. */
  static createFromDTO(dto: CreateMapNodeDTO): CreateMapNodeInput {
    switch (dto.type.toLowerCase()) {
      case "odp":
        return this.createODP(dto);
      case "odc":
        return this.createODC(dto);
      case "olt":
        return this.createOLT(dto);
      case "pole":
        return this.createPole(dto);
      case "customer":
        return this.createCustomer(dto);
      default:
        return {
          nodeId: dto.nodeId,
          name: dto.name,
          type: dto.type,
          latitude: dto.latitude,
          longitude: dto.longitude,
          capacity: dto.capacity,
          metadata: dto.metadata ?? null,
        };
    }
  }

  /** Attach used ports into metadata safely. */
  private static withUsedPorts(
    metadata: Record<string, unknown> | null | undefined,
    usedPorts: number,
  ): Record<string, unknown> {
    return {
      ...(metadata ?? {}),
      usedPorts,
    };
  }
}
