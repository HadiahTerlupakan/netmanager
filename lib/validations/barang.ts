/**
 * Validation utilities for Barang (Inventory Item) input
 *
 * This module provides comprehensive validation and sanitization functions
 * for inventory item (barang) form inputs to ensure data integrity and security.
 *
 * @module lib/validations/barang
 */

/**
 * Minimum and maximum length constraints for barang fields
 *
 * @constant
 * @type {Object}
 * @property {Object} NAMA - Constraints for item name field
 * @property {number} NAMA.MIN - Minimum length for item name (3 characters)
 * @property {number} NAMA.MAX - Maximum length for item name (200 characters)
 * @property {Object} SATUAN - Constraints for unit field
 * @property {number} SATUAN.MIN - Minimum length for unit (1 character)
 * @property {number} SATUAN.MAX - Maximum length for unit (50 characters)
 */
export const BARANG_VALIDATION = {
  NAMA: {
    MIN: 3,
    MAX: 200
  },
  SATUAN: {
    MIN: 1,
    MAX: 50
  }
} as const

/**
 * Sanitize input to prevent XSS attacks
 *
 * Removes HTML tags and trims whitespace from user input to prevent
 * cross-site scripting (XSS) attacks and ensure clean data storage.
 *
 * @param {string} input - The input string to sanitize
 * @returns {string} Sanitized string with HTML tags removed and whitespace trimmed
 *
 * @example
 * sanitizeInput('<script>alert("xss")</script>Hello') // Returns: 'Hello'
 * sanitizeInput('  ONT ZTE F660  ') // Returns: 'ONT ZTE F660'
 */
export function sanitizeInput(input: string): string {
  return input.trim().replace(/<[^>]*>/g, '')
}

/**
 * Validate barang name field
 *
 * Validates that the item name meets minimum and maximum length requirements
 * after sanitization. This ensures consistent and meaningful item names.
 *
 * @param {string} nama - The item name to validate
 * @returns {{ valid: boolean; error?: string }} Validation result object
 * @returns {boolean} returns.valid - Whether the validation passed
 * @returns {string} [returns.error] - Error message if validation failed
 *
 * @example
 * validateBarangNama('ONT') // Returns: { valid: true }
 * validateBarangNama('AB') // Returns: { valid: false, error: 'Nama barang minimal 3 karakter' }
 * validateBarangNama('') // Returns: { valid: false, error: 'Nama barang harus diisi' }
 */
export function validateBarangNama(nama: string): { valid: boolean; error?: string } {
  const sanitized = sanitizeInput(nama)
  
  if (!sanitized) {
    return { valid: false, error: 'Nama barang harus diisi' }
  }
  
  if (sanitized.length < BARANG_VALIDATION.NAMA.MIN) {
    return { 
      valid: false, 
      error: `Nama barang minimal ${BARANG_VALIDATION.NAMA.MIN} karakter` 
    }
  }
  
  if (sanitized.length > BARANG_VALIDATION.NAMA.MAX) {
    return { 
      valid: false, 
      error: `Nama barang maksimal ${BARANG_VALIDATION.NAMA.MAX} karakter` 
    }
  }
  
  return { valid: true }
}

/**
 * Validate barang satuan (unit)
 */
export function validateBarangSatuan(satuan: string): { valid: boolean; error?: string } {
  const sanitized = sanitizeInput(satuan)
  
  if (!sanitized) {
    return { valid: false, error: 'Satuan barang harus diisi' }
  }
  
  if (sanitized.length < BARANG_VALIDATION.SATUAN.MIN) {
    return { 
      valid: false, 
      error: `Satuan minimal ${BARANG_VALIDATION.SATUAN.MIN} karakter` 
    }
  }
  
  if (sanitized.length > BARANG_VALIDATION.SATUAN.MAX) {
    return { 
      valid: false, 
      error: `Satuan maksimal ${BARANG_VALIDATION.SATUAN.MAX} karakter` 
    }
  }
  
  return { valid: true }
}

/**
 * Validate complete barang form data
 */
export function validateBarangForm(data: {
  nama: string
  satuan: string
  jenis?: string
  kategoriAset?: string
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  
  // Validate nama
  const namaValidation = validateBarangNama(data.nama)
  if (!namaValidation.valid && namaValidation.error) {
    errors.nama = namaValidation.error
  }
  
  // Validate satuan
  const satuanValidation = validateBarangSatuan(data.satuan)
  if (!satuanValidation.valid && satuanValidation.error) {
    errors.satuan = satuanValidation.error
  }
  
  // If jenis is ASET, kategoriAset must be provided
  if (data.jenis === 'ASET' && !data.kategoriAset) {
    errors.kategoriAset = 'Kategori aset harus dipilih untuk barang jenis ASET'
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  }
}
