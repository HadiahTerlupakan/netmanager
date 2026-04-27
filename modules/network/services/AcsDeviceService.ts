import axios from "axios";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { getAcsSettings } from "@/modules/settings";

const DEVICE_REQUEST_TIMEOUT_MS = 15_000;
const TASK_REQUEST_TIMEOUT_MS = 10_000;
const SUCCESS_TASK_STATUSES = new Set([200, 201, 202]);

type GenieAcsDevice = Record<string, unknown> & {
  _id?: string;
  _deviceId?: {
    _ProductClass?: string;
    _SerialNumber?: string;
    _Manufacturer?: string;
    _OUI?: string;
  };
  _tags?: unknown;
  _lastInform?: unknown;
};

export type AcsTaskInput = {
  taskName?: string;
  parameter?: string;
  value?: unknown;
  type?: string;
  connectionRequest?: boolean;
};

function normalizeDevicesUrl(url: string) {
  return url.trim().replace(/\/$/, "");
}

function normalizeTasksUrl(url: string) {
  const baseUrl = url.trim();
  if (baseUrl.endsWith("/devices") || baseUrl.endsWith("/devices/")) {
    return baseUrl.replace(/\/devices\/?$/, "/tasks");
  }
  return baseUrl.endsWith("/") ? `${baseUrl}tasks` : `${baseUrl}/tasks`;
}

function normalizeAcsRootUrl(url: string) {
  return url.trim().replace(/\/devices\/?$/, "");
}

function getNestedValue(obj: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return null;
    return (current as Record<string, unknown>)[part];
  }, obj) as { _value?: unknown } | null;
}

function getParameterValue(device: GenieAcsDevice, path: string) {
  return getNestedValue(device, path)?._value ?? null;
}

function buildListProjection(
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

function buildDetailProjection(
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

function buildDeviceQuery(
  tenantId: string | null,
  isSuperAdmin: boolean,
  deviceId?: string,
) {
  const query: Record<string, string> = deviceId ? { _id: deviceId } : {};
  if (!isSuperAdmin && tenantId) query._tags = `tenant:${tenantId}`;
  return query;
}

function formatDevice(
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

function formatDeviceDetail(
  deviceId: string,
  device: GenieAcsDevice,
  settings: Awaited<ReturnType<typeof getAcsSettings>>,
) {
  return {
    _id: deviceId,
    tags: Array.isArray(device._tags) ? device._tags : [],
    deviceInfo: {
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
    },
    connectionInfo: {
      lastInform: device._lastInform || null,
      lastBoot: (device as { _lastBoot?: unknown })._lastBoot || null,
      registered: (device as { _registered?: unknown })._registered || null,
    },
    virtualParameters: {
      rxPower: getParameterValue(device, settings.vpRxPower),
      temperature: getParameterValue(device, settings.vpTemperature),
      pppoeUsername: getParameterValue(device, settings.vpPppoeUsername),
      activeDevices: getParameterValue(device, settings.vpActiveDevices),
    },
    wifiInfo: {
      wlan1: {
        enabled: getParameterValue(
          device,
          "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable",
        ),
        ssid: getParameterValue(
          device,
          "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
        ),
        password:
          getParameterValue(
            device,
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase",
          ) ||
          getParameterValue(
            device,
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase",
          ),
      },
      wlan5: {
        enabled: getParameterValue(
          device,
          "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.Enable",
        ),
        ssid: getParameterValue(
          device,
          "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID",
        ),
        password:
          getParameterValue(
            device,
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.KeyPassphrase",
          ) ||
          getParameterValue(
            device,
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.KeyPassphrase",
          ),
      },
    },
  };
}

function buildWanTaskPayload(input: {
  deviceId: string;
  username: string;
  password?: string;
}) {
  const finalParamPath = "VirtualParameters.pppoeUsername2";
  const parameterValues = [[finalParamPath, input.username, "xsd:string"]];
  if (input.password) {
    parameterValues.push([
      "VirtualParameters.pppoePassword2",
      input.password,
      "xsd:string",
    ]);
  }
  return {
    name: "setParameterValues",
    device: input.deviceId,
    parameterValues,
  };
}

function buildTaskPayload(
  input: Required<Omit<AcsTaskInput, "connectionRequest">>,
  deviceId: string,
) {
  const payload: Record<string, unknown> = {
    name: input.taskName,
    device: deviceId,
  };

  if (input.taskName === "setParameterValues") {
    if (!input.parameter || input.value === undefined) {
      return { error: "Parameter dan value harus diisi" } as const;
    }
    payload.parameterValues = [[input.parameter, input.value, input.type]];
    return { payload } as const;
  }

  if (input.taskName === "addObject" || input.taskName === "deleteObject") {
    if (!input.parameter) return { error: "ObjectName harus diisi" } as const;
    payload.objectName = input.parameter;
  }

  return { payload } as const;
}

export class AcsDeviceService {
  /** Lists ACS devices with tenant isolation and configured virtual parameter mapping. */
  async listDevices() {
    const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
    const settings = await getAcsSettings();
    if (!settings.genieAcsUrl) {
      return {
        ok: false as const,
        message: "GenieACS URL belum dikonfigurasi di Pengaturan.",
      };
    }

    const query = buildDeviceQuery(tenantId, isSuperAdmin);
    const projection = buildListProjection(settings).join(",");
    const apiUrl = `${normalizeDevicesUrl(settings.genieAcsUrl)}?query=${encodeURIComponent(
      JSON.stringify(query),
    )}&projection=${encodeURIComponent(projection)}`;
    const response = await axios.get(apiUrl, {
      timeout: DEVICE_REQUEST_TIMEOUT_MS,
      headers: { Accept: "application/json" },
    });

    if (response.status !== 200 && response.status !== 201) {
      return {
        ok: false as const,
        message: `Gagal mengambil data dari GenieACS (Status: ${response.status})`,
      };
    }
    if (!Array.isArray(response.data)) {
      return {
        ok: false as const,
        message: "Format respon dari GenieACS tidak valid (bukan array)",
      };
    }

    const devices = response.data
      .map((device: GenieAcsDevice) => formatDevice(device, settings))
      .reverse();
    return { ok: true as const, data: { devices } };
  }

  /** Gets one ACS device detail with tenant isolation. */
  async getDeviceDetail(deviceId: string) {
    const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
    const settings = await getAcsSettings();
    if (!settings.genieAcsUrl) {
      return {
        ok: false as const,
        status: "error",
        message: "GenieACS URL belum dikonfigurasi di Pengaturan.",
      };
    }

    const query = buildDeviceQuery(tenantId, isSuperAdmin, deviceId);
    const projection = buildDetailProjection(settings).join(",");
    const apiUrl = `${normalizeDevicesUrl(settings.genieAcsUrl)}?query=${encodeURIComponent(
      JSON.stringify(query),
    )}&projection=${encodeURIComponent(projection)}`;
    const response = await axios.get(apiUrl, {
      timeout: DEVICE_REQUEST_TIMEOUT_MS,
      headers: { Accept: "application/json" },
    });

    if (!Array.isArray(response.data) || response.data.length === 0) {
      return {
        ok: false as const,
        status: "notFound",
        message: "Device tidak ditemukan di server GenieACS",
      };
    }

    return {
      ok: true as const,
      data: formatDeviceDetail(deviceId, response.data[0], settings),
    };
  }

  /** Sends a WAN configuration task to one ACS device. */
  async configureWan(input: {
    deviceId: string;
    username: string;
    password?: string;
  }) {
    const settings = await getAcsSettings();
    if (!settings.genieAcsUrl) {
      return {
        ok: false as const,
        status: "error",
        message: "GenieACS URL belum dikonfigurasi.",
      };
    }

    const response = await axios.post(
      normalizeTasksUrl(settings.genieAcsUrl),
      buildWanTaskPayload(input),
      {
        timeout: DEVICE_REQUEST_TIMEOUT_MS,
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!SUCCESS_TASK_STATUSES.has(response.status)) {
      return {
        ok: false as const,
        status: "error",
        message: `Gagal mengirim konfigurasi WAN (Status: ${response.status})`,
      };
    }

    return {
      ok: true as const,
      data: {
        message: "Konfigurasi WAN berhasil dikirim ke perangkat",
        taskId: response.data._id,
      },
    };
  }

  /** Sends a task to one ACS device. */
  async createTask(deviceId: string, input: AcsTaskInput) {
    const settings = await getAcsSettings();
    if (!settings.genieAcsUrl) {
      return {
        ok: false as const,
        status: "error",
        message: "GenieACS URL belum dikonfigurasi di Pengaturan.",
      };
    }

    const taskName = input.taskName || "setParameterValues";
    if (input.connectionRequest || taskName === "connection_request") {
      const summonUrl = `${normalizeAcsRootUrl(settings.genieAcsUrl)}/devices/${encodeURIComponent(
        deviceId,
      )}/tasks?connection_request`;
      await axios.post(summonUrl, null, { timeout: TASK_REQUEST_TIMEOUT_MS });
      return {
        ok: true as const,
        data: { message: "Perintah Summon berhasil dikirim" },
      };
    }

    const taskPayload = buildTaskPayload(
      {
        taskName,
        parameter: input.parameter || "",
        value: input.value,
        type: input.type || "string",
      },
      deviceId,
    );
    if ("error" in taskPayload) {
      return {
        ok: false as const,
        status: "badRequest",
        message: taskPayload.error,
      };
    }

    const response = await axios.post(
      normalizeTasksUrl(settings.genieAcsUrl),
      taskPayload.payload,
      {
        timeout: TASK_REQUEST_TIMEOUT_MS,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      },
    );

    if (!SUCCESS_TASK_STATUSES.has(response.status)) {
      return {
        ok: false as const,
        status: "error",
        message: `Gagal mengirim tugas (Status: ${response.status})`,
      };
    }

    return {
      ok: true as const,
      data: {
        message: `Task ${taskName} berhasil dikirim ke perangkat`,
        taskId: response.data._id,
      },
    };
  }
}
