import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  VpnCoreError,
  getVpnCoreAddress,
  getVpnCoreClient,
  isVpnConfigured,
} from "@/modules/network/vpn";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("VpnCoreClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VPN_CORE_API_URL", "http://core.test:8080/");
    vi.stubEnv("VPN_API_TOKEN", "tok-123");
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("sends the bearer token to the normalised base URL", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await getVpnCoreClient().listHubs();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://core.test:8080/v1/hubs");
    expect(init.headers.Authorization).toBe("Bearer tok-123");
  });

  it("posts JSON bodies and returns the parsed result", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ hub: { id: "h1" }, installCommand: "curl x | sh" }, 201),
    );
    const out = await getVpnCoreClient().createHub({
      name: "Hub",
      publicHost: "h.example.com",
      listenPort: 51820,
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      name: "Hub",
      publicHost: "h.example.com",
      listenPort: 51820,
    });
    expect(out.installCommand).toBe("curl x | sh");
  });

  it("maps a core error body to VpnCoreError", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "in_use" }, 409));
    const err = await getVpnCoreClient()
      .deleteHub("h1")
      .catch((e) => e);
    expect(err).toBeInstanceOf(VpnCoreError);
    expect(err.status).toBe(409);
    expect(err.code).toBe("in_use");
    expect(err.message).toBe("in_use");
  });

  it("prefers the core message when present", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "validation", message: "label kosong" }, 400),
    );
    const err = await getVpnCoreClient()
      .createAdminPeer("")
      .catch((e) => e);
    expect(err.code).toBe("validation");
    expect(err.message).toBe("label kosong");
  });

  it("treats a non-JSON error body as internal", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>bad</html>", { status: 502 }),
    );
    const err = await getVpnCoreClient()
      .getRouter("r1")
      .catch((e) => e);
    expect(err.status).toBe(502);
    expect(err.code).toBe("internal");
  });

  it("reports an unreachable core as 502 unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const err = await getVpnCoreClient()
      .listHubs()
      .catch((e) => e);
    expect(err.status).toBe(502);
    expect(err.code).toBe("unreachable");
  });

  it("aborts after 5000 ms with 504 timeout", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const pending = getVpnCoreClient()
      .listHubs()
      .catch((e) => e);
    await vi.advanceTimersByTimeAsync(5000);
    const err = await pending;
    expect(err.status).toBe(504);
    expect(err.code).toBe("timeout");
  });

  it.each([
    ["JSON", () => getVpnCoreClient().listHubs()],
    ["text", () => getVpnCoreClient().routerScript("r1", "full")],
  ])("times out a %s body that never arrives with 504", async (_kind, call) => {
    vi.useFakeTimers();
    const stalled = new Promise<never>(() => {});
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => stalled,
      text: () => stalled,
    });
    const pending = call().catch((e) => e);
    await vi.advanceTimersByTimeAsync(5000);
    const err = await pending;
    expect(err).toBeInstanceOf(VpnCoreError);
    expect(err.status).toBe(504);
    expect(err.code).toBe("timeout");
  });

  it("reports an unparsable success body as 502 internal", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));
    const err = await getVpnCoreClient()
      .listHubs()
      .catch((e) => e);
    expect(err.status).toBe(502);
    expect(err.code).toBe("internal");
  });

  it("reads routerScript as text with the requested part", async () => {
    fetchMock.mockResolvedValue(new Response("/interface wireguard add"));
    const script = await getVpnCoreClient().routerScript("r1", "switch");
    expect(script).toBe("/interface wireguard add");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://core.test:8080/v1/routers/r1/routeros?part=switch",
    );
  });

  it("does not parse a body for 204 deletes", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(
      getVpnCoreClient().deleteRouter("r1"),
    ).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("isVpnConfigured is false when the URL is empty", () => {
    vi.stubEnv("VPN_CORE_API_URL", "");
    expect(isVpnConfigured()).toBe(false);
  });

  it("isVpnConfigured is true when URL and token are set", () => {
    expect(isVpnConfigured()).toBe(true);
  });

  it("getVpnCoreAddress defaults to 10.99.0.1", () => {
    vi.stubEnv("VPN_CORE_ADDRESS", "");
    expect(getVpnCoreAddress()).toBe("10.99.0.1");
    vi.stubEnv("VPN_CORE_ADDRESS", "10.50.0.1");
    expect(getVpnCoreAddress()).toBe("10.50.0.1");
  });

  it("encodes ids so they cannot alter the request path", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await getVpnCoreClient().deleteRouter("../hubs/x");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://core.test:8080/v1/routers/..%2Fhubs%2Fx",
    );
  });

  it("falls back to the default core address when the env value is not IPv4", () => {
    vi.stubEnv("VPN_CORE_ADDRESS", '10.99.0.1" ; /system reset');
    expect(getVpnCoreAddress()).toBe("10.99.0.1");
    vi.stubEnv("VPN_CORE_ADDRESS", "10.99.0.5");
    expect(getVpnCoreAddress()).toBe("10.99.0.5");
  });
});
