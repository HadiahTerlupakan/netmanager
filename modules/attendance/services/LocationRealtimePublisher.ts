import { firebaseRealtimeService } from "@/lib/realtime";

export class LocationRealtimePublisher {
  /**
   * Beri tahu live map bahwa lokasi user berubah. Koordinat sengaja tidak ikut:
   * aturan Firestore tidak bisa menegakkan izin `live_tracking:read` maupun
   * batas site/departemen, sedangkan `/api/admin/location/live` bisa. Peta
   * mengambil posisinya dari sana.
   */
  async publishLocationUpdate(
    userId: string,
    tenantId: string | null | undefined,
    recordedAt: Date,
  ): Promise<void> {
    if (!tenantId) return;

    await firebaseRealtimeService.publish({
      type: "admin.location.update",
      scope: { kind: "admin", id: `location:${tenantId}` },
      tenantId,
      payload: { userId, recordedAt },
    });
  }
}
