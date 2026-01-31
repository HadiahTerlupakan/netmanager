/**
 * MapFactory
 *
 * Factory pattern for creating Map nodes with different types.
 */

import type { CreateMapNodeDTO } from '../dto/MapDTO'

export interface CreateMapNodeInput {
    label: string
    type: string
    lat?: number
    lng?: number
    capacity?: number
    usedPorts?: number
    metadata?: Record<string, unknown>
}

export class MapFactory {
    /**
     * Create ODP (Optical Distribution Point) node
     */
    static createODP(dto: {
        label: string
        lat?: number
        lng?: number
        capacity?: number
    }): CreateMapNodeInput {
        return {
            label: dto.label,
            type: 'ODP',
            lat: dto.lat,
            lng: dto.lng,
            capacity: dto.capacity ?? 8, // Default 8 ports
            usedPorts: 0,
            metadata: {
                nodeType: 'distribution',
            },
        }
    }

    /**
     * Create ODC (Optical Distribution Cabinet) node
     */
    static createODC(dto: {
        label: string
        lat?: number
        lng?: number
        capacity?: number
    }): CreateMapNodeInput {
        return {
            label: dto.label,
            type: 'ODC',
            lat: dto.lat,
            lng: dto.lng,
            capacity: dto.capacity ?? 96, // Default 96 cores
            usedPorts: 0,
            metadata: {
                nodeType: 'cabinet',
            },
        }
    }

    /**
     * Create OLT (Optical Line Terminal) node
     */
    static createOLT(dto: {
        label: string
        lat?: number
        lng?: number
        capacity?: number
    }): CreateMapNodeInput {
        return {
            label: dto.label,
            type: 'OLT',
            lat: dto.lat,
            lng: dto.lng,
            capacity: dto.capacity ?? 128,
            usedPorts: 0,
            metadata: {
                nodeType: 'terminal',
            },
        }
    }

    /**
     * Create Pole node
     */
    static createPole(dto: {
        label: string
        lat?: number
        lng?: number
    }): CreateMapNodeInput {
        return {
            label: dto.label,
            type: 'POLE',
            lat: dto.lat,
            lng: dto.lng,
            capacity: null,
            usedPorts: null,
            metadata: {
                nodeType: 'infrastructure',
            },
        }
    }

    /**
     * Create Customer node
     */
    static createCustomer(dto: {
        label: string
        lat?: number
        lng?: number
        pelangganId?: string
    }): CreateMapNodeInput {
        return {
            label: dto.label,
            type: 'CUSTOMER',
            lat: dto.lat,
            lng: dto.lng,
            capacity: 1,
            usedPorts: 1,
            metadata: {
                nodeType: 'endpoint',
                pelangganId: dto.pelangganId,
            },
        }
    }

    /**
     * Create node from generic DTO
     */
    static createFromDTO(dto: CreateMapNodeDTO): CreateMapNodeInput {
        switch (dto.type.toUpperCase()) {
            case 'ODP':
                return this.createODP(dto)
            case 'ODC':
                return this.createODC(dto)
            case 'OLT':
                return this.createOLT(dto)
            case 'POLE':
                return this.createPole(dto)
            case 'CUSTOMER':
                return this.createCustomer(dto)
            default:
                return {
                    label: dto.label,
                    type: dto.type,
                    lat: dto.lat,
                    lng: dto.lng,
                    capacity: dto.capacity,
                    usedPorts: 0,
                    metadata: dto.metadata,
                }
        }
    }
}
