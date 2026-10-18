// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  useApi: vi.fn(),
  refetch: vi.fn(),
  isConnected: true,
  eventHandler: null as ((event: { userId?: string }) => void) | null,
}));

vi.mock("@/lib/hooks/useApi", () => ({ useApi: mocks.useApi }));
vi.mock("@/lib/realtime/RealtimeContext", () => ({
  useRealtime: () => ({ isConnected: mocks.isConnected }),
}));
vi.mock("@/lib/realtime/hooks/useRealtimeScope", () => ({
  useRealtimeScope: vi.fn(),
}));
vi.mock("@/lib/realtime/hooks/useRealtimeEvent", () => ({
  useRealtimeEvent: (
    _event: string,
    handler: (event: { userId?: string }) => void,
  ) => {
    mocks.eventHandler = handler;
  },
}));

import { useLiveLocations } from "@/app/admin/kehadiran/live-map/useLiveLocations";

function apiResult(tenantId: string | null) {
  return {
    data: { locations: [{ userId: "user-1" }], tenantId },
    isLoading: false,
    isFetching: false,
    error: null as Error | null,
    refetch: mocks.refetch,
    mutate: vi.fn(),
  };
}

function Penguji(): null {
  useLiveLocations();
  return null;
}

let akar: Root | null = null;

async function renderHook(): Promise<void> {
  const wadah = document.createElement("div");
  document.body.appendChild(wadah);
  akar = createRoot(wadah);
  await act(async () => {
    akar?.render(<Penguji />);
  });
}

describe("useLiveLocations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.refetch.mockReset();
    mocks.isConnected = true;
    mocks.useApi.mockReturnValue(apiResult("tenant-1"));
  });

  afterEach(async () => {
    await act(async () => {
      akar?.unmount();
    });
    akar = null;
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("coalesces a burst of updates for shown employees into one refetch", async () => {
    await renderHook();

    act(() => {
      mocks.eventHandler?.({ userId: "user-1" });
      mocks.eventHandler?.({ userId: "user-1" });
      mocks.eventHandler?.({ userId: "user-1" });
    });
    expect(mocks.refetch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it("ignores updates for employees outside the admin's list", async () => {
    await renderHook();

    act(() => {
      mocks.eventHandler?.({ userId: "someone-else" });
      vi.advanceTimersByTime(5_000);
    });

    expect(mocks.refetch).not.toHaveBeenCalled();
  });

  it("keeps polling while realtime is connected", async () => {
    await renderHook();

    const options = mocks.useApi.mock.calls.at(-1)?.[1];
    expect(options.refreshInterval).toBe(60_000);
  });

  it("polls faster when there is no tenant channel to listen to", async () => {
    mocks.useApi.mockReturnValue(apiResult(null));

    await renderHook();

    const options = mocks.useApi.mock.calls.at(-1)?.[1];
    expect(options.refreshInterval).toBe(15_000);
  });
});
