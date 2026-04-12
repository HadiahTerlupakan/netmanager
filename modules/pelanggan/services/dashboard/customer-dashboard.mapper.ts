import type { DashboardSection } from "@/lib/dashboard/contracts";

export function mapDashboardSection<T>(
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
