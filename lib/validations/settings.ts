import * as z from 'zod'

export const logoTypeSchema = z.enum(['invoice', 'aplikasi'])

export const bankAccountSchema = z.object({
  id: z.string().min(1).optional(),
  namaBank: z.string().min(1, 'Nama bank wajib diisi'),
  atasNama: z.string().min(1, 'Atas nama wajib diisi'),
  noRekening: z.string().min(1, 'Nomor rekening wajib diisi'),
})

export const generalSettingsSchema = z.object({
  perusahaan: z.string(),
  namaAplikasi: z.string().min(1, 'Nama aplikasi wajib diisi'),
  alamat: z.string(),
  nomorHp: z.string(),
  email: z.union([z.string().email('Format email tidak valid'), z.literal('')]),
  deskripsiInvoice: z.string(),
  rekeningBank: z.array(bankAccountSchema),
  invoiceOtomatis: z.string().min(1, 'Invoice otomatis wajib diisi'),
  disablePerpanjanganPaket: z.string().min(1, 'Batas disable perpanjangan wajib diisi'),
  timezone: z.string().min(1, 'Timezone wajib diisi'),
  attendanceTolerance: z.string().min(1, 'Toleransi kehadiran wajib diisi'),
  pppConnectionMode: z.enum(['RADIUS', 'MIKROTIK_API']).optional(),
  autoIsolirEnabled: z.boolean().optional(),
  autoIsolirHariToleransi: z.string().min(1, 'Hari toleransi isolir wajib diisi').optional(),
  reminderOtomatis: z.string().min(1, 'Reminder otomatis wajib diisi'),
  reminderFrequency: z.enum(['ONCE', 'DAILY']),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format jam harus HH:mm'),
  notifApp: z.boolean(),
  notifWa: z.boolean(),
  notifEmail: z.boolean(),
})

export const apiSettingsSchema = z.object({
  googleGeminiApiKey: z.string().optional(),
  geminiEnabled: z.boolean().optional(),
  r2AccountId: z.string().optional(),
  r2AccessKeyId: z.string().optional(),
  r2SecretAccessKey: z.string().optional(),
  r2BucketName: z.string().optional(),
  r2PublicUrl: z.string().optional(),
  r2Enabled: z.boolean().optional(),
})

export const googleGeminiTestSchema = z.object({
  apiKey: z.string().trim().min(1, 'API Key wajib diisi'),
})

export const r2ConnectionTestSchema = z.object({
  accountId: z.string().trim().min(1, 'Account ID wajib diisi'),
  accessKeyId: z.string().trim().min(1, 'Access Key ID wajib diisi'),
  secretAccessKey: z.string().trim().min(1, 'Secret Access Key wajib diisi'),
  bucketName: z.string().trim().min(1, 'Bucket Name wajib diisi'),
  publicUrl: z.string().optional(),
})

export const captchaSettingsSchema = z.object({
  enabled: z.boolean(),
  siteKey: z.string().optional().default(''),
  secretKey: z.string().optional().default(''),
}).superRefine((value, ctx) => {
  if (!value.enabled) {
    return
  }

  if (!value.siteKey.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['siteKey'],
      message: 'Site key wajib diisi saat captcha aktif',
    })
  }

  if (!value.secretKey.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['secretKey'],
      message: 'Secret key wajib diisi saat captcha aktif',
    })
  }
})

export const logoDeleteSchema = z.object({
  type: logoTypeSchema,
})

export const ringtoneSettingsSchema = z.object({
  enabled: z.boolean(),
  soundType: z.enum(['default', 'custom']),
  customSoundData: z.string().nullable().optional(),
  customSoundName: z.string().nullable().optional(),
})

export const companyBankAccountSchema = z.object({
  bankName: z.string().min(1, 'Nama bank wajib diisi'),
  accountNumber: z.string().min(1, 'Nomor rekening wajib diisi'),
  accountName: z.string().min(1, 'Nama pemilik rekening wajib diisi'),
  description: z.string().optional().default(''),
  isActive: z.boolean().optional().default(true),
  priority: z.coerce.number().int().min(1).max(10).optional().default(1),
})

export const paymentGatewayConfigSchema = z.object({
  isEnabled: z.boolean().optional(),
  isProduction: z.boolean().optional(),
  priority: z.coerce.number().int().min(0).optional(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  clientKey: z.string().optional(),
  merchantId: z.string().optional(),
  settings: z.unknown().optional().nullable(),
})

export const acsSettingsSchema = z.object({
  genieAcsUrl: z.string().min(1, 'GenieACS URL wajib diisi'),
  appName: z.string().default('SolusiDigitalNet'),
  vpPppoeUsername: z.string().min(1, 'Parameter PPPoE wajib diisi'),
  vpRxPower: z.string().min(1, 'Parameter RX Power wajib diisi'),
  vpActiveDevices: z.string().min(1, 'Parameter active devices wajib diisi'),
  vpWanBridge: z.string().min(1, 'Parameter WAN Bridge wajib diisi'),
  vpTemperature: z.string().min(1, 'Parameter suhu wajib diisi'),
  vpSuperAdmin: z.string().min(1, 'Parameter super admin wajib diisi'),
  vpSuperPassword: z.string().min(1, 'Parameter super password wajib diisi'),
  vpUserAdmin: z.string().min(1, 'Parameter user admin wajib diisi'),
  vpUserPassword: z.string().min(1, 'Parameter user password wajib diisi'),
  rxPowerExcellent: z.coerce.number(),
  rxPowerFair: z.coerce.number(),
  deviceDataInterval: z.coerce.number().positive(),
  mappingDataInterval: z.coerce.number().positive(),
  dashboardDataInterval: z.coerce.number().positive(),
  deviceStatusInterval: z.coerce.number().positive(),
  deviceOnlineThreshold: z.coerce.number().positive(),
  portalApiKey: z.string().optional().default(''),
  telegramBotToken: z.string().optional().default(''),
  telegramChatIds: z.string().optional().default(''),
  telegramBotEnabled: z.boolean().optional().default(false),
})

export const acsVendorSchema = z.object({
  name: z.string().min(1, 'Nama vendor wajib diisi'),
  manufacturerPatterns: z.string().min(1, 'Manufacturer patterns wajib diisi'),
  productPatterns: z.string().min(1, 'Product patterns wajib diisi'),
  parameterPrefix: z.string().optional().nullable(),
  priority: z.coerce.number().int().optional().default(10),
  enabled: z.boolean().optional().default(true),
  description: z.string().optional().nullable(),
})

export const acsWifiSecuritySchema = z.object({
  productClass: z.string().min(1, 'Product class wajib diisi'),
  parameterPath: z.string().min(1, 'Parameter path wajib diisi'),
  wpaTypes: z.string().optional().nullable(),
  encryptTypes: z.string().optional().nullable(),
})

export const acsTestUrlSchema = z.object({
  url: z.string().url('URL ACS tidak valid'),
})

export type GeneralSettingsInput = z.infer<typeof generalSettingsSchema>
export type ApiSettingsInput = z.infer<typeof apiSettingsSchema>
export type CaptchaSettingsInput = z.infer<typeof captchaSettingsSchema>
export type LogoDeleteInput = z.infer<typeof logoDeleteSchema>
export type LogoTypeInput = z.infer<typeof logoTypeSchema>
export type CompanyBankAccountInput = z.infer<typeof companyBankAccountSchema>
export type PaymentGatewayConfigInput = z.infer<typeof paymentGatewayConfigSchema>
export type AcsSettingsInput = z.infer<typeof acsSettingsSchema>
export type AcsVendorInput = z.infer<typeof acsVendorSchema>
export type AcsWifiSecurityInput = z.infer<typeof acsWifiSecuritySchema>
export type AcsTestUrlInput = z.infer<typeof acsTestUrlSchema>
export type RingtoneSettingsInput = z.infer<typeof ringtoneSettingsSchema>
export type GoogleGeminiTestInput = z.infer<typeof googleGeminiTestSchema>
export type R2ConnectionTestInput = z.infer<typeof r2ConnectionTestSchema>
