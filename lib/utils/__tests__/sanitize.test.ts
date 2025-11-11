import { describe, it, expect } from 'vitest'
import {
  sanitizeHtml,
  sanitizeText,
  sanitizeInput,
  sanitizeRichText,
  sanitizeObject,
  escapeHtml,
} from '../sanitize'

describe('sanitize utilities', () => {
  describe('sanitizeHtml', () => {
    it('should remove all HTML tags', () => {
      const input = '<script>alert("XSS")</script><p>Hello</p>'
      const result = sanitizeHtml(input)
      // sanitizeHtml dengan default config akan menghapus semua tags
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('<p>')
    })

    it('should handle null and undefined', () => {
      expect(sanitizeHtml(null)).toBe('')
      expect(sanitizeHtml(undefined)).toBe('')
    })

    it('should handle empty string', () => {
      expect(sanitizeHtml('')).toBe('')
    })
  })

  describe('sanitizeText', () => {
    it('should remove all HTML tags', () => {
      const input = '<script>alert("XSS")</script>Hello World'
      const result = sanitizeText(input)
      expect(result).toBe('Hello World')
    })

    it('should handle XSS attempts', () => {
      const xssAttempts = [
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<body onload=alert(1)>',
      ]

      xssAttempts.forEach((attempt) => {
        const result = sanitizeText(attempt)
        expect(result).not.toContain('<script')
        expect(result).not.toContain('onerror')
        expect(result).not.toContain('onload')
      })
    })

    it('should handle null and undefined', () => {
      expect(sanitizeText(null)).toBe('')
      expect(sanitizeText(undefined)).toBe('')
    })
  })

  describe('sanitizeInput', () => {
    it('should remove HTML but preserve content', () => {
      const input = '<p>Hello</p><br>World'
      const result = sanitizeInput(input)
      expect(result).not.toContain('<p>')
      expect(result).not.toContain('<br>')
    })

    it('should handle null and undefined', () => {
      expect(sanitizeInput(null)).toBe('')
      expect(sanitizeInput(undefined)).toBe('')
    })
  })

  describe('sanitizeRichText', () => {
    it('should allow safe HTML tags', () => {
      const input = '<p>Hello</p><strong>World</strong><script>alert(1)</script>'
      const result = sanitizeRichText(input)
      expect(result).toContain('<p>')
      expect(result).toContain('<strong>')
      expect(result).not.toContain('<script>')
    })

    it('should remove dangerous attributes', () => {
      const input = '<a href="javascript:alert(1)">Link</a>'
      const result = sanitizeRichText(input)
      expect(result).not.toContain('javascript:')
    })

    it('should handle null and undefined', () => {
      expect(sanitizeRichText(null)).toBe('')
      expect(sanitizeRichText(undefined)).toBe('')
    })
  })

  describe('sanitizeObject', () => {
    it('should sanitize string values in object', () => {
      const input = {
        name: '<script>alert(1)</script>Hello',
        age: 25,
        email: 'test@example.com',
      }
      const result = sanitizeObject(input)
      expect(result.name).toBe('Hello')
      expect(result.age).toBe(25)
      expect(result.email).toBe('test@example.com')
    })

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: '<script>alert(1)</script>John',
          profile: {
            bio: '<p>Bio</p>',
          },
        },
      }
      const result = sanitizeObject(input, true)
      expect(result.user.name).not.toContain('<script>')
      expect(result.user.profile.bio).not.toContain('<p>')
    })

    it('should handle arrays', () => {
      const input = {
        tags: ['<script>alert(1)</script>tag1', 'tag2'],
      }
      const result = sanitizeObject(input, true)
      expect(result.tags[0]).not.toContain('<script>')
      expect(result.tags[1]).toBe('tag2')
    })

    it('should handle null and undefined', () => {
      expect(sanitizeObject(null)).toBe(null)
      expect(sanitizeObject(undefined)).toBe(undefined)
    })
  })

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const input = '<script>alert("XSS")</script>'
      const result = escapeHtml(input)
      expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;')
    })

    it('should escape all special characters', () => {
      const input = '&<>"\''
      const result = escapeHtml(input)
      expect(result).toBe('&amp;&lt;&gt;&quot;&#039;')
    })

    it('should handle null and undefined', () => {
      expect(escapeHtml(null)).toBe('')
      expect(escapeHtml(undefined)).toBe('')
    })
  })
})

