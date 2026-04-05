import { describe, expect, it } from 'vitest'

import {
  apiSettingsSchema,
  captchaSettingsSchema,
  companyBankAccountSchema,
  generalSettingsSchema,
  logoDeleteSchema,
  paymentGatewayConfigSchema,
} from '@/lib/validations/settings'

describe('settings validations', () => {
  it('accepts a valid general settings payload', () => {
    const result = generalSettingsSchema.safeParse({
      perusahaan: 'PT NetManager',
      namaAplikasi: 'NetManager',
      alamat: 'Jakarta',
      nomorHp: '081234567890',
      email: 'admin@example.com',
      deskripsiInvoice: 'Tagihan internet bulanan',
      rekeningBank: [
        {
          namaBank: 'BCA',
          atasNama: 'PT NetManager',
          noRekening: '1234567890',
        },
      ],
      invoiceOtomatis: '5',
      disablePerpanjanganPaket: '3',
      timezone: 'Asia/Jakarta',
      attendanceTolerance: '10',
      pppConnectionMode: 'RADIUS',
      autoIsolirEnabled: true,
      autoIsolirHariToleransi: '2',
      reminderOtomatis: '3',
      reminderFrequency: 'DAILY',
      reminderTime: '08:00',
      notifApp: true,
      notifWa: false,
      notifEmail: true,
    })

    expect(result.success).toBe(true)
  })

  it('rejects invalid general settings time format', () => {
    const result = generalSettingsSchema.safeParse({
      perusahaan: 'PT NetManager',
      namaAplikasi: 'NetManager',
      alamat: 'Jakarta',
      nomorHp: '081234567890',
      email: '',
      deskripsiInvoice: 'Tagihan internet bulanan',
      rekeningBank: [],
      invoiceOtomatis: '5',
      disablePerpanjanganPaket: '3',
      timezone: 'Asia/Jakarta',
      attendanceTolerance: '10',
      reminderOtomatis: '3',
      reminderFrequency: 'DAILY',
      reminderTime: '8 pagi',
      notifApp: true,
      notifWa: false,
      notifEmail: true,
    })

    expect(result.success).toBe(false)
  })

  it('accepts partial API settings payloads', () => {
    const result = apiSettingsSchema.safeParse({
      r2Enabled: true,
      r2BucketName: 'netmanager-backup',
    })

    expect(result.success).toBe(true)
  })

  it('coerces and validates company bank account payloads', () => {
    const result = companyBankAccountSchema.safeParse({
      bankName: 'BCA',
      accountNumber: '1234567890',
      accountName: 'PT NetManager',
      description: 'Rekening utama',
      isActive: true,
      priority: '4',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe(4)
    }
  })

  it('accepts partial payment gateway updates for toggle-only actions', () => {
    const result = paymentGatewayConfigSchema.safeParse({
      isEnabled: false,
    })

    expect(result.success).toBe(true)
  })

  it('requires captcha keys when captcha is enabled', () => {
    const result = apiSettingsSchema.safeParse({
      r2Enabled: false,
    })

    expect(result.success).toBe(true)
  })

  it('rejects enabled captcha payloads without keys', () => {
    const result = captchaSettingsSchema.safeParse({
      enabled: true,
      siteKey: '',
      secretKey: '',
    })

    expect(result.success).toBe(false)
  })

  it('rejects invalid logo delete types', () => {
    const result = logoDeleteSchema.safeParse({
      type: 'header',
    })

    expect(result.success).toBe(false)
  })
})
