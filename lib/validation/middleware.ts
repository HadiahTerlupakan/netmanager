import { NextRequest, NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import { ZodError } from "zod";
// Export validation schemas for convenience
export * from "./schemas";

export interface ValidationResponse {
  success: boolean;
  data?: unknown;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * Validates request body against a Zod schema
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
): Promise<ValidationResponse> {
  try {
    const body = await request.json();
    const validatedData = schema.parse(body);

    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));

      return {
        success: false,
        errors,
      };
    }

    return {
      success: false,
      errors: [
        {
          field: "general",
          message: "Format request tidak valid",
        },
      ],
    };
  }
}

/**
 * Validates query parameters against a Zod schema
 */
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>,
): ValidationResponse {
  try {
    const query: Record<string, string | string[]> = {};

    // Convert URLSearchParams to object
    for (const [key, value] of searchParams.entries()) {
      // Handle arrays (when parameter appears multiple times)
      if (query[key]) {
        if (Array.isArray(query[key])) {
          query[key].push(value);
        } else {
          query[key] = [query[key], value];
        }
      } else {
        query[key] = value;
      }
    }

    const validatedData = schema.parse(query);

    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));

      return {
        success: false,
        errors,
      };
    }

    return {
      success: false,
      errors: [
        {
          field: "general",
          message: "Parameter query tidak valid",
        },
      ],
    };
  }
}

/**
 * Creates a validation wrapper for API routes
 */
export function withValidation<T>(
  schema: ZodSchema<T>,
  handler: (
    request: NextRequest,
    context: { data: T; validated: T },
  ) => Promise<NextResponse>,
) {
  return async (
    request: NextRequest,
    _context?: unknown,
  ): Promise<NextResponse> => {
    // Validate request body
    const validation = await validateRequestBody(request, schema);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validasi gagal",
          details: validation.errors,
        },
        { status: 400 },
      );
    }

    // Call the handler with validated data
    return handler(request, {
      data: validation.data as T,
      validated: validation.data as T,
    });
  };
}

/**
 * Validates query parameters for GET requests
 */
export function withQueryValidation<T>(
  schema: ZodSchema<T>,
  handler: (
    request: NextRequest,
    context: { query: T; validated: T },
  ) => Promise<NextResponse>,
) {
  return async (
    request: NextRequest,
    _context?: unknown,
  ): Promise<NextResponse> => {
    // Validate query parameters
    const validation = validateQuery(request.nextUrl.searchParams, schema);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Parameter query tidak valid",
          details: validation.errors,
        },
        { status: 400 },
      );
    }

    // Call the handler with validated query
    return handler(request, {
      query: validation.data as T,
      validated: validation.data as T,
    });
  };
}

/**
 * Sanitizes string inputs to prevent XSS
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== "string") {
    return String(input || "");
  }

  return input
    .replace(/[<>]/g, "") // Remove basic HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers
    .trim();
}

/**
 * Sanitizes and validates email addresses
 */
export function sanitizeEmail(input: unknown): string {
  if (typeof input !== "string") {
    return "";
  }

  return input.toLowerCase().trim();
}

/**
 * Sanitizes phone numbers
 */
export function sanitizePhone(input: unknown): string {
  if (typeof input !== "string") {
    return "";
  }

  return input.replace(/[^\d+\-\s()]/g, "").trim();
}

/**
 * Validates and sanitizes numeric inputs
 */
export function sanitizeNumber(input: unknown): number {
  const num = Number(input);
  return isNaN(num) ? 0 : num;
}

/**
 * Validates UUID format
 */
export function isValidUUID(input: unknown): boolean {
  if (typeof input !== "string") {
    return false;
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(input);
}

/**
 * Middleware to validate file uploads
 */
export function validateFileUpload(
  file: File,
  allowedTypes: string[],
  maxSize: number,
): ValidationResponse {
  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      success: false,
      errors: [
        {
          field: "file",
          message: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(", ")}`,
        },
      ],
    };
  }

  // Check file size
  if (file.size > maxSize) {
    return {
      success: false,
      errors: [
        {
          field: "file",
          message: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${(maxSize / 1024 / 1024).toFixed(2)}MB`,
        },
      ],
    };
  }

  // Check file name
  const fileName = file.name.toLowerCase();
  if (fileName.includes("../") || fileName.includes("..\\")) {
    return {
      success: false,
      errors: [
        {
          field: "file",
          message: "Nama file tidak valid",
        },
      ],
    };
  }

  return {
    success: true,
    data: file,
  };
}

/**
 * Rate limiting for validation attempts
 */
const validationAttempts = new Map<
  string,
  { count: number; resetTime: number }
>();

export function checkValidationRateLimit(
  identifier: string,
  maxAttempts: number = 10,
  windowMs: number = 60000,
): boolean {
  const now = Date.now();
  const attempts = validationAttempts.get(identifier);

  if (!attempts || now > attempts.resetTime) {
    // Reset or initialize counter
    validationAttempts.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return true;
  }

  if (attempts.count >= maxAttempts) {
    return false;
  }

  attempts.count++;
  return true;
}

/**
 * Clean up old validation rate limit entries
 */
export function cleanupValidationRateLimit(): void {
  const now = Date.now();
  const toDelete: string[] = [];

  for (const [identifier, data] of validationAttempts.entries()) {
    if (now > data.resetTime) {
      toDelete.push(identifier);
    }
  }

  toDelete.forEach((identifier) => validationAttempts.delete(identifier));
}

const VALIDATION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Run cleanup every 5 minutes
setInterval(cleanupValidationRateLimit, VALIDATION_CLEANUP_INTERVAL_MS);
