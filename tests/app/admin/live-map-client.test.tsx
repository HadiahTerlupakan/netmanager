import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type UseStateTuple<T> = [T, (value: T | ((previous: T) => T)) => void];

const mockUseState = vi.fn(
  (initialValue: unknown): UseStateTuple<unknown> => [initialValue, vi.fn()],
);
const mockUseEffect = vi.fn();
const mockUseCallback = vi.fn(
  (fn: (...args: unknown[]) => unknown, _deps?: unknown[]) => fn,
);

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useState: <T,>(initialValue: T): UseStateTuple<T> =>
      mockUseState(initialValue) as UseStateTuple<T>,
    useEffect: (effect: () => void | (() => void), deps?: unknown[]): void => {
      mockUseEffect(effect, deps);
    },
    useCallback: <T extends (...args: unknown[]) => unknown>(
      fn: T,
      deps?: unknown[],
    ): T => mockUseCallback(fn, deps) as T,
  };
});

vi.mock("next/dynamic", () => ({
  default: (): (() => null) => () => null,
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => `<img alt=\"${alt}\" />`,
}));

vi.mock("@/components/ui/Button", () => ({
  Button: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
}));

vi.mock("@/lib/realtime/RealtimeContext", () => ({
  useRealtime: () => ({ isConnected: true }),
}));

vi.mock("@/lib/realtime/hooks/useRealtimeScope", () => ({
  useRealtimeScope: vi.fn(),
}));

vi.mock("@/lib/realtime/hooks/useRealtimeEvent", () => ({
  useRealtimeEvent: vi.fn(),
}));

describe("LiveMapClient battery display", () => {
  beforeEach(() => {
    mockUseState.mockReset();
    mockUseEffect.mockClear();
    mockUseCallback.mockClear();
  });

  it("renders integer battery percentages without multiplying already-normalized device values", async () => {
    mockUseState
      .mockReturnValueOnce([
        [
          {
            userId: "user-1",
            userName: "Budi",
            userImage: null,
            siteName: "HQ",
            departmentName: "Ops",
            latitude: -6.2,
            longitude: 106.8,
            accuracy: 5,
            speed: 0,
            heading: 0,
            isMoving: false,
            batteryLevel: 90,
            recordedAt: "2026-04-21T12:00:00.000Z",
            checkInTime: "2026-04-21T08:00:00.000Z",
          },
        ],
        vi.fn(),
      ])
      .mockReturnValueOnce([null, vi.fn()])
      .mockReturnValueOnce([false, vi.fn()])
      .mockReturnValueOnce([null, vi.fn()])
      .mockReturnValueOnce(["", vi.fn()])
      .mockReturnValueOnce([null, vi.fn()])
      .mockReturnValueOnce(["cards", vi.fn()]);

    const liveMapClientModule =
      await import("@/app/admin/kehadiran/live-map/LiveMapClient");
    const markup = renderToStaticMarkup(<liveMapClientModule.default />);

    expect(markup).toContain("🔋 90%");
    expect(markup).not.toContain("🔋 9000%");
  });
});
