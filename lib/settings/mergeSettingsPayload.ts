type SettingsPayload = Record<string, unknown>;

function isSettingsPayload(value: unknown): value is SettingsPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapPayload(payload: unknown): SettingsPayload {
  let unwrappedPayload = payload;

  while (
    isSettingsPayload(unwrappedPayload) &&
    isSettingsPayload(unwrappedPayload.data)
  ) {
    unwrappedPayload = unwrappedPayload.data;
  }

  return isSettingsPayload(unwrappedPayload) ? unwrappedPayload : {};
}

export function mergeSettingsPayload(
  generalPayload: unknown,
  logoPayload?: unknown,
): SettingsPayload {
  return {
    ...unwrapPayload(generalPayload),
    ...unwrapPayload(logoPayload),
  };
}
