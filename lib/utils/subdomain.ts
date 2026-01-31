import type { NextRequest } from 'next/server'

/**
 * Mendapatkan subdomain dari request
 * Mendukung:
 * - admin.localhost:3000 (development)
 * - pelanggan.localhost:3000 (development)
 * - admin.example.com (production)
 * - pelanggan.example.com (production)
 */
export function getSubdomain(request: NextRequest): string | null {
  const hostname = request.headers.get('host') || request.nextUrl.hostname

  if (!hostname) {
    return null
  }

  // Untuk localhost, Next.js mendukung *.localhost secara native
  // Contoh: admin.localhost, pelanggan.localhost
  if (hostname.includes('localhost')) {
    const parts = hostname.split('.')
    if (parts.length > 1 && parts[0] !== 'localhost') {
      return parts[0] ?? null // admin, pelanggan, dll
    }
    return null // localhost tanpa subdomain
  }

  // Untuk production domain
  // Contoh: admin.example.com -> admin
  //         pelanggan.example.com -> pelanggan
  const parts = hostname.split('.')

  // Jika hanya 2 bagian (example.com), tidak ada subdomain
  if (parts.length <= 2) {
    return null
  }

  // Ambil subdomain pertama
  return parts[0] ?? null
}

/**
 * Check if request is from admin subdomain
 * Examples: admin.localhost, admin.example.com
 */
export function isAdminSubdomain(request: NextRequest): boolean {
  const subdomain = getSubdomain(request)
  return subdomain === 'admin'
}

/**
 * Check if request is from pelanggan subdomain
 * Examples: pelanggan.localhost, pelanggan.example.com
 */
export function isPelangganSubdomain(request: NextRequest): boolean {
  const subdomain = getSubdomain(request)
  return subdomain === 'pelanggan'
}

/**
 * Check if request is from karyawan subdomain
 * Examples: karyawan.localhost, karyawan.example.com
 */
export function isKaryawanSubdomain(request: NextRequest): boolean {
  const subdomain = getSubdomain(request)
  return subdomain === 'karyawan'
}

/**
 * Check if request is from finance subdomain
 * Examples: finance.localhost, finance.example.com
 */
export function isFinanceSubdomain(request: NextRequest): boolean {
  const subdomain = getSubdomain(request)
  return subdomain === 'finance'
}

/**
 * Check if request is from helpdesk subdomain
 * Examples: helpdesk.localhost, helpdesk.example.com
 */
export function isHelpdeskSubdomain(request: NextRequest): boolean {
  const subdomain = getSubdomain(request)
  return subdomain === 'helpdesk'
}

/**
 * Mendapatkan base URL berdasarkan subdomain
 */
export function getBaseUrl(request: NextRequest): string {
  const protocol = request.nextUrl.protocol
  const hostname = request.headers.get('host') || request.nextUrl.hostname

  return `${protocol}//${hostname}`
}

