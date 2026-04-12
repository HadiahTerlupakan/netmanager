import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRefresh = vi.fn();
const mockUseRealtimeEvent = vi.fn();
const mockUseRealtimeScope = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("@/lib/realtime/hooks/useRealtimeEvent", () => ({
  useRealtimeEvent: (...args: unknown[]) => mockUseRealtimeEvent(...args),
}));

vi.mock("@/lib/realtime/hooks/useRealtimeScope", () => ({
  useRealtimeScope: (...args: unknown[]) => mockUseRealtimeScope(...args),
}));

import { DashboardSocketUpdate } from "@/components/dashboard/DashboardSocketUpdate";

describe("DashboardSocketUpdate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T10:00:00.000Z"));
    mockRefresh.mockClear();
    mockUseRealtimeEvent.mockReset();
    mockUseRealtimeScope.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throttles repeated realtime refreshes", () => {
    let onUpdate: (() => void) | undefined;

    mockUseRealtimeEvent.mockImplementation(
      (event: string, handler: () => void) => {
        if (event === "mikrotik.update") {
          onUpdate = handler;
        }
      },
    );

    renderToStaticMarkup(<DashboardSocketUpdate />);

    onUpdate?.();
    onUpdate?.();
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-04-12T10:00:10.001Z"));
    onUpdate?.();
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });
});
