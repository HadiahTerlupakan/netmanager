import type { CreateMapNodeDTO } from "../dto/MapDTO";
import {
  type CanonicalNodeType,
  NODE_TYPE_DEFAULTS,
  isCanonicalNodeType,
} from "../domain/nodeType";

export interface CreateMapNodeInput {
  nodeId: string;
  type: string;
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  capacity?: number;
  metadata?: Record<string, unknown> | null;
  siteId?: string | null;
}

export class MapFactory {
  static createFromDTO(dto: CreateMapNodeDTO): CreateMapNodeInput {
    const rawType = dto.type.toLowerCase();
    const canonicalType: CanonicalNodeType = isCanonicalNodeType(rawType)
      ? rawType
      : "ont";

    const defaults = NODE_TYPE_DEFAULTS[canonicalType];

    return {
      nodeId: dto.nodeId,
      type: canonicalType,
      name: dto.name,
      latitude: dto.latitude,
      longitude: dto.longitude,
      capacity: dto.capacity ?? defaults.capacity,
      metadata: this.buildMetadata(dto.metadata, defaults.usedPorts),
      siteId: dto.siteId ?? null,
    };
  }

  private static buildMetadata(
    base: Record<string, unknown> | null | undefined,
    usedPorts: number | null,
  ): Record<string, unknown> | null {
    if (usedPorts === null) {
      return base ?? null;
    }
    return { ...(base ?? {}), usedPorts };
  }
}
