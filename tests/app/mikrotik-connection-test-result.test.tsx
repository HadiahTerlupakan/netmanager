// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  evaluateVpnConnectionTest,
  submitMikrotikConnectionTest,
  VPN_ROUTEROS_VERSION_ERROR,
  type MikrotikVpnFormFields,
} from "@/app/admin/network/mikrotik/mikrotikFormShared";
import { useMikrotikConnectionTest } from "@/app/admin/network/mikrotik/hooks/useMikrotikConnectionTest";

/**
 * Rute test-connection menjawab `{success: true, data: {...}}`; hasil test
 * sebenarnya ada di `data`, bukan di amplop.
 */

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const FORM: MikrotikVpnFormFields = {
  ipAddress: "10.99.0.2",
  apiPort: 8728,
  apiUsername: "u",
  apiPassword: "p",
};

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

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("submitMikrotikConnectionTest", () => {
  it("membaca kegagalan dari data meski amplop success true", async () => {
    stubFetch(200, {
      success: true,
      data: {
        success: false,
        api: { success: false, message: "x" },
        message: "Koneksi gagal...",
      },
    });
    const result = await submitMikrotikConnectionTest(FORM);
    expect(result.success).toBe(false);
    expect(result.api.message).toBe("x");
  });

  it("mengembalikan routerInfo saat data.success true", async () => {
    stubFetch(200, {
      success: true,
      data: {
        success: true,
        api: { success: true, message: "OK" },
        routerInfo: { version: "7.16" },
        message: "Koneksi berhasil",
      },
    });
    const result = await submitMikrotikConnectionTest(FORM);
    expect(result.success).toBe(true);
    expect(result.routerInfo?.version).toBe("7.16");
  });

  it("memetakan respons 4xx ke hasil gagal berisi pesan error rute", async () => {
    const error = "Alamat ini khusus jaringan VPN";
    stubFetch(400, { success: false, error, code: "BAD_REQUEST" });
    const result = await submitMikrotikConnectionTest(FORM);
    expect(result.success).toBe(false);
    expect(result.message).toBe(error);
    expect(result.api.message).toBe(error);
  });

  it("memakai pesan cadangan bila body bukan objek", async () => {
    stubFetch(200, null);
    const result = await submitMikrotikConnectionTest(FORM);
    expect(result.success).toBe(false);
    expect(result.api.message).toBe("Respons API tidak valid");
  });

  it("melempar error jaringan ke pemanggil", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("jaringan putus");
      }),
    );
    await expect(submitMikrotikConnectionTest(FORM)).rejects.toThrow(
      "jaringan putus",
    );
  });
});

describe("evaluateVpnConnectionTest", () => {
  const base = { api: { success: true, message: "OK" }, message: "m" };

  it("gagal bila hasil gagal, dengan pesan API", () => {
    expect(
      evaluateVpnConnectionTest({
        success: false,
        api: { success: false, message: "x" },
        message: "m",
      }),
    ).toEqual({ status: "failed", message: "x" });
  });

  it("menolak RouterOS di bawah v7", () => {
    expect(
      evaluateVpnConnectionTest({
        ...base,
        success: true,
        routerInfo: { version: "6.49" },
      }),
    ).toEqual({ status: "failed", message: VPN_ROUTEROS_VERSION_ERROR });
  });

  it("lulus untuk RouterOS v7", () => {
    expect(
      evaluateVpnConnectionTest({
        ...base,
        success: true,
        routerInfo: { version: "7.16.2 (stable)" },
      }).status,
    ).toBe("passed");
  });
});

describe("useMikrotikConnectionTest", () => {
  let root: Root;
  let container: HTMLDivElement;
  let runTest: () => Promise<boolean>;

  function Probe(): null {
    runTest = useMikrotikConnectionTest({ formData: FORM }).runTest;
    return null;
  }

  beforeEach(async () => {
    container = document.createElement("div");
    root = createRoot(container);
    await act(async () => root.render(<Probe />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
  });

  it("runTest false saat data.success false", async () => {
    stubFetch(200, {
      success: true,
      data: {
        success: false,
        api: { success: false, message: "x" },
        message: "gagal",
      },
    });
    let ok = true;
    await act(async () => {
      ok = await runTest();
    });
    expect(ok).toBe(false);
  });

  it("runTest true saat data.success true", async () => {
    stubFetch(200, {
      success: true,
      data: {
        success: true,
        api: { success: true, message: "OK" },
        message: "ok",
      },
    });
    let ok = false;
    await act(async () => {
      ok = await runTest();
    });
    expect(ok).toBe(true);
  });
});
