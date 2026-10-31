// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const play = vi.fn<() => Promise<void>>();

import { NotificationSoundToggle } from "@/app/(customer)/profil/NotificationSoundToggle";
import { isCustomerNotificationSoundEnabled } from "@/lib/notification-sound";

describe("NotificationSoundToggle", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    play.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal(
      "Audio",
      vi.fn(function (this: { play: typeof play }) {
        this.play = play;
      }),
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const toggle = () =>
    container.querySelector<HTMLButtonElement>('[role="switch"]')!;

  it("starts on and turns the sound off for this browser", () => {
    act(() => root.render(<NotificationSoundToggle />));
    expect(toggle().getAttribute("aria-checked")).toBe("true");

    act(() => toggle().click());

    expect(toggle().getAttribute("aria-checked")).toBe("false");
    expect(isCustomerNotificationSoundEnabled()).toBe(false);
    expect(play).not.toHaveBeenCalled();
  });

  it("plays the tone as a preview when turned back on", () => {
    localStorage.setItem("customer_notification_sound", "false");
    act(() => root.render(<NotificationSoundToggle />));
    expect(toggle().getAttribute("aria-checked")).toBe("false");

    act(() => toggle().click());

    expect(isCustomerNotificationSoundEnabled()).toBe(true);
    expect(play).toHaveBeenCalledTimes(1);
  });
});
