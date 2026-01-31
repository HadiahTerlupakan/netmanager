/**
 * Map DTOs (Data Transfer Objects)
 */

// ==================== Response DTOs ====================

/**
 * DTO for map node list views
 */
export interface MapNodeListItemDTO {
    id: string
    label: string
    type: string
    lat: number | null
    lng: number | null
    capacity: number | null
    usedPorts: number | null
}

/**
 * DTO for map node detail views
 */
export interface MapNodeDetailDTO {
    id: string
    label: string
    type: string
    lat: number | null
    lng: number | null
    capacity: number | null
    usedPorts: number | null
    metadata: Record<string, unknown> | null
    createdAt: string
    updatedAt: string
    connectedEdges: MapEdgeDTO[]
}

/**
 * DTO for map edge
 */
export interface MapEdgeDTO {
    id: string
    name: string | null
    sourceId: string
    targetId: string
    sourceLabel: string | null
    targetLabel: string | null
    coreCount: number | null
    distance: number | null
    metadata: Record<string, unknown> | null
}

/**
 * DTO for map statistics
 */
export interface MapStatisticsDTO {
    totalNodes: number
    nodesByType: {
        type: string
        count: number
    }[]
    totalEdges: number
    totalCapacity: number
    usedCapacity: number
    utilizationPercent: number
}

/**
 * DTO for full map data
 */
export interface MapDataDTO {
    nodes: MapNodeListItemDTO[]
    edges: MapEdgeDTO[]
    statistics: MapStatisticsDTO
}

// ==================== Request DTOs ====================

/**
 * DTO for creating map node
 */
export interface CreateMapNodeDTO {
    label: string
    type: string
    lat?: number
    lng?: number
    capacity?: number
    metadata?: Record<string, unknown>
}

/**
 * DTO for updating map node
 */
export interface UpdateMapNodeDTO {
    label?: string
    type?: string
    lat?: number
    lng?: number
    capacity?: number
    usedPorts?: number
    metadata?: Record<string, unknown>
}

/**
 * DTO for creating map edge
 */
export interface CreateMapEdgeDTO {
    name?: string
    sourceId: string
    targetId: string
    coreCount?: number
    distance?: number
    metadata?: Record<string, unknown>
}
