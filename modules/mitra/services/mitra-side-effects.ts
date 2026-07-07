import { logger } from "@/lib/logger";
import { socketEmitter } from "@/lib/websocket/emitter";

/** Broadcast mitra profile refresh to websocket clients safely. */
export function broadcastMitraProfileRefreshSafely(mitraId: string): void {
  try {
    socketEmitter.profileRefresh(mitraId);
  } catch (err) {
    logger.error(
      "Failed to broadcast mitra profile refresh",
      err instanceof Error ? err : undefined,
    );
  }
}
