import { getAcsSettings } from "@/modules/settings";
import type { GenieAcsDevice } from "./AcsDeviceService.types";

function getNestedValue(obj: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return null;
    return (current as Record<string, unknown>)[part];
  }, obj) as { _value?: unknown } | null;
}

/** Ambil nilai parameter GenieACS dari jalur nested. */
export function getParameterValue(device: GenieAcsDevice, path: string) {
  return getNestedValue(device, path)?._value ?? null;
}

/** Bentuk payload device ringkas untuk daftar ACS. */
export function formatDeviceSummary(
  device: GenieAcsDevice,
  settings: Awaited<ReturnType<typeof getAcsSettings>>,
) {
  const ip1 = getParameterValue(
    device,
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress",
  );
  const ip2 = getParameterValue(
    device,
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress",
  );
  const ip3 = getParameterValue(
    device,
    "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.2.ExternalIPAddress",
  );

  return {
    id: device._id || null,
    serialNumber: device._deviceId?._SerialNumber || null,
    productClass: device._deviceId?._ProductClass || null,
    manufacturer: device._deviceId?._Manufacturer || null,
    tags: Array.isArray(device._tags) ? device._tags : [],
    pppoe: getParameterValue(device, settings.vpPppoeUsername),
    wanbridge: getParameterValue(device, settings.vpWanBridge),
    rxpower: getParameterValue(device, settings.vpRxPower),
    temperature: getParameterValue(device, settings.vpTemperature),
    activeDevices: getParameterValue(device, settings.vpActiveDevices),
    ssid: getParameterValue(
      device,
      "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
    ),
    ipAddress: ip1 || ip2 || ip3 || "-",
    lastInform: device._lastInform || null,
  };
}

function buildDeviceInfo(
  device: GenieAcsDevice,
  settings: Awaited<ReturnType<typeof getAcsSettings>>,
) {
  return {
    productClass: device._deviceId?._ProductClass || null,
    serialNumber: device._deviceId?._SerialNumber || null,
    manufacturer: device._deviceId?._Manufacturer || null,
    oui: device._deviceId?._OUI || null,
    hardwareVersion: getParameterValue(
      device,
      "InternetGatewayDevice.DeviceInfo.HardwareVersion",
    ),
    softwareVersion: getParameterValue(
      device,
      "InternetGatewayDevice.DeviceInfo.SoftwareVersion",
    ),
    upTime: getParameterValue(
      device,
      "InternetGatewayDevice.DeviceInfo.UpTime",
    ),
    macAddress:
      getParameterValue(
        device,
        "InternetGatewayDevice.LANDevice.1.LANEthernetInterfaceConfig.1.MACAddress",
      ) ||
      getParameterValue(
        device,
        "InternetGatewayDevice.WANDevice.1.WANEthernetInterfaceConfig.MACAddress",
      ),
    rxPower: getParameterValue(device, settings.vpRxPower),
  };
}

function buildWifiInfo(device: GenieAcsDevice) {
  return {
    wlan1: buildWifiBandInfo(device, "1"),
    wlan5: buildWifiBandInfo(device, "5"),
  };
}

function buildWifiBandInfo(device: GenieAcsDevice, bandIndex: string) {
  const basePath = `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${bandIndex}`;

  return {
    enabled: getParameterValue(device, `${basePath}.Enable`),
    ssid: getParameterValue(device, `${basePath}.SSID`),
    password: resolveWifiPassword(device, basePath),
  };
}

function resolveWifiPassword(device: GenieAcsDevice, basePath: string) {
  return (
    getParameterValue(device, `${basePath}.KeyPassphrase`) ||
    getParameterValue(device, `${basePath}.PreSharedKey.1.KeyPassphrase`)
  );
}

/** Bentuk payload device detail untuk endpoint ACS. */
export function formatDeviceDetailPayload(
  deviceId: string,
  device: GenieAcsDevice,
  settings: Awaited<ReturnType<typeof getAcsSettings>>,
) {
  const deviceInfo = buildDeviceInfo(device, settings);

  return {
    _id: deviceId,
    tags: Array.isArray(device._tags) ? device._tags : [],
    deviceInfo: {
      productClass: deviceInfo.productClass,
      serialNumber: deviceInfo.serialNumber,
      manufacturer: deviceInfo.manufacturer,
      oui: deviceInfo.oui,
      hardwareVersion: deviceInfo.hardwareVersion,
      softwareVersion: deviceInfo.softwareVersion,
      upTime: deviceInfo.upTime,
      macAddress: deviceInfo.macAddress,
    },
    connectionInfo: {
      lastInform: device._lastInform || null,
      lastBoot: device._lastBoot || null,
      registered: device._registered || null,
    },
    virtualParameters: {
      rxPower: deviceInfo.rxPower,
      temperature: getParameterValue(device, settings.vpTemperature),
      pppoeUsername: getParameterValue(device, settings.vpPppoeUsername),
      activeDevices: getParameterValue(device, settings.vpActiveDevices),
    },
    wifiInfo: buildWifiInfo(device),
    connectedHosts: buildConnectedHosts(device),
  };
}

function buildConnectedHosts(device: GenieAcsDevice) {
  const hostsObj = getNestedValue(
    device,
    "InternetGatewayDevice.LANDevice.1.Hosts.Host",
  ) as Record<string, unknown> | null;
  if (!hostsObj || typeof hostsObj !== "object") return [];

  return Object.entries(hostsObj)
    .filter(([key]) => /^\d+$/.test(key))
    .map(([, host]) => {
      const h = host as Record<string, { _value?: unknown }> | null;
      if (!h) return null;
      return {
        hostName: (h.HostName?._value as string) || null,
        ipAddress: (h.IPAddress?._value as string) || null,
        macAddress: (h.MACAddress?._value as string) || null,
        interfaceType: (h.InterfaceType?._value as string) || null,
        active: h.Active?._value ?? null,
      };
    })
    .filter(Boolean);
}
