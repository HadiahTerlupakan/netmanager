/**
 * Frontend Validation Utilities
 * Matches backend Zod validation schemas for consistent validation
 */

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate reason/description text
 * Matches backend: min 10 chars, max 500 chars
 */
export function validateReason(reason: string, minLength = 10, maxLength = 500): ValidationResult {
  const trimmed = reason.trim()
  
  if (!trimmed) {
    return { valid: false, error: 'Alasan wajib diisi' }
  }
  
  if (trimmed.length < minLength) {
    return { valid: false, error: `Alasan minimal ${minLength} karakter (saat ini: ${trimmed.length})` }
  }
  
  if (trimmed.length > maxLength) {
    return { valid: false, error: `Alasan maksimal ${maxLength} karakter (saat ini: ${trimmed.length})` }
  }
  
  return { valid: true }
}

/**
 * Validate rejection reason
 * Matches backend: min 5 chars, max 500 chars
 */
export function validateRejectionReason(reason: string): ValidationResult {
  return validateReason(reason, 5, 500)
}

/**
 * Validate string length
 */
export function validateLength(
  value: string,
  min: number,
  max: number,
  fieldName: string
): ValidationResult {
  const trimmed = value.trim()
  if (trimmed.length < min) {
    return { valid: false, error: `${fieldName} minimal ${min} karakter` }
  }
  if (trimmed.length > max) {
    return { valid: false, error: `${fieldName} maksimal ${max} karakter` }
  }
  return { valid: true }
}

/**
 * Validate time range (start must be before end)
 */
export function validateTimeRange(
  startTime?: string | null,
  endTime?: string | null
): ValidationResult {
  if (!startTime || !endTime) {
    return { valid: true } // Optional fields
  }
  
  const start = new Date(startTime)
  const end = new Date(endTime)
  
  if (isNaN(start.getTime())) {
    return { valid: false, error: 'Waktu mulai tidak valid' }
  }
  
  if (isNaN(end.getTime())) {
    return { valid: false, error: 'Waktu selesai tidak valid' }
  }
  
  if (start >= end) {
    return { valid: false, error: 'Waktu mulai harus sebelum waktu selesai' }
  }
  
  return { valid: true }
}

/**
 * Validate date range for filters
 */
export function validateDateRange(
  startDate?: string | null,
  endDate?: string | null
): ValidationResult {
  if (!startDate && !endDate) {
    return { valid: true }
  }
  
  if (startDate && !endDate) {
    return { valid: false, error: 'Tanggal akhir wajib diisi jika tanggal awal dipilih' }
  }
  
  if (!startDate && endDate) {
    return { valid: false, error: 'Tanggal awal wajib diisi jika tanggal akhir dipilih' }
  }
  
  const start = new Date(startDate!)
  const end = new Date(endDate!)
  
  if (isNaN(start.getTime())) {
    return { valid: false, error: 'Tanggal awal tidak valid' }
  }
  
  if (isNaN(end.getTime())) {
    return { valid: false, error: 'Tanggal akhir tidak valid' }
  }
  
  if (start > end) {
    return { valid: false, error: 'Tanggal awal harus sebelum atau sama dengan tanggal akhir' }
  }
  
  // Max 90 days range
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays > 90) {
    return { valid: false, error: 'Rentang tanggal maksimal 90 hari' }
  }
  
  return { valid: true }
}

/**
 * Validate required field
 */
export function validateRequired(value: unknown, fieldName: string): ValidationResult {
  if (value === null || value === undefined || value === '') {
    return { valid: false, error: `${fieldName} wajib diisi` }
  }
  return { valid: true }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!email.trim()) {
    return { valid: false, error: 'Email wajib diisi' }
  }
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Format email tidak valid' }
  }
  
  return { valid: true }
}

/**
 * Validate phone number (Indonesian format)
 */
export function validatePhone(phone: string): ValidationResult {
  const cleaned = phone.replace(/\D/g, '')
  
  if (!cleaned) {
    return { valid: false, error: 'Nomor telepon wajib diisi' }
  }
  
  if (cleaned.length < 10 || cleaned.length > 15) {
    return { valid: false, error: 'Nomor telepon harus 10-15 digit' }
  }
  
  return { valid: true }
}

/**
 * Combine multiple validation results
 */
export function combineValidations(...results: ValidationResult[]): ValidationResult {
  for (const result of results) {
    if (!result.valid) {
      return result
    }
  }
  return { valid: true }
}

/**
 * Validate form data object
 */
export function validateForm<T extends Record<string, unknown>>(
  data: T,
  validators: Partial<Record<keyof T, (value: unknown) => ValidationResult>>
): { valid: boolean; errors: Partial<Record<keyof T, string>> } {
  const errors: Partial<Record<keyof T, string>> = {}
  let valid = true
  
  for (const [field, validator] of Object.entries(validators)) {
    if (validator) {
      const result = validator(data[field as keyof T])
      if (!result.valid) {
        valid = false
        errors[field as keyof T] = result.error
      }
    }
  }
  
  return { valid, errors }
}
