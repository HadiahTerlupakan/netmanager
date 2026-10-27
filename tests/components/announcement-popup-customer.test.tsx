// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regresi: di portal pelanggan popup mengambil /api/announcements, route khusus
 * staf, sehingga 401 dan pengumuman untuk pelanggan tidak pernah tampil.
 */

vi.mock("@/lib/realtime/hooks/useRealtimeEvent", () => ({
  useRealtimeEvent: () => {},
}));

let container: HTMLElement;
let root: Root;
const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function renderPopup(portal: "customer" | "admin") {
  const { default: AnnouncementPopup } =
    await import("@/components/announcement/AnnouncementPopup");
  await act(async () => root.render(<AnnouncementPopup portal={portal} />));
  await act(async () => vi.advanceTimersByTime(150));
}

describe("AnnouncementPopup", () => {
  it("portal pelanggan memakai endpoint pelanggan", async () => {
    await renderPopup("customer");
    expect(fetchMock).toHaveBeenCalledWith("/api/customer/announcements");
  });

  it("portal admin tetap memakai endpoint staf", async () => {
    await renderPopup("admin");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/announcements?portal=admin&active=true",
    );
  });
});
