import { getAcsSettings } from "@/modules/settings";

/** Build projection fields for ACS device listing. */
export function buildListProjection(
  settings: Awaited<ReturnType<typeof getAcsSettings>>,
) {
  return [
    "_id",
    "_deviceId._ProductClass",
    "_deviceId._SerialNumber",
    "_deviceId._Manufacturer",
    "_deviceId._OUI",
    "_tags",
    settings.vpPppoeUsername,
    settings.vpWanBridge,
    settings.vpRxPower,
    settings.vpTemperature,
    settings.vpActiveDevices,
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress",
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.2.ExternalIPAddress",
    "_lastInform",
  ];
}

/** Build projection fields for ACS device detail. */
export function buildDetailProjection(
  settings: Awaited<ReturnType<typeof getAcsSettings>>,
) {
  return [
    "_id",
    "_tags",
    "_deviceId._ProductClass",
    "_deviceId._SerialNumber",
    "_deviceId._Manufacturer",
    "_deviceId._OUI",
    settings.vpPppoeUsername,
    settings.vpWanBridge,
    settings.vpRxPower,
    settings.vpTemperature,
    settings.vpActiveDevices,
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.Enable",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.KeyPassphrase",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.KeyPassphrase",
    "InternetGatewayDevice.DeviceInfo.HardwareVersion",
    "InternetGatewayDevice.DeviceInfo.SoftwareVersion",
    "InternetGatewayDevice.DeviceInfo.UpTime",
    "InternetGatewayDevice.LANDevice.1.LANEthernetInterfaceConfig.1.MACAddress",
    "InternetGatewayDevice.WANDevice.1.WANEthernetInterfaceConfig.MACAddress",
    "InternetGatewayDevice.WANDevice",
    "_lastInform",
    "_lastBoot",
    "_registered",
    "InternetGatewayDevice.LANDevice.1.Hosts.Host",
  ];
}
