/**
 * Common Validation Schemas
 * Reusable Zod schemas for API validation
 */

import { z } from 'zod'

/**
 * Standard pagination schema
 */
const paginationBaseSchema = z.object({
  page: z.string().optional().transform(val => parseInt(val || '1')),
  limit: z.string().optional().transform(val => parseInt(val || '10')),
})

export const paginationSchema = paginationBaseSchema.transform(data => ({
  page: Math.max(1, data.page),
  limit: Math.min(100, Math.max(1, data.limit)), // Max 100 items per page
}))

/**
 * Date range validation schema
 */
export const dateRangeSchema = z.object({
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
}).refine(
  data => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate
    }
    return true
  },
  { message: 'Start date must be before or equal to end date' }
)

/**
 * UUID validation schema
 */
export const idSchema = z.string().uuid({ message: 'Invalid ID format' })

/**
 * Optional UUID validation schema
 */
export const optionalIdSchema = z.string().uuid().optional()

/**
 * Search query schema
 */
export const searchSchema = z.object({
  search: z.string().optional(),
  query: z.string().optional(),
})

/**
 * Status filter schema (generic)
 */
export const statusSchema = z.object({
  status: z.string().optional(),
})

/**
 * Site and department filter schema
 */
export const siteFilterSchema = z.object({
  siteId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
})

/**
 * Combined pagination + date range schema
 */
export const paginatedDateRangeSchema = paginationBaseSchema.merge(dateRangeSchema)

/**
 * Combined pagination + search schema
 */
export const paginatedSearchSchema = paginationBaseSchema.merge(searchSchema)

/**
 * Combined pagination + filters schema
 */
export const paginatedFilterSchema = paginationBaseSchema
  .merge(searchSchema)
  .merge(statusSchema)
  .merge(siteFilterSchema)
  .merge(dateRangeSchema)

/**
 * Boolean query parameter schema
 */
export const booleanSchema = z.string()
  .optional()
  .transform(val => val === 'true')

/**
 * Export flag schema
 */
export const exportSchema = z.object({
  export: booleanSchema,
})

/**
 * Common email validation
 */
export const emailSchema = z.string().email({ message: 'Invalid email format' })

/**
 * Common phone number validation (Indonesian format)
 */
export const phoneSchema = z.string()
  .regex(/^(\+62|62|0)[0-9]{9,12}$/, 'Invalid phone number format')
  .optional()

/**
 * Latitude/Longitude coordinate validation
 */
export const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

/**
 * Optional coordinate schema
 */
export const optionalCoordinateSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
})

/**
 * Sort order schema
 */
export const sortOrderSchema = z.enum(['asc', 'desc']).optional()

/**
 * Sort schema with field and order
 */
export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: sortOrderSchema,
})

/**
 * Complete query schema (pagination + search + sort + filters)
 */
export const completeQuerySchema = paginationBaseSchema
  .merge(searchSchema)
  .merge(sortSchema)
  .merge(statusSchema)
  .merge(siteFilterSchema)
  .merge(dateRangeSchema)
  .merge(exportSchema)

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
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: any } {
  const { searchParams } = new URL(request.url)
  const params = Object.fromEntries(searchParams.entries())
  
  const result = schema.safeParse(params)
  
  if (result.success) {
    return { success: true, data: result.data }
  }
  
  return { success: false, error: result.error.flatten().fieldErrors }
}
