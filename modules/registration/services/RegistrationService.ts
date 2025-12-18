import type { Registration } from '@prisma/client'
import { RegistrationStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { RegistrationRepository } from '../repositories/RegistrationRepository'

export interface RegistrationInput {
    name: string
    email: string
    phone: string
    address: string
    location?: string
    packageName?: string
    notes?: string
    ipAddress?: string
    turnstileToken?: string
}

export interface RegistrationResult {
    success: boolean
    data?: Registration
    error?: string
    statusCode?: number
}

export class RegistrationService {
    private repository: RegistrationRepository

    constructor() {
        this.repository = new RegistrationRepository()
    }

    /**
     * Mendaftarkan pelanggan baru
     */
    async register(input: RegistrationInput): Promise<RegistrationResult> {
        // 1. Validasi input wajib
        const validationError = this.validateInput(input)
        if (validationError) {
            return { success: false, error: validationError, statusCode: 400 }
        }

        // 2. Cek duplikat (status PENDING)
        const duplicate = await this.repository.findByEmailOrPhone(
            input.email,
            input.phone,
            RegistrationStatus.PENDING
        )
        if (duplicate) {
            return {
                success: false,
                error: 'Email atau Nomor HP ini sudah terdaftar dan sedang menunggu verifikasi.',
                statusCode: 409
            }
        }

        // 3. Verifikasi Captcha (jika diaktifkan)
        const captchaResult = await this.verifyCaptcha(input.turnstileToken, input.ipAddress)
        if (!captchaResult.success) {
            return captchaResult
        }

        // 4. Simpan ke database
        try {
            const registration = await this.repository.create({
                name: input.name,
                email: input.email,
                phone: input.phone,
                address: input.address,
                location: input.location,
                packageName: input.packageName,
                notes: input.notes,
                ipAddress: input.ipAddress,
                status: RegistrationStatus.PENDING
            })

            return { success: true, data: registration }
        } catch (error: any) {
            console.error('[RegistrationService] Error creating registration:', error)
            return {
                success: false,
                error: 'Terjadi kesalahan saat menyimpan data.',
                statusCode: 500
            }
        }
    }

    /**
     * Validasi input wajib
     */
    private validateInput(input: RegistrationInput): string | null {
        if (!input.name?.trim()) return 'Nama wajib diisi.'
        if (!input.email?.trim()) return 'Email wajib diisi.'
        if (!input.phone?.trim()) return 'Nomor HP wajib diisi.'
        if (!input.address?.trim()) return 'Alamat wajib diisi.'

        // Validasi format email sederhana
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(input.email)) {
            return 'Format email tidak valid.'
        }

        return null
    }

    /**
     * Verifikasi Cloudflare Turnstile Captcha
     */
    private async verifyCaptcha(
        token?: string,
        ipAddress?: string
    ): Promise<RegistrationResult> {
        // Cek apakah captcha diaktifkan
        const captchaEnabledSetting = await prisma.settings.findUnique({
            where: { key: 'captcha_enabled' }
        })
        const captchaEnabled = captchaEnabledSetting?.value === 'true'

        if (!captchaEnabled) {
            return { success: true } // Captcha tidak aktif, skip
        }

        if (!token) {
            return {
                success: false,
                error: 'Verifikasi keamanan (Captcha) wajib diisi.',
                statusCode: 400
            }
        }

        // Ambil secret key
        const captchaSecretSetting = await prisma.settings.findUnique({
            where: { key: 'captcha_secret_key' }
        })
        const secretKey = captchaSecretSetting?.value

        if (!secretKey) {
            console.warn('[RegistrationService] Captcha enabled but no secret key configured')
            return { success: true } // Tidak ada secret key, anggap sukses (misconfigured)
        }

        // Verifikasi ke Cloudflare
        try {
            const formData = new FormData()
            formData.append('secret', secretKey)
            formData.append('response', token)
            if (ipAddress) formData.append('remoteip', ipAddress)

            const response = await fetch(
                'https://challenges.cloudflare.com/turnstile/v0/siteverify',
                { method: 'POST', body: formData }
            )
            const outcome = await response.json()

            if (!outcome.success) {
                return {
                    success: false,
                    error: 'Verifikasi Captcha gagal. Silakan coba lagi.',
                    statusCode: 400
                }
            }

            return { success: true }
        } catch (error) {
            console.error('[RegistrationService] Captcha verification error:', error)
            return {
                success: false,
                error: 'Gagal memverifikasi captcha.',
                statusCode: 500
            }
        }
    }
}
