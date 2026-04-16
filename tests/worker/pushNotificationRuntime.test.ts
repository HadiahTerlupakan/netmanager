import { describe, expect, it, vi } from "vitest";

import {
  applyNotificationClick,
  normalizePushNotificationPayload,
} from "../../worker/pushNotificationRuntime";

describe("normalizePushNotificationPayload", () => {
  it("keeps the top-level browser push payload shape working", () => {
    const payload = normalizePushNotificationPayload({
      title: "Top-level title",
      body: "Top-level body",
      icon: "/custom-icon.png",
      badge: "/custom-badge.png",
      data: { url: "/admin/notifications/123", tag: "admin-alert" },
    });

    expect(payload.title).toBe("Top-level title");
    expect(payload.body).toBe("Top-level body");
    expect(payload.icon).toBe("/custom-icon.png");
    expect(payload.badge).toBe("/custom-badge.png");
    expect(payload.data).toEqual({
      url: "/admin/notifications/123",
      tag: "admin-alert",
    });
  });

  it("reads nested notification and data fields and falls back to message for body", () => {
    const payload = normalizePushNotificationPayload({
      notification: {
        title: "Nested title",
        body: "Nested body",
        icon: "/nested-icon.png",
        badge: "/nested-badge.png",
      },
      data: {
        title: "Data title",
        message: "Data message body",
        url: "/admin/notifications/456",
      },
    });

    expect(payload.title).toBe("Nested title");
    expect(payload.body).toBe("Nested body");
    expect(payload.icon).toBe("/nested-icon.png");
    expect(payload.badge).toBe("/nested-badge.png");
    expect(payload.data).toEqual({
      title: "Data title",
      message: "Data message body",
      url: "/admin/notifications/456",
    });
  });

  it("uses safe defaults when fields are missing", () => {
    const payload = normalizePushNotificationPayload({});

    expect(payload.title).toBe("NetManager");
    expect(payload.body).toBe("You have a new notification");
    expect(payload.icon).toBe("/icons/icon-192x192.png");
    expect(payload.badge).toBe("/icons/icon-72x72.png");
    expect(payload.data).toEqual({});
  });
});

describe("applyNotificationClick", () => {
  it("prefers an admin client over an employee client for admin notification clicks", async () => {
    const employeeNavigate = vi.fn().mockResolvedValue(undefined);
    const employeeFocus = vi.fn().mockResolvedValue(undefined);
    const adminNavigate = vi.fn().mockResolvedValue(undefined);
    const adminFocus = vi.fn().mockResolvedValue(undefined);

    await applyNotificationClick({
      clients: [
        {
          url: "https://admin.example.com/employee/dashboard",
          navigate: employeeNavigate,
          focus: employeeFocus,
          visibilityState: "visible",
        },
        {
          url: "https://admin.example.com/admin/dashboard",
          navigate: adminNavigate,
          focus: adminFocus,
          visibilityState: "visible",
        },
      ],
      notificationData: { url: "/admin/notifications/789" },
      openWindow: vi.fn(),
    });

    expect(employeeNavigate).not.toHaveBeenCalled();
    expect(employeeFocus).not.toHaveBeenCalled();
    expect(adminNavigate).toHaveBeenCalledWith("/admin/notifications/789");
    expect(adminFocus).toHaveBeenCalledOnce();
  });

  it("prefers an employee client over an admin client for employee notification clicks", async () => {
    const adminNavigate = vi.fn().mockResolvedValue(undefined);
    const adminFocus = vi.fn().mockResolvedValue(undefined);
    const employeeNavigate = vi.fn().mockResolvedValue(undefined);
    const employeeFocus = vi.fn().mockResolvedValue(undefined);

    await applyNotificationClick({
      clients: [
        {
          url: "https://admin.example.com/admin/dashboard",
          navigate: adminNavigate,
          focus: adminFocus,
          visibilityState: "visible",
        },
        {
          url: "https://admin.example.com/employee/dashboard",
          navigate: employeeNavigate,
          focus: employeeFocus,
          visibilityState: "visible",
        },
      ],
      notificationData: { url: "/employee/notifications/789" },
      openWindow: vi.fn(),
    });

    expect(adminNavigate).not.toHaveBeenCalled();
    expect(adminFocus).not.toHaveBeenCalled();
    expect(employeeNavigate).toHaveBeenCalledWith(
      "/employee/notifications/789",
    );
    expect(employeeFocus).toHaveBeenCalledOnce();
  });

  it("opens a new admin window when only employee clients exist for an admin target url", async () => {
    const employeeNavigate = vi.fn().mockResolvedValue(undefined);
    const employeeFocus = vi.fn().mockResolvedValue(undefined);
    const openWindow = vi.fn().mockResolvedValue(undefined);

    await applyNotificationClick({
      clients: [
        {
          url: "https://admin.example.com/employee/dashboard",
          navigate: employeeNavigate,
          focus: employeeFocus,
          visibilityState: "visible",
        },
      ],
      notificationData: { url: "/admin/notifications/789" },
      openWindow,
    });

    expect(employeeNavigate).not.toHaveBeenCalled();
    expect(employeeFocus).not.toHaveBeenCalled();
    expect(openWindow).toHaveBeenCalledWith("/admin/notifications/789");
  });

  it("opens a new employee window when only admin clients exist for an employee target url", async () => {
    const adminNavigate = vi.fn().mockResolvedValue(undefined);
    const adminFocus = vi.fn().mockResolvedValue(undefined);
    const openWindow = vi.fn().mockResolvedValue(undefined);

    await applyNotificationClick({
      clients: [
        {
          url: "https://admin.example.com/admin/dashboard",
          navigate: adminNavigate,
          focus: adminFocus,
          visibilityState: "visible",
        },
      ],
      notificationData: { url: "/employee/notifications/789" },
      openWindow,
    });

    expect(adminNavigate).not.toHaveBeenCalled();
    expect(adminFocus).not.toHaveBeenCalled();
    expect(openWindow).toHaveBeenCalledWith("/employee/notifications/789");
  });

  it("reuses the first available window when none are focused and does not force employee routing without a url", async () => {
    const firstNavigate = vi.fn().mockResolvedValue(undefined);
    const firstFocus = vi.fn().mockResolvedValue(undefined);
    const secondNavigate = vi.fn().mockResolvedValue(undefined);
    const secondFocus = vi.fn().mockResolvedValue(undefined);
    const openWindow = vi.fn();

    await applyNotificationClick({
      clients: [
        {
          url: "https://admin.example.com/admin/reports",
          navigate: firstNavigate,
          focus: firstFocus,
          visibilityState: "hidden",
        },
        {
          url: "https://admin.example.com/employee/dashboard",
          navigate: secondNavigate,
          focus: secondFocus,
          visibilityState: "hidden",
        },
      ],
      notificationData: {},
      openWindow,
    });

    expect(firstNavigate).not.toHaveBeenCalled();
    expect(firstFocus).toHaveBeenCalledOnce();
    expect(secondNavigate).not.toHaveBeenCalled();
    expect(secondFocus).not.toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("opens a new window to the notification url or to the neutral fallback when no client exists", async () => {
    const openWindow = vi.fn().mockResolvedValue(undefined);

    await applyNotificationClick({
      clients: [],
      notificationData: { url: "/admin/notifications/999" },
      openWindow,
    });

    expect(openWindow).toHaveBeenCalledWith("/admin/notifications/999");

    openWindow.mockClear();

    await applyNotificationClick({
      clients: [],
      notificationData: {},
      openWindow,
    });

    expect(openWindow).toHaveBeenCalledWith("/");
  });
});
