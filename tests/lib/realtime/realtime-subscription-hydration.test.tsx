// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  activeListeners,
  channelEvent,
  disconnectChannel,
  signInAs,
  syncChannel,
} from "./firestore-channel-fake";
import { RealtimeProvider } from "@/lib/realtime/RealtimeContext";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const CHANNEL = "users/user-1/events";
const HYDRATED_AT = Date.parse("2026-11-01T08:00:00.000Z");
const MINUTE = 60_000;

const history = [
  channelEvent("old-1", { createdAt: new Date(HYDRATED_AT).toISOString() }),
  channelEvent("old-2", {
    createdAt: new Date(HYDRATED_AT - 10 * MINUTE).toISOString(),
  }),
  channelEvent("old-3", {
    createdAt: new Date(HYDRATED_AT - 90 * MINUTE).toISOString(),
  }),
];

const payloadOf = (event: ReturnType<typeof channelEvent>) =>
  event.data().payload;

function NotificationProbe({
  onEvent,
}: {
  onEvent: (payload: unknown) => void;
}): null {
  useRealtimeEvent("notification.new", onEvent);
  return null;
}

function ExtraScopeProbe(): null {
  useRealtimeScope({ kind: "admin", id: "workorders" });
  return null;
}

describe("useRealtimeSubscription hydration", () => {
  let root: Root;
  const onEvent = vi.fn();

  function render(
    options: {
      status?: "authenticated" | "loading";
      withExtraScope?: boolean;
    } = {},
  ) {
    act(() =>
      root.render(
        <RealtimeProvider statusOverride={options.status ?? "authenticated"}>
          <NotificationProbe onEvent={onEvent} />
          {options.withExtraScope ? <ExtraScopeProbe /> : null}
        </RealtimeProvider>,
      ),
    );
  }

  beforeEach(() => {
    // Event baru di tes ini dicap "sekarang", sesaat setelah riwayatnya.
    vi.useFakeTimers({ now: HYDRATED_AT, toFake: ["Date"] });
    signInAs({ id: "user-1" });
    onEvent.mockReset();
    root = createRoot(document.createElement("div"));
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
  });

  it("treats what the server already holds as history when the first snapshot came from an empty cache", () => {
    render();
    act(() => disconnectChannel(CHANNEL));
    act(() => syncChannel(CHANNEL, history));

    expect(onEvent).not.toHaveBeenCalled();

    const fresh = channelEvent("new-1");
    act(() => syncChannel(CHANNEL, [fresh, ...history]));

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(payloadOf(fresh));
  });

  it("hands a document to its listener once, even when the SDK reports it as added again", () => {
    render();
    act(() => syncChannel(CHANNEL, history));
    const fresh = channelEvent("new-1");
    act(() => syncChannel(CHANNEL, [fresh, ...history]));

    // Dokumen yang keluar dari jendela limit lalu masuk lagi dilaporkan
    // "added" sekali lagi oleh SDK.
    activeListeners(CHANNEL).forEach((listener) =>
      listener.view.delete("new-1"),
    );
    act(() => syncChannel(CHANNEL, [fresh, ...history]));

    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["an ISO string", (at: number): unknown => new Date(at).toISOString()],
    ["epoch milliseconds", (at: number): unknown => at],
    [
      "a Firestore Timestamp",
      (at: number): unknown => ({ toMillis: () => at }),
    ],
  ])(
    "ignores an added document older than its hydrated history when createdAt is %s",
    (_format, formatCreatedAt) => {
      render();
      act(() => syncChannel(CHANNEL, history));

      const stale = channelEvent("stale", {
        createdAt: formatCreatedAt(HYDRATED_AT - 2 * 60 * MINUTE),
      });
      const fresh = channelEvent("fresh", {
        createdAt: formatCreatedAt(HYDRATED_AT + 1_000),
      });
      act(() => syncChannel(CHANNEL, [fresh, ...history, stale]));

      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(payloadOf(fresh));
    },
  );

  it("still delivers an event the server wrote a moment after stamping it", () => {
    // Publish yang di-throttle ditulis lewat batch hingga 2 detik kemudian,
    // dengan createdAt dari saat publish dipanggil.
    render();
    act(() => syncChannel(CHANNEL, history));
    const batched = channelEvent("batched", {
      createdAt: new Date(HYDRATED_AT - 2_000).toISOString(),
    });
    act(() => syncChannel(CHANNEL, [batched, ...history]));

    expect(onEvent).toHaveBeenCalledWith(payloadOf(batched));
  });

  it.each([
    [
      "the connection drops and comes back",
      (rerender: typeof render) => {
        rerender({ status: "loading" });
        expect(activeListeners(CHANNEL)).toHaveLength(0);
        rerender();
      },
    ],
    [
      "a page adds a scope",
      (rerender: typeof render) => rerender({ withExtraScope: true }),
    ],
  ])("does not replay history when %s", (_trigger, resubscribe) => {
    render();
    act(() => syncChannel(CHANNEL, history));
    const delivered = channelEvent("new-1");
    act(() => syncChannel(CHANNEL, [delivered, ...history]));
    expect(onEvent).toHaveBeenCalledTimes(1);

    resubscribe(render);
    expect(activeListeners(CHANNEL)).toHaveLength(1);
    act(() => disconnectChannel(CHANNEL));
    act(() => syncChannel(CHANNEL, [delivered, ...history]));

    expect(onEvent).toHaveBeenCalledTimes(1);

    const fresh = channelEvent("new-2");
    act(() => syncChannel(CHANNEL, [fresh, delivered, ...history]));
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenLastCalledWith(payloadOf(fresh));
  });

  it("delivers what arrived while offline once the server catches up, without repeating the rest", () => {
    render();
    act(() => syncChannel(CHANNEL, history));
    const before = channelEvent("before");
    act(() => syncChannel(CHANNEL, [before, ...history]));

    act(() => disconnectChannel(CHANNEL));
    const missed = channelEvent("missed");
    act(() => syncChannel(CHANNEL, [missed, before, ...history]));

    expect(onEvent.mock.calls).toEqual([
      [payloadOf(before)],
      [payloadOf(missed)],
    ]);
  });
});
