import { describe, it, expect } from 'vitest'
import { AppError, ValidationError, RadiusConnectionError } from '@/lib/errors'

describe('AppError', () => {
  it('should set statusCode and code correctly', () => {
    const err = new AppError('Test', 418, 'TEST_CODE')
    expect(err.statusCode).toBe(418)
    expect(err.code).toBe('TEST_CODE')
    expect(err.name).toBe('AppError')
  })
})

describe('ValidationError', () => {
  it('should have statusCode 400', () => {
    const err = new ValidationError()
    expect(err.statusCode).toBe(400)
    expect(err.code).toBe('VALIDATION_ERROR')
  })
})

describe('RadiusConnectionError', () => {
  it('should have statusCode 503', () => {
    const err = new RadiusConnectionError()
    expect(err.statusCode).toBe(503)
    expect(err.code).toBe('RADIUS_CONNECTION_ERROR')
  })
})
