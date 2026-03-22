import { describe, it, expect } from 'vitest'
import { investorSchema, investorPayoutSchema } from '@/lib/validations/investor'

describe('Investor Validations', () => {
  describe('investorSchema', () => {
    it('should validate a correct investor object', () => {
      const validInvestor = {
        username: 'investor1',
        password: 'password123',
        namaLengkap: 'Investor Satu',
        email: 'investor@example.com',
        perusahaan: 'PT Investasi Jaya',
        noTelp: '08123456789'
      }
      const result = investorSchema.safeParse(validInvestor)
      expect(result.success).toBe(true)
    })

    it('should allow optional password', () => {
      const investorNoPass = {
        username: 'investor2',
        namaLengkap: 'Investor Dua',
        email: 'investor2@example.com'
      }
      const result = investorSchema.safeParse(investorNoPass)
      expect(result.success).toBe(true)
    })

    it('should fail if required fields are missing', () => {
      const invalidInvestor = {
        username: 'inv'
        // missing namaLengkap and email
      }
      const result = investorSchema.safeParse(invalidInvestor)
      expect(result.success).toBe(false)
      if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors
        expect(fieldErrors.namaLengkap).toBeDefined()
        expect(fieldErrors.email).toBeDefined()
      }
    })

    it('should fail for invalid email format', () => {
      const invalidEmail = {
        username: 'investor3',
        namaLengkap: 'Investor Tiga',
        email: 'not-an-email'
      }
      const result = investorSchema.safeParse(invalidEmail)
      expect(result.success).toBe(false)
    })
  })

  describe('investorPayoutSchema', () => {
    it('should validate a correct payout object', () => {
      const validPayout = {
        investorId: 'cl-12345',
        amount: 1000000,
        date: '2023-10-27',
        bankName: 'BCA',
        accountNumber: '1234567890',
        accountName: 'Investor Satu',
        status: 'PENDING'
      }
      const result = investorPayoutSchema.safeParse(validPayout)
      expect(result.success).toBe(true)
    })

    it('should fail if amount is zero or negative', () => {
      const invalidPayout = {
        investorId: 'cl-12345',
        amount: 0,
        date: '2023-10-27',
        bankName: 'BCA',
        accountNumber: '1234567890',
        accountName: 'Investor Satu'
      }
      const result = investorPayoutSchema.safeParse(invalidPayout)
      expect(result.success).toBe(false)
    })

    it('should coerce date string to Date object', () => {
      const payout = {
        investorId: 'cl-12345',
        amount: 500000,
        date: '2023-10-27T10:00:00Z',
        bankName: 'Mandiri',
        accountNumber: '0987654321',
        accountName: 'Investor Satu'
      }
      const result = investorPayoutSchema.safeParse(payout)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.date).toBeInstanceOf(Date)
      }
    })

    it('should use PENDING as default status', () => {
      const payoutNoStatus = {
        investorId: 'cl-12345',
        amount: 500000,
        date: new Date(),
        bankName: 'Mandiri',
        accountNumber: '0987654321',
        accountName: 'Investor Satu'
      }
      const result = investorPayoutSchema.safeParse(payoutNoStatus)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('PENDING')
      }
    })
  })
})
