import { firebaseRealtimeService } from "@/lib/realtime";

export type LocationRealtimePayload = {
  latitude: number;
  longitude: number;
  heading?: number | null;
  isMoving?: boolean;
  batteryLevel?: number | null;
  recordedAt?: Date;
  accuracy?: number | null;
  speed?: number | null;
};

export class LocationRealtimePublisher {
  /** Publish lokasi terbaru ke realtime channel tenant. */
  async publishLocationUpdate(
    userId: string,
    tenantId: string | null | undefined,
    payload: LocationRealtimePayload,
  ): Promise<void> {
    if (!tenantId) return;

    await firebaseRealtimeService.publish({
      type: "admin.location.update",
      scope: { kind: "admin", id: `location:${tenantId}` },
      payload: {
        userId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        heading: payload.heading,
        isMoving: payload.isMoving ?? false,
        batteryLevel: payload.batteryLevel,
        recordedAt: payload.recordedAt ?? new Date(),
        accuracy: payload.accuracy,
        speed: payload.speed,
      },
    });
  }
}
