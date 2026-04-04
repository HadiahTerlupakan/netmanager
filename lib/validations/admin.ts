/**
 * Admin Validation Schemas
 * Zod schemas for admin-specific validations (profile, holidays, etc.)
 */

import * as z from 'zod'

/**
 * Profile update validation
 */
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
})

export type UpdateProfile = z.infer<typeof updateProfileSchema>

/**
 * Password change validation
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password lama wajib diisi'),
  newPassword: z.string().min(6, 'Password minimal 6 karakter'),
  confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Password baru dan konfirmasi tidak cocok',
  path: ['confirmPassword'],
})

export type ChangePassword = z.infer<typeof changePasswordSchema>

/**
 * Holiday validation schemas
 */
export const holidayFilterSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

export type HolidayFilter = z.infer<typeof holidayFilterSchema>

export const createHolidaySchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
  description: z.string().min(1, 'Description is required').max(255),
  isNational: z.boolean().optional().default(true),
})

export type CreateHoliday = z.infer<typeof createHolidaySchema>

export const updateHolidaySchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format').optional(),
  description: z.string().min(1).max(255).optional(),
  isNational: z.boolean().optional(),
})

export type UpdateHoliday = z.infer<typeof updateHolidaySchema>
