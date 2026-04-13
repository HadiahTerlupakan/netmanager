/**
 * Common Validation Schemas
 * Reusable Zod schemas for API validation
 * Updated for Zod 4 best practices
 */

import * as z from "zod";

/**
 * Standard pagination schema
 */
const paginationBaseSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => parseInt(val || "1")),
  limit: z
    .string()
    .optional()
    .transform((val) => parseInt(val || "10")),
});

export const paginationSchema = paginationBaseSchema.transform((data) => ({
  page: Math.max(1, data.page),
  limit: Math.min(100, Math.max(1, data.limit)), // Max 100 items per page
}));

/**
 * Date range validation schema
 */
const dateRangeShape = {
  startDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
};

const validateDateRange = (data: { startDate?: Date; endDate?: Date }) => {
  if (data.startDate && data.endDate) {
    return data.startDate <= data.endDate;
  }

  return true;
};

const dateRangeError = {
  error: "Start date must be before or equal to end date",
};

export const dateRangeSchema = z
  .object(dateRangeShape)
  .refine(validateDateRange, dateRangeError);

/**
 * UUID/CUID validation schema
 * Allows both UUID and CUID formats to support mixed ID types in the database
 * Simplified for Zod 4 - uses string with min length as primary validation
 */
export const idSchema = z.string().min(1, { error: "Format ID tidak valid" });

/**
 * Optional UUID/CUID validation schema
 * Handles empty strings and nulls by converting them to undefined
 */
export const optionalIdSchema = z.preprocess(
  (val) => (val === "" || val === null ? undefined : val),
  z.string().min(1).optional(),
);

/**
 * Search query schema
 */
export const searchSchema = z.object({
  search: z.string().optional(),
  query: z.string().optional(),
});

/**
 * Status filter schema (generic)
 */
export const statusSchema = z.object({
  status: z.string().optional(),
});

/**
 * Site and department filter schema
 */
export const siteFilterSchema = z.object({
  siteId: optionalIdSchema,
  departmentId: optionalIdSchema,
});

/**
 * Combined pagination + date range schema
 */
export const paginatedDateRangeSchema = z
  .object({
    ...paginationBaseSchema.shape,
    ...dateRangeShape,
  })
  .refine(validateDateRange, dateRangeError);

/**
 * Combined pagination + search schema
 */
export const paginatedSearchSchema = z.object({
  ...paginationBaseSchema.shape,
  ...searchSchema.shape,
});

/**
 * Combined pagination + filters schema
 */
export const paginatedFilterSchema = z
  .object({
    ...paginationBaseSchema.shape,
    ...searchSchema.shape,
    ...statusSchema.shape,
    ...siteFilterSchema.shape,
    ...dateRangeShape,
  })
  .refine(validateDateRange, dateRangeError);

/**
 * Boolean query parameter schema
 */
export const booleanSchema = z
  .string()
  .optional()
  .transform((val) => val === "true");

/**
 * Export flag schema
 */
export const exportSchema = z.object({
  export: booleanSchema,
});

/**
 * Common email validation
 */
export const emailSchema = z.email({ error: "Format email tidak valid" });

/**
 * Common phone number validation (Indonesian format)
 */
export const phoneSchema = z
  .string()
  .regex(/^(\+62|62|0)[0-9]{9,12}$/, { error: "Invalid phone number format" })
  .optional();

/**
 * Latitude/Longitude coordinate validation
 */
export const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * Optional coordinate schema
 */
export const optionalCoordinateSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

/**
 * Sort order schema
 */
export const sortOrderSchema = z.enum(["asc", "desc"]).optional();

/**
 * Sort schema with field and order
 */
export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: sortOrderSchema,
});

/**
 * Complete query schema (pagination + search + sort + filters)
 */
export const completeQuerySchema = z
  .object({
    ...paginationBaseSchema.shape,
    ...searchSchema.shape,
    ...sortSchema.shape,
    ...statusSchema.shape,
    ...siteFilterSchema.shape,
    ...dateRangeShape,
    ...exportSchema.shape,
  })
  .refine(validateDateRange, dateRangeError);

/**
 * Helper to validate query parameters
 * @example
 * ```ts
 * const params = validateQueryParams(request, paginationSchema)
 * if (!params.success) {
 *   return ApiErrors.badRequest('Invalid parameters', params.error)
 * }
 * const { page, limit } = params.data
 * ```
 */
export function validateQueryParams<T extends z.ZodType>(
  request: Request,
  schema: T,
):
  | { success: true; data: z.infer<T> }
  | { success: false; error: Record<string, string[] | undefined> } {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  const result = schema.safeParse(params);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, error: z.flattenError(result.error).fieldErrors };
}
