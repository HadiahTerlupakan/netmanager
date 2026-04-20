import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseState = vi.fn();
const mockUseCallback = vi.fn((fn: unknown) => fn);
const mockUseEffect = vi.fn();
const mockGetToken = vi.fn();
const mockOnMessage = vi.fn();
const mockToastSuccess = vi.fn();
const mockSetFcmToken = vi.fn();
const mockSetPermission = vi.fn();
const mockSetIsLoading = vi.fn();

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useState: ((initial: unknown) =>
      mockUseState(initial)) as typeof actual.useState,
    useCallback: ((fn: unknown) =>
      mockUseCallback(fn)) as typeof actual.useCallback,
    useEffect: ((effect: unknown) =>
      mockUseEffect(effect)) as typeof actual.useEffect,
  };
});

vi.mock("@/lib/firebase/config", () => ({
  messaging: { app: "mock" },
  isFirebaseMessagingConfigured: true,
}));

vi.mock("@/lib/notifications/normalizeForegroundNotificationPayload", () => ({
  normalizeForegroundNotificationPayload: vi.fn(() => null),
}));

vi.mock("firebase/messaging", () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
  onMessage: (...args: unknown[]) => mockOnMessage(...args),
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

import { useFCM } from "@/hooks/useFCM";

describe("useFCM", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const notification = {
      permission: "default" as NotificationPermission,
      requestPermission: vi.fn().mockResolvedValue("granted"),
    };

    vi.stubGlobal("Notification", notification);
    vi.stubGlobal("window", { Notification: notification });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    mockOnMessage.mockReturnValue(vi.fn());
    mockGetToken.mockResolvedValue("fcm-token-123");

    let stateCallIndex = 0;
    mockUseState.mockImplementation((initialValue: unknown) => {
      stateCallIndex += 1;
      const resolvedValue =
        typeof initialValue === "function"
          ? (initialValue as () => unknown)()
          : initialValue;

      if (stateCallIndex === 1) {
        return [resolvedValue, mockSetFcmToken];
      }

      if (stateCallIndex === 2) {
        return [resolvedValue, mockSetPermission];
      }

      if (stateCallIndex === 3) {
        return [resolvedValue, mockSetIsLoading];
      }

      return [resolvedValue, vi.fn()];
    });
  });

  it("does not mark the token as registered when backend token persistence fails", async () => {
    const hook = useFCM();

    const isEnabled = await hook.enableNotifications();

    expect(isEnabled).toBe(false);
    expect(mockSetFcmToken).toHaveBeenCalledWith(null);
    expect(mockSetFcmToken).not.toHaveBeenCalledWith("fcm-token-123");
    expect(fetch).toHaveBeenCalledWith("/api/user/fcm-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fcmToken: "fcm-token-123", action: "add" }),
    });
  });
});
