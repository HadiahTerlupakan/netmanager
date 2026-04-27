import type { DashboardSection } from "./contracts";

/** Maps settled dashboard loaders into a stable dashboard section shape. */
export function mapDashboardSectionResult<T>(
  result: PromiseSettledResult<T>,
  fallbackMessage: string,
): DashboardSection<T> {
  if (result.status === "fulfilled") {
    return {
      state: "ready",
      data: result.value,
    };
  }

  return {
    state: "error",
    data: null,
    message:
      result.reason instanceof Error ? result.reason.message : fallbackMessage,
  };
}
