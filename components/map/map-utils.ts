import { calculateHaversineDistance } from '@/lib/geo-utils'

type EdgeLike = {
  source: string
  target: string
}

export interface ConnectedDevices {
  connectedTo: string[]
  connectedFrom: string[]
  usedSlots: number
}

export const calculateMapDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  waypoints: [number, number][] = []
): number => {
  const allPoints: [number, number][] = [[lat1, lng1], ...waypoints, [lat2, lng2]]
  let total = 0

  for (let i = 0; i < allPoints.length - 1; i++) {
    total += calculateHaversineDistance(
      allPoints[i][0],
      allPoints[i][1],
      allPoints[i + 1][0],
      allPoints[i + 1][1]
    )
  }

  return Math.round(total * 10) / 10
}

export const generateMapId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

export const getFiberColor = (fiberType?: string | null) => {
  switch (fiberType) {
    case 'feeder':
    case 'odc_to_odc':
    case 'odc_to_odc_ratio':
      return '#c084fc'
    case 'distribution':
    case 'odp_to_odp':
      return '#60a5fa'
    case 'drop':
    case 'odp_to_odp_ratio':
      return '#4ade80'
    default:
      return '#9ca3af'
  }
}

export const determineFiberType = (sourceType: string, targetType: string): string => {
  if (
    sourceType === 'server' || sourceType === 'olt' ||
    targetType === 'server' || targetType === 'olt'
  ) {
    return 'feeder'
  }

  if (sourceType === 'ont' || targetType === 'ont') {
    return 'drop'
  }

  if (sourceType === 'odp' && targetType === 'odp') {
    return 'odp_to_odp'
  }

  return 'distribution'
}

export const getConnectedDevices = <TEdge extends EdgeLike>(nodeId: string, edges: TEdge[]): ConnectedDevices => {
  const connectedTo = edges
    .filter((edge) => edge.source === nodeId)
    .map((edge) => edge.target)
  const connectedFrom = edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => edge.source)

  return {
    connectedTo,
    connectedFrom,
    usedSlots: connectedTo.length,
  }
}
