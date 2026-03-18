// Public API for Map Module

// Services (public)
export { MappingService } from './services/MappingService'

// DTOs (public types for API responses and requests)
export type {
    MapNodeListItemDTO,
    MapNodeDetailDTO,
    MapEdgeDTO,
    MapStatisticsDTO,
    MapDataDTO,
    CreateMapNodeDTO,
    UpdateMapNodeDTO,
    CreateMapEdgeDTO,
} from './dto/MapDTO'

// NOTE: MappingRepository is intentionally NOT exported (internal implementation detail)
// NOTE: MapFactory and MapMapper are intentionally NOT exported (internal)
