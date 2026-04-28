import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { sanitizeText, sanitizeObject } from "@/lib/utils/sanitize";

/**
 * Middleware untuk sanitasi input pada request body
 *
 * @param req - NextRequest object
 * @returns NextRequest yang sudah di-sanitize
 */
export async function sanitizeRequestBody(
  req: NextRequest,
): Promise<NextRequest> {
  try {
    // Jika request memiliki body JSON
    if (req.headers.get("content-type")?.includes("application/json")) {
      try {
        const body = await req.json();

        // Sanitize body
        const sanitizedBody = sanitizeObject(body);

        // Buat request baru dengan body yang sudah di-sanitize
        return new NextRequest(req.url, {
          method: req.method,
          headers: req.headers,
          body: JSON.stringify(sanitizedBody),
        });
      } catch (error) {
        // Jika gagal parse JSON, kembalikan request asli
        logger.error("Error parsing JSON for sanitization:", error);
        return req;
      }
    }

    // Jika request memiliki form data
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      try {
        const formData = await req.formData();

        // Sanitize text fields
        const sanitizedFormData = new FormData();

        for (const [key, value] of formData.entries()) {
          if (typeof value === "string") {
            sanitizedFormData.append(key, sanitizeText(value));
          } else {
            // Keep file objects as-is
            sanitizedFormData.append(key, value);
          }
        }

        // Buat request baru dengan form data yang sudah di-sanitize
        return new NextRequest(req.url, {
          method: req.method,
          headers: req.headers,
          body: sanitizedFormData,
        });
      } catch (error) {
        // Jika gagal parse form data, kembalikan request asli
        logger.error("Error parsing form data for sanitization:", error);
        return req;
      }
    }

    // Untuk tipe content lainnya, kembalikan request asli
    return req;
  } catch (error) {
    logger.error("Error in request sanitization:", error);
    return req;
  }
}

/**
 * Middleware untuk sanitasi query parameters
 *
 * @param req - NextRequest object
 * @returns NextRequest dengan query parameters yang sudah di-sanitize
 */
export function sanitizeQueryParams(req: NextRequest): NextRequest {
  try {
    const url = new URL(req.url);

    // Sanitize semua query parameters
    const searchParams = new URLSearchParams();
    for (const [key, value] of url.searchParams.entries()) {
      searchParams.set(key, sanitizeText(value));
    }

    // Buat URL baru dengan query parameters yang sudah di-sanitize
    const sanitizedUrl = new URL(url.origin + url.pathname);
    sanitizedUrl.search = searchParams.toString();

    // Buat request baru dengan URL yang sudah di-sanitize
    return new NextRequest(sanitizedUrl.toString(), {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });
  } catch (error) {
    logger.error("Error in query sanitization:", error);
    return req;
  }
}

/**
 * Middleware untuk sanitasi path parameters
 *
 * @param params - Path parameters object
 * @returns Path parameters yang sudah di-sanitize
 */
export function sanitizePathParams(
  params: Record<string, string>,
): Record<string, string> {
  try {
    const sanitizedParams: Record<string, string> = {};

    for (const [key, value] of Object.entries(params)) {
      sanitizedParams[key] = sanitizeText(value);
    }

    return sanitizedParams;
  } catch (error) {
    logger.error("Error in path params sanitization:", error);
    return params;
  }
}
