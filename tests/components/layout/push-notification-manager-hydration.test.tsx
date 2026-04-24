// @vitest-environment jsdom

import { act } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useFCMMock = vi.fn();

vi.mock("@/hooks/useFCM", () => ({
  useFCM: () => useFCMMock(),
}));

import { PushNotificationManager } from "@/components/notifications/PushNotificationManager";

describe("PushNotificationManager hydration stability", () => {
  beforeEach(() => {
    useFCMMock.mockReset();
    useFCMMock.mockReturnValue({
      permission: "default",
      isSupported: true,
      isLoading: false,
      isRegistered: false,
      enableNotifications: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("hydrates without mismatch when dismissal state differs in localStorage", async () => {
    const serverMarkup = renderToStaticMarkup(<PushNotificationManager />);
    const container = document.createElement("div");
    container.innerHTML = serverMarkup;
    document.body.appendChild(container);

    const getItemMock = vi
      .spyOn(Storage.prototype, "getItem")
      .mockReturnValue("true");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined);
    const recoverableErrors: string[] = [];

    await act(async () => {
      hydrateRoot(container, <PushNotificationManager />, {
        onRecoverableError: (error) => {
          recoverableErrors.push(
            error instanceof Error ? error.message : String(error),
          );
        },
      });
      await Promise.resolve();
    });

    expect(serverMarkup).toBe("");
    expect(getItemMock).toHaveBeenCalledWith("push-notification-dismissed");
    expect(recoverableErrors).toEqual([]);
  });

  it("hydrates without mismatch when push support only becomes available in the browser", async () => {
    useFCMMock.mockImplementation(() => {
      if (typeof window === "undefined") {
        return {
          permission: "unsupported",
          isSupported: false,
          isLoading: false,
          isRegistered: false,
          enableNotifications: vi.fn(),
        };
      }

      return {
        permission: "default",
        isSupported: true,
        isLoading: false,
        isRegistered: false,
        enableNotifications: vi.fn(),
      };
    });

    const browserWindow = window;
    const browserNotification = window.Notification;

    vi.stubGlobal("window", undefined);
    vi.stubGlobal("Notification", undefined);
    const serverMarkup = renderToStaticMarkup(<PushNotificationManager />);
    vi.stubGlobal("window", browserWindow);
    vi.stubGlobal("Notification", browserNotification);

    const container = document.createElement("div");
    container.innerHTML = serverMarkup;
    document.body.appendChild(container);

    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined);
    const recoverableErrors: string[] = [];

    await act(async () => {
      hydrateRoot(container, <PushNotificationManager />, {
        onRecoverableError: (error) => {
          recoverableErrors.push(
            error instanceof Error ? error.message : String(error),
          );
        },
      });
      await Promise.resolve();
    });

    expect(serverMarkup).toBe("");
    expect(recoverableErrors).toEqual([]);
  });

  it("does not throw when dismissing the banner if localStorage is unavailable", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
    const setItemMock = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    const dispatchEventMock = vi.spyOn(window, "dispatchEvent");

    await act(async () => {
      createRoot(container).render(<PushNotificationManager />);
      await Promise.resolve();
    });

    const dismissButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Nanti saja"),
    );

    expect(dismissButton).toBeTruthy();
    expect(() =>
      dismissButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    ).not.toThrow();
    expect(setItemMock).toHaveBeenCalledWith(
      "push-notification-dismissed",
      "true",
    );
    expect(dispatchEventMock).not.toHaveBeenCalled();
  });
});
