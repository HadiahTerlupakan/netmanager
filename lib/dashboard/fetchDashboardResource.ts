import { z } from "zod";

export class DashboardHttpError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "DashboardHttpError";
    this.status = status;
    this.details = details;
  }
}

function parseJsonSafely(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return payload;
  }
}

function getErrorMessage(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (typeof record.error === "string") {
      return record.error;
    }

    if (typeof record.message === "string") {
      return record.message;
    }
  }

  return "Gagal memuat data dashboard";
}

const dashboardSuccessEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
});

function getSchemaErrorDetails(error: z.ZodError): unknown {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function getInvalidDashboardFormatError(details?: unknown): DashboardHttpError {
  return new DashboardHttpError(
    "Format respons dashboard tidak valid",
    500,
    details,
  );
}

/**
 * Fetch dashboard resource and validate its response body.
 */
export async function fetchDashboardResource<T>(
  input: RequestInfo | URL,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
  const rawBody = await response.text();
  const payload = rawBody ? parseJsonSafely(rawBody) : null;

  if (!response.ok) {
    throw new DashboardHttpError(
      getErrorMessage(payload),
      response.status,
      payload,
    );
  }

  const envelopeResult = dashboardSuccessEnvelopeSchema.safeParse(payload);

  if (!envelopeResult.success) {
    throw getInvalidDashboardFormatError();
  }

  const parsed = schema.safeParse(envelopeResult.data.data);

  if (!parsed.success) {
    throw getInvalidDashboardFormatError(getSchemaErrorDetails(parsed.error));
  }

  return parsed.data;
}
