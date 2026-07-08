const INDONESIA_COUNTRY_CODE = "62";
const LOCAL_PREFIX = "0";
const RESPONSE_PREVIEW_MAX_LENGTH = 240;

export type GatewayResponse = Record<string, unknown> & {
  readonly statusCode: number;
  readonly requestUrl: string;
};

/** Normalisasi nomor WhatsApp Indonesia ke format 628xxxxxxxxx. */
export function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith(LOCAL_PREFIX)) {
    return `${INDONESIA_COUNTRY_CODE}${digits.slice(1)}`;
  }

  return digits;
}

/** Parse response provider WhatsApp dengan error detail untuk non-JSON. */
export async function parseGatewayResponse(
  response: Response,
  requestUrl: string,
): Promise<GatewayResponse> {
  const contentType = response.headers.get("content-type") || "";
  const responseText = await response.text();

  if (contentType.includes("application/json")) {
    return {
      ...parseJsonObject(responseText),
      statusCode: response.status,
      requestUrl,
    };
  }

  return {
    success: false,
    statusCode: response.status,
    requestUrl,
    error: `Gateway mengembalikan ${contentType || "response non-JSON"} dari ${requestUrl} dengan status ${response.status}: ${previewResponse(responseText)}`,
  };
}

export function isSuccessGatewayResponse(result: GatewayResponse): boolean {
  return (
    result.status === true ||
    result.success === true ||
    result.status === "send" ||
    result.status === "success" ||
    result.status === "sent" ||
    result.message === "success"
  );
}

export function resolveGatewayErrorMessage(
  result: GatewayResponse,
  fallback: string,
): string {
  const providerMessage = result.message || result.error || result.reason;
  const detail = [
    `status ${result.statusCode}`,
    `URL ${result.requestUrl}`,
  ].join(", ");

  if (providerMessage) {
    return `${String(providerMessage)} (${detail})`;
  }

  return `${fallback} (${detail})`;
}

function parseJsonObject(responseText: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(responseText || "{}");

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { data: parsed };
  }

  return Object.fromEntries(Object.entries(parsed));
}

function previewResponse(responseText: string): string {
  return responseText
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, RESPONSE_PREVIEW_MAX_LENGTH);
}
