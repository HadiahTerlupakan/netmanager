/**
 * XSS Prevention Utilities
 * 
 * Menggunakan DOMPurify untuk sanitize user input dan output
 * Mencegah XSS (Cross-Site Scripting) attacks
 */

import DOMPurify from 'isomorphic-dompurify'

/**
 * Sanitize HTML string untuk mencegah XSS
 * 
 * @param dirty - String yang perlu di-sanitize
 * @param options - Opsi sanitization (optional)
 * @returns String yang sudah di-sanitize
 */
export function sanitizeHtml(dirty: string | null | undefined, options?: {
  allowedTags?: string[]
  allowedAttributes?: Record<string, string[]>
}): string {
  if (!dirty || typeof dirty !== 'string') {
    return ''
  }

  const defaultConfig = {
    ALLOWED_TAGS: options?.allowedTags || [],
    ALLOWED_ATTR: options?.allowedAttributes ? Object.values(options.allowedAttributes).flat() : [],
  }

  return DOMPurify.sanitize(dirty, defaultConfig)
}

/**
 * Sanitize plain text (menghapus semua HTML tags)
 * 
 * @param dirty - String yang perlu di-sanitize
 * @returns Plain text tanpa HTML tags
 */
export function sanitizeText(dirty: string | null | undefined): string {
  if (!dirty || typeof dirty !== 'string') {
    return ''
  }

  // Hapus semua HTML tags
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] })
}

/**
 * Sanitize untuk input form (text, textarea)
 * Menghapus HTML tags tapi tetap allow line breaks
 * 
 * @param dirty - String yang perlu di-sanitize
 * @returns Sanitized text dengan line breaks preserved
 */
export function sanitizeInput(dirty: string | null | undefined): string {
  if (!dirty || typeof dirty !== 'string') {
    return ''
  }

  // Allow hanya line breaks, hapus semua HTML lainnya
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true,
  })
}

/**
 * Sanitize untuk rich text editor (allow beberapa HTML tags)
 * 
 * @param dirty - String yang perlu di-sanitize
 * @returns Sanitized HTML dengan tags yang aman
 */
export function sanitizeRichText(dirty: string | null | undefined): string {
  if (!dirty || typeof dirty !== 'string') {
    return ''
  }

  // Allow tags yang aman untuk rich text
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  })
}

/**
 * Sanitize object dengan recursive sanitization
 * Berguna untuk sanitize data dari API response
 * 
 * @param obj - Object yang perlu di-sanitize
 * @param deep - Apakah perlu deep sanitization (default: true)
 * @returns Object yang sudah di-sanitize
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  deep: boolean = true
): T {
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  const sanitized = { ...obj }

  for (const key in sanitized) {
    if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
      const value = sanitized[key]

      if (typeof value === 'string') {
        // Sanitize string values
        (sanitized as Record<string, unknown>)[key] = sanitizeText(value)
      } else if (deep && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursive sanitization untuk nested objects
        (sanitized as Record<string, unknown>)[key] = sanitizeObject(value as Record<string, unknown>, deep)
      } else if (deep && Array.isArray(value)) {
        // Sanitize array items
        (sanitized as Record<string, unknown>)[key] = value.map((item: unknown) => {
          if (typeof item === 'string') {
            return sanitizeText(item)
          } else if (typeof item === 'object' && item !== null) {
            return sanitizeObject(item as Record<string, unknown>, deep)
          }
          return item
        })
      }
    }
  }

  return sanitized
}

/**
 * Escape HTML special characters
 * Alternatif untuk sanitize jika tidak perlu HTML sama sekali
 * 
 * @param text - Text yang perlu di-escape
 * @returns Escaped text
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') {
    return ''
  }

  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }

  return text.replace(/[&<>"']/g, (m) => map[m] ?? m)
}

