import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithTimeout } from "@/modules/payment-gateway/services/providers/fetch-with-timeout";

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call fetch with AbortSignal", async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse);

    await fetchWithTimeout("https://api.example.com/test", {
      method: "GET",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.example.com/test",
      expect.objectContaining({
        method: "GET",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("should abort after specified timeout", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          const signal = (options as RequestInit)?.signal;
          if (signal) {
            signal.addEventListener("abort", () => {
              reject(
                new DOMException("The operation was aborted.", "AbortError"),
              );
            });
          }
        }),
    );

    await expect(
      fetchWithTimeout("https://api.example.com/slow", { timeoutMs: 50 }),
    ).rejects.toThrow("aborted");
  }, 10000);

  it("should use default 30s timeout if not specified", async () => {
    const mockResponse = new Response("ok", { status: 200 });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    const result = await fetchWithTimeout("https://api.example.com/test");

    expect(result.status).toBe(200);
  });

  it("should pass through request options", async () => {
    const mockResponse = new Response("ok", { status: 200 });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockResponse);

    await fetchWithTimeout("https://api.example.com/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "value" }),
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.example.com/test",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "value" }),
      }),
    );
  });
});
