import type { DashboardSection } from "@/lib/dashboard/contracts";

export function createDashboardSection<T>(
  result: PromiseSettledResult<T>,
  errorMessage: string,
): DashboardSection<T> {
  if (result.status === "fulfilled") {
    return {
      state: "ready",
      data: result.value,
    };
  }

  const message =
    result.reason instanceof Error ? result.reason.message : errorMessage;
  return {
    state: "error",
    data: null,
    message,
  };
}
