import { AcsDeviceService } from "./AcsDeviceService";

let acsDeviceServiceInstance: AcsDeviceService | null = null;

/** Ambil singleton service ACS device. */
export function getAcsDeviceService(): AcsDeviceService {
  if (!acsDeviceServiceInstance) {
    acsDeviceServiceInstance = new AcsDeviceService();
  }

  return acsDeviceServiceInstance;
}
