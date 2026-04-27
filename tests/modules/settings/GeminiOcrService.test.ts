import { describe, expect, it, vi } from "vitest";
import { GeminiOcrService } from "@/modules/settings";

const repository = {
  findManyByKeys: vi.fn(),
};
const fetchImpl = vi.fn();

describe("GeminiOcrService", () => {
  it("menggunakan API key tenant settings dan fallback model Gemini", async () => {
    repository.findManyByKeys.mockResolvedValue([
      { key: "GOOGLE_GEMINI_API_KEY", value: "db-key", encrypted: false },
      { key: "GEMINI_ENABLED", value: "true", encrypted: false },
    ]);
    fetchImpl
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "{}",
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: JSON.stringify({ nik: "123" }) }] },
              },
            ],
          }),
      });
    const service = new GeminiOcrService(
      repository as never,
      fetchImpl as never,
    );

    const result = await service.generateJson({
      tenantId: "tenant-1",
      prompt: "extract",
      mimeType: "image/jpeg",
      base64Data: "abc",
      responseSchema: { type: "OBJECT" },
    });

    expect(result).toEqual({ nik: "123" });
    expect(fetchImpl).toHaveBeenLastCalledWith(
      expect.stringContaining(
        "gemini-2.0-flash-001:generateContent?key=db-key",
      ),
      expect.any(Object),
    );
  });
});
