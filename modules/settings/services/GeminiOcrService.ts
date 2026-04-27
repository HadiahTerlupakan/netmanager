import { API_SETTINGS_KEYS, mapApiSettingsResponse } from "./apiSettings";
import { SettingsRepository } from "../repositories/SettingsRepository";
import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash-001",
  "gemini-flash-latest",
];

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
}

export class GeminiOcrService {
  constructor(
    private readonly repository: ISettingsRepository = SettingsRepository,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** Menghasilkan JSON terstruktur dari file menggunakan Gemini OCR. */
  async generateJson<T>(input: {
    tenantId?: string | null;
    prompt: string;
    mimeType: string;
    base64Data: string;
    responseSchema: Record<string, unknown>;
    temperature?: number;
  }): Promise<T> {
    const apiKey = await this.resolveApiKey(input.tenantId);
    let lastError: unknown = null;

    for (const model of GEMINI_MODELS) {
      try {
        return await this.callModel<T>(model, apiKey, input);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Semua model gagal memproses OCR");
  }

  private async resolveApiKey(tenantId?: string | null) {
    const records = await this.repository.findManyByKeys(
      API_SETTINGS_KEYS,
      tenantId || undefined,
    );
    const settings = mapApiSettingsResponse(records);
    const apiKey =
      settings.googleGeminiApiKey || process.env.GOOGLE_GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("Google Gemini API Key tidak dikonfigurasi");
    }

    if (records.length > 0 && !settings.geminiEnabled) {
      throw new Error("Google Gemini OCR belum diaktifkan");
    }

    return apiKey;
  }

  private async callModel<T>(
    model: string,
    apiKey: string,
    input: {
      prompt: string;
      mimeType: string;
      base64Data: string;
      responseSchema: Record<string, unknown>;
      temperature?: number;
    },
  ): Promise<T> {
    const response = await this.fetchImpl(this.buildUrl(model, apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(this.buildPayload(input)),
    });

    if (!response.ok) {
      throw new Error(await this.readErrorMessage(response));
    }

    const body = await response.text();
    if (!body) {
      throw new Error("Response body is empty");
    }

    const result = JSON.parse(body) as GeminiResponse;
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Struktur respons API tidak valid.");
    }

    return JSON.parse(text) as T;
  }

  private buildUrl(model: string, apiKey: string) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  }

  private buildPayload(input: {
    prompt: string;
    mimeType: string;
    base64Data: string;
    responseSchema: Record<string, unknown>;
    temperature?: number;
  }) {
    return {
      contents: [
        {
          parts: [
            { text: input.prompt },
            {
              inlineData: {
                mimeType: input.mimeType,
                data: input.base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: input.responseSchema,
        ...(input.temperature !== undefined
          ? { temperature: input.temperature }
          : {}),
      },
    };
  }

  private async readErrorMessage(response: Response) {
    try {
      const text = await response.text();
      const body = text ? (JSON.parse(text) as GeminiResponse) : null;
      return body?.error?.message || `API Error: ${response.statusText}`;
    } catch {
      return `API Error: ${response.statusText}`;
    }
  }
}

export function resolveGeminiMimeType(fileType: string) {
  if (fileType === "image/png") return "image/png";
  if (fileType === "application/pdf") return "application/pdf";
  return "image/jpeg";
}
