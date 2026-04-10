import { LEGACY_TO_REALTIME_EVENT } from "./channel-map";
import type { PresenceSnapshot, RealtimeEventType } from "./contracts";

export function matchesRealtimeEvent(
  legacyEvent: string,
  realtimeEventType: string,
): realtimeEventType is RealtimeEventType {
  return LEGACY_TO_REALTIME_EVENT[legacyEvent] === realtimeEventType;
}

export function extractOnlineUserIds(
  snapshots: Record<string, PresenceSnapshot | null | undefined>,
): string[] {
  return Object.values(snapshots)
    .filter((snapshot): snapshot is PresenceSnapshot =>
      Boolean(snapshot?.isOnline && snapshot.userId),
    )
    .map((snapshot) => snapshot.userId);
}
