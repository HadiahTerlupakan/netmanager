import { logger } from "@/lib/logger";
import { testR2Connection } from "@/lib/utils/r2-client";

export type GeminiTestSuccess = { success: true };
export type GeminiTestFailure = { success: false; error: string };
export type GeminiApiKeyTestResult = GeminiTestSuccess | GeminiTestFailure;

async function fetchAvailableGeminiModels(
  apiKey: string,
): Promise<string | null> {
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(listUrl);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };
    const availableModels = (data.models ?? [])
      .filter((model) =>
        model.supportedGenerationMethods?.includes("generateContent"),
      )
      .map((model) => model.name?.replace("models/", "") ?? "")
      .filter(Boolean);

    if (availableModels.length > 0) {
      return `\n\nModel yang tersedia untuk Key ini: ${availableModels.join(", ")}`;
    }

    return "\n\nTidak ada model yang tersedia untuk key ini (Mungkin perlu aktifkan Generative Language API).";
  } catch (error) {
    logger.error("[apiSettings] Failed to list Gemini models", error);
    return null;
  }
}

export async function testGoogleGeminiApiKey(
  apiKey: string,
): Promise<GeminiApiKeyTestResult> {
  const normalizedKey = apiKey.trim();
  const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(normalizedKey)}`;
  const payload = {
    contents: [
      {
        parts: [
          {
            text: "Test",
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(testUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return { success: true };
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch (error) {
      logger.error(
        "[apiSettings] Unable to parse Gemini test error response",
        error,
      );
      responseBody = null;
    }

    const baseMessage = (responseBody as { error?: { message?: string } })
      ?.error?.message;
    let errorMessage = baseMessage || "API Key tidak valid";

    if (response.status === 404) {
      const modelHint = await fetchAvailableGeminiModels(normalizedKey);
      if (modelHint) {
        errorMessage += modelHint;
      }
    }

    return { success: false, error: errorMessage };
  } catch (error) {
    logger.error("[apiSettings] Failed to validate Gemini API key", error);
    return {
      success: false,
      error: "Gagal memverifikasi API Key. Silakan coba lagi.",
    };
  }
}

export type R2ConnectionTestPayload = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
};

export async function testCloudflareR2Connection(
  payload: R2ConnectionTestPayload,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { success, error } = await testR2Connection({
      accountId: payload.accountId.trim(),
      accessKeyId: payload.accessKeyId.trim(),
      secretAccessKey: payload.secretAccessKey.trim(),
      bucketName: payload.bucketName.trim(),
      publicUrl: payload.publicUrl ?? "",
    });

    if (success) {
      return { success: true };
    }

    return { success: false, error: error ?? "Koneksi gagal" };
  } catch (error) {
    logger.error("[apiSettings] R2 connection test failed", error);
    return { success: false, error: "Koneksi gagal" };
  }
}
