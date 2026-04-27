import { getRetryQueueStats } from "./PushRetryQueue";

export class AdminNotificationMonitoringRouteService {
  /** Get retry queue statistics for admin monitoring route. */
  async getPushRetryQueueStats() {
    return getRetryQueueStats();
  }
}
