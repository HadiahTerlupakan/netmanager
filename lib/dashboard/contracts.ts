export type DashboardSectionState = "ready" | "error";

export interface DashboardSection<T> {
  state: DashboardSectionState;
  data: T | null;
  message?: string;
}
