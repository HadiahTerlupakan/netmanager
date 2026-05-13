import { eventBus, EVENT_NAMES, JOB_PRIORITIES } from "@/lib/event-bus";

export class NetworkEventDispatcher {
  /**
   * Dipanggil ketika device network online.
   */
  static async onDeviceOnline(data: {
    deviceId: string;
    deviceName: string;
    deviceType: "mikrotik" | "radius";
    tenantId: string;
    stats?: Record<string, unknown>;
  }) {
    await eventBus.publish(EVENT_NAMES.NETWORK_DEVICE_ONLINE, {
      deviceId: data.deviceId,
      deviceName: data.deviceName,
      deviceType: data.deviceType,
      status: "online",
      tenantId: data.tenantId,
      stats: data.stats,
    });
  }

  /**
   * Dipanggil ketika device network offline.
   */
  static async onDeviceOffline(data: {
    deviceId: string;
    deviceName: string;
    deviceType: "mikrotik" | "radius";
    tenantId: string;
    stats?: Record<string, unknown>;
  }) {
    await eventBus.publish(
      EVENT_NAMES.NETWORK_DEVICE_OFFLINE,
      {
        deviceId: data.deviceId,
        deviceName: data.deviceName,
        deviceType: data.deviceType,
        status: "offline",
        tenantId: data.tenantId,
        stats: data.stats,
      },
      {
        priority: 2, // HIGH priority for device offline
      },
    );
  }

  /**
   * Dipanggil ketika ada update dari RADIUS.
   */
  static async onRadiusUpdate(data: {
    deviceId: string;
    deviceName: string;
    tenantId: string;
    stats?: Record<string, unknown>;
  }) {
    await eventBus.publish(EVENT_NAMES.NETWORK_RADIUS_UPDATE, {
      deviceId: data.deviceId,
      deviceName: data.deviceName,
      deviceType: "radius",
      status: "online",
      tenantId: data.tenantId,
      stats: data.stats,
    });
  }

  /**
   * Diemit saat admin update ProfilePPP. Handler akan bulk disconnect
   * semua pelanggan yang pakai profile tsb supaya re-auth dengan config baru.
   */
  static async onProfilePppUpdated(data: {
    profileId: string;
    profileName: string;
    bandwidthChanged: boolean;
    affectedCustomerCount: number;
    tenantId?: string;
  }) {
    await eventBus.publish(EVENT_NAMES.PROFILE_PPP_UPDATED, data, {
      priority: JOB_PRIORITIES.HIGH,
    });
  }
}
