/**
 * MapMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type {
    MapNodeListItemDTO,
    MapNodeDetailDTO,
    MapEdgeDTO,
    MapStatisticsDTO,
} from '../dto/MapDTO'

// Types based on Prisma model
interface MapNode {
    id: string
    label: string
    type: string
    lat: number | null
    lng: number | null
    capacity: number | null
    usedPorts: number | null
    metadata: unknown
    createdAt: Date
    updatedAt: Date
}

interface MapEdge {
    id: string
    name: string | null
    sourceId: string
    targetId: string
    coreCount: number | null
    distance: number | null
    metadata: unknown
    source?: MapNode
    target?: MapNode
}

type MapNodeWithEdges = MapNode & {
    sourceEdges?: MapEdge[]
    targetEdges?: MapEdge[]
}

export class MapMapper {
    /**
     * Map to list item DTO
     */
    static toListItem(entity: MapNode): MapNodeListItemDTO {
        return {
            id: entity.id,
            label: entity.label,
            type: entity.type,
            lat: entity.lat,
            lng: entity.lng,
            capacity: entity.capacity,
            usedPorts: entity.usedPorts,
        }
    }

    /**
     * Map array to list items
     */
    static toListItems(entities: MapNode[]): MapNodeListItemDTO[] {
        return entities.map(entity => this.toListItem(entity))
    }

    /**
     * Map to detail DTO
     */
    static toDetail(entity: MapNodeWithEdges): MapNodeDetailDTO {
        const allEdges = [
            ...(entity.sourceEdges ?? []),
            ...(entity.targetEdges ?? []),
        ]

        return {
            id: entity.id,
            label: entity.label,
            type: entity.type,
            lat: entity.lat,
            lng: entity.lng,
            capacity: entity.capacity,
            usedPorts: entity.usedPorts,
            metadata: this.parseMetadata(entity.metadata),
            createdAt: entity.createdAt.toISOString(),
            updatedAt: entity.updatedAt.toISOString(),
            connectedEdges: allEdges.map(edge => this.edgeToDTO(edge)),
        }
    }

    /**
     * Map edge to DTO
     */
    static edgeToDTO(entity: MapEdge): MapEdgeDTO {
        return {
            id: entity.id,
            name: entity.name,
            sourceId: entity.sourceId,
            targetId: entity.targetId,
            sourceLabel: entity.source?.label ?? null,
            targetLabel: entity.target?.label ?? null,
            coreCount: entity.coreCount,
            distance: entity.distance,
            metadata: this.parseMetadata(entity.metadata),
        }
    }

    /**
     * Map edges to DTOs
     */
    static edgesToDTO(entities: MapEdge[]): MapEdgeDTO[] {
        return entities.map(entity => this.edgeToDTO(entity))
    }

    /**
     * Calculate statistics from nodes and edges
     */
    static toStatistics(nodes: MapNode[], edges: MapEdge[]): MapStatisticsDTO {
        // Group by type
        const typeCountMap = new Map<string, number>()
        let totalCapacity = 0
        let usedCapacity = 0

        for (const node of nodes) {
            const count = typeCountMap.get(node.type) ?? 0
            typeCountMap.set(node.type, count + 1)
            totalCapacity += node.capacity ?? 0
            usedCapacity += node.usedPorts ?? 0
        }

        const nodesByType = Array.from(typeCountMap.entries()).map(([type, count]) => ({
            type,
            count,
        }))

        const utilizationPercent = totalCapacity > 0
            ? Math.round((usedCapacity / totalCapacity) * 100 * 10) / 10
            : 0

        return {
            totalNodes: nodes.length,
            nodesByType,
            totalEdges: edges.length,
            totalCapacity,
            usedCapacity,
            utilizationPercent,
        }
    }

    // ==================== Private Helpers ====================

    private static parseMetadata(value: unknown): Record<string, unknown> | null {
        if (!value) return null
        if (typeof value === 'string') {
            try {
                return JSON.parse(value)
            } catch {
                return null
            }
        }
        return value as Record<string, unknown>
    }
}
