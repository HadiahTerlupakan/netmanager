import { Button } from '@/components/ui/Button'
import type { MappingEdge, MappingNode } from '@prisma/client'
import { Popup, Polyline } from 'react-leaflet'

import { calculateMapDistance, getFiberColor } from '@/components/map/map-utils'

type FiberLineEdge = Pick<MappingEdge, 'edgeId' | 'source' | 'target' | 'fiberType' | 'waypoints'>
type FiberLineNode = Pick<MappingNode, 'nodeId' | 'name' | 'latitude' | 'longitude'>

type MapFiberLinesLayerProps = {
  edges: FiberLineEdge[]
  nodes: FiberLineNode[]
  onDeleteEdge: (edgeId: string) => void
}

export function MapFiberLinesLayer({ edges, nodes, onDeleteEdge }: MapFiberLinesLayerProps) {
  return (
    <>
      {edges.map((edge) => {
        const sourceNode = nodes.find((node) => node.nodeId === edge.source)
        const targetNode = nodes.find((node) => node.nodeId === edge.target)

        if (!sourceNode?.latitude || !sourceNode?.longitude || !targetNode?.latitude || !targetNode?.longitude) {
          return null
        }

        const waypoints = edge.waypoints ? (JSON.parse(edge.waypoints) as [number, number][]) : []
        const positions: [number, number][] = [
          [sourceNode.latitude, sourceNode.longitude],
          ...waypoints,
          [targetNode.latitude, targetNode.longitude],
        ]

        const totalDistance = calculateMapDistance(
          sourceNode.latitude,
          sourceNode.longitude,
          targetNode.latitude,
          targetNode.longitude,
          waypoints
        )

        return (
          <Polyline
            key={edge.edgeId}
            positions={positions}
            pathOptions={{
              color: getFiberColor(edge.fiberType),
              weight: 6,
              opacity: 0.9,
              dashArray: '10, 15',
              className: 'animated-polyline',
            }}
          >
            <Popup>
              <div className="min-w-[220px]">
                <h3 className="font-bold text-base border-b pb-2 mb-3">Fiber Line</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">From:</span>
                    <span className="font-medium">{sourceNode.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">To:</span>
                    <span className="font-medium">{targetNode.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Distance:</span>
                    <span className="font-medium">{totalDistance.toFixed(1)} m</span>
                  </div>
                </div>
                <Button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onDeleteEdge(edge.edgeId)
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                  }}
                  className="w-full mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Fiber Line
                </Button>
              </div>
            </Popup>
          </Polyline>
        )
      })}
    </>
  )
}
