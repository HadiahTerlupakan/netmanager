import axios from "axios";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { getAcsSettings } from "@/modules/settings";
import {
  formatDeviceDetailPayload,
  formatDeviceSummary,
} from "./AcsDeviceService.formatters";
import {
  buildDetailProjection,
  buildListProjection,
} from "./AcsDeviceService.projections";
import {
  type AcsTaskInput,
  buildDeviceQuery,
  buildTaskPayload,
  buildWanTaskPayload,
  normalizeAcsRootUrl,
  normalizeDevicesUrl,
  normalizeTasksUrl,
} from "./AcsDeviceService.tasks";

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
      .map((device: GenieAcsDevice) => formatDeviceSummary(device, settings))
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
      data: formatDeviceDetailPayload(deviceId, response.data[0], settings),
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
