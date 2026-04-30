export type AcsTaskInput = {
  taskName?: string;
  parameter?: string;
  value?: unknown;
  type?: string;
  connectionRequest?: boolean;
};

/** Normalize GenieACS devices endpoint URL. */
export function normalizeDevicesUrl(url: string) {
  return url.trim().replace(/\/$/, "");
}

/** Normalize GenieACS tasks endpoint URL. */
export function normalizeTasksUrl(url: string) {
  const baseUrl = url.trim();
  if (baseUrl.endsWith("/devices") || baseUrl.endsWith("/devices/")) {
    return baseUrl.replace(/\/devices\/?$/, "/tasks");
  }

  return baseUrl.endsWith("/") ? `${baseUrl}tasks` : `${baseUrl}/tasks`;
}

/** Normalize GenieACS root URL. */
export function normalizeAcsRootUrl(url: string) {
  return url.trim().replace(/\/devices\/?$/, "");
}

/** Build tenant-aware ACS query. */
export function buildDeviceQuery(
  tenantId: string | null,
  isSuperAdmin: boolean,
  deviceId?: string,
) {
  const query: Record<string, string> = deviceId ? { _id: deviceId } : {};
  if (!isSuperAdmin && tenantId) {
    query._tags = `tenant:${tenantId}`;
  }

  return query;
}

/** Build WAN configuration task payload. */
export function buildWanTaskPayload(input: {
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

/** Build generic ACS task payload. */
export function buildTaskPayload(
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
    if (!input.parameter) {
      return { error: "ObjectName harus diisi" } as const;
    }

    payload.objectName = input.parameter;
  }

  return { payload } as const;
}
