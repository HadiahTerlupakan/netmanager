import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const bellMocks = vi.hoisted(() => ({
  usePermission: vi.fn(),
  useRealtimePaymentApprovals: vi.fn(),
  useClickOutside: vi.fn(),
}));

vi.mock("@/hooks/use-permission", () => ({
  usePermission: bellMocks.usePermission,
}));

vi.mock("@/lib/websocket/hooks/useRealtimePaymentApprovals", () => ({
  useRealtimePaymentApprovals: bellMocks.useRealtimePaymentApprovals,
}));

vi.mock("@/hooks/useClickOutside", () => ({
  useClickOutside: bellMocks.useClickOutside,
}));

import { PaymentApprovalBell } from "@/components/notifications/PaymentApprovalBell";

describe("PaymentApprovalBell", () => {
  it("does not render or fetch pending payments without manual payment read permission", () => {
    bellMocks.usePermission.mockReturnValue({
      hasPermission: () => false,
    });
    bellMocks.useRealtimePaymentApprovals.mockReturnValue({
      payments: [],
      loading: false,
      isConnected: false,
      refresh: vi.fn(),
    });

    const markup = renderToStaticMarkup(<PaymentApprovalBell />);

    expect(markup).toBe("");
    expect(bellMocks.useRealtimePaymentApprovals).not.toHaveBeenCalled();
  });
});
