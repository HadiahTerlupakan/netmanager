// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const palsu = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("react-hot-toast", () => ({
  toast: { success: palsu.success, error: palsu.error },
}));

import { useMikrotikActions } from "@/app/admin/network/mikrotik/hooks/useMikrotikActions";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type Actions = ReturnType<typeof useMikrotikActions>;

describe("useMikrotikActions.testConnection", () => {
  let root: Root;
  let actions: Actions;

  function Probe(): null {
    actions = useMikrotikActions();
    return null;
  }

  function stubFetch(status: number, body: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      })),
    );
  }

  beforeEach(async () => {
    palsu.success.mockReset();
    palsu.error.mockReset();
    root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Probe />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  });

  it("hasil gagal dari data memunculkan toast error, bukan sukses", async () => {
    stubFetch(200, {
      success: true,
      data: {
        success: false,
        api: { success: false, message: "x" },
        message: "Koneksi gagal",
      },
    });
    await act(async () => actions.testConnection("r1"));
    expect(actions.testResult?.success).toBe(false);
    expect(palsu.error).toHaveBeenCalledWith("Koneksi gagal");
    expect(palsu.success).not.toHaveBeenCalled();
  });

  it("hasil sukses dari data memunculkan toast sukses", async () => {
    stubFetch(200, {
      success: true,
      data: {
        success: true,
        api: { success: true, message: "OK" },
        message: "ok",
      },
    });
    await act(async () => actions.testConnection("r1"));
    expect(actions.testResult?.success).toBe(true);
    expect(palsu.success).toHaveBeenCalledWith("Test koneksi berhasil");
    expect(palsu.error).not.toHaveBeenCalled();
  });

  it("respons 4xx menampilkan pesan error rute", async () => {
    stubFetch(404, { success: false, error: "Router tidak ditemukan" });
    await act(async () => actions.testConnection("r1"));
    expect(actions.testResult?.api.message).toBe("Router tidak ditemukan");
    expect(palsu.error).toHaveBeenCalledWith("Router tidak ditemukan");
  });
});
