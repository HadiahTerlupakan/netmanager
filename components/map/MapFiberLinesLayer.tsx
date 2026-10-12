import type { MappingEdge, MappingNode } from "@prisma/client";

import { Button } from "@/components/ui/Button";

import { JalurUniversal } from "./JalurUniversal";
import { calculateMapDistance } from "./map-utils";

type FiberLineEdge = Pick<
  MappingEdge,
  "edgeId" | "source" | "target" | "fiberType" | "waypoints"
>;
type FiberLineNode = Pick<
  MappingNode,
  "nodeId" | "name" | "latitude" | "longitude"
>;

type MapFiberLinesLayerProps = {
  edges: FiberLineEdge[];
  nodes: FiberLineNode[];
  onDeleteEdge: (edgeId: string) => void;
};

const BOBOT_JALUR = 6;
const OPASITAS_JALUR = 0.9;

/**
 * Seluruh kabel terpasang di peta jaringan.
 *
 * Jalurnya digambar lewat `JalurUniversal`, jadi lapisan ini tidak tahu
 * mesin peta mana yang sedang dipakai — sama seperti penanda di sekitarnya.
 */
export function MapFiberLinesLayer({
  edges,
  nodes,
  onDeleteEdge,
}: MapFiberLinesLayerProps) {
  return (
    <>
      {edges.map((edge) => {
        const sourceNode = nodes.find((node) => node.nodeId === edge.source);
        const targetNode = nodes.find((node) => node.nodeId === edge.target);

        if (
          !sourceNode?.latitude ||
          !sourceNode?.longitude ||
          !targetNode?.latitude ||
          !targetNode?.longitude
        ) {
          return null;
        }

        const waypoints = edge.waypoints
          ? (JSON.parse(edge.waypoints) as [number, number][])
          : [];

        const totalDistance = calculateMapDistance(
          sourceNode.latitude,
          sourceNode.longitude,
          targetNode.latitude,
          targetNode.longitude,
          waypoints,
        );

        return (
          <JalurUniversal
            key={edge.edgeId}
            jejak={[
              { lat: sourceNode.latitude, lng: sourceNode.longitude },
              ...waypoints.map(([lat, lng]) => ({ lat, lng })),
              { lat: targetNode.latitude, lng: targetNode.longitude },
            ]}
            fiberType={edge.fiberType}
            bobot={BOBOT_JALUR}
            opasitas={OPASITAS_JALUR}
            putus
            animasi
            popup={
              <div className="min-w-[220px]">
                <h3 className="mb-3 border-b pb-2 text-base font-bold">
                  Fiber Line
                </h3>
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
                    <span className="font-medium">
                      {totalDistance.toFixed(1)} m
                    </span>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  className="mt-4 w-full"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDeleteEdge(edge.edgeId);
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                >
                  Delete Fiber Line
                </Button>
              </div>
            }
          />
        );
      })}
    </>
  );
}
