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
      return parts[0] // admin, pelanggan, dll
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
  return parts[0]
}

/**
 * Cek apakah request berasal dari subdomain admin
 */
export function isAdminSubdomain(request: NextRequest): boolean {
  const subdomain = getSubdomain(request)
  return subdomain === 'admin'
}

/**
 * Cek apakah request berasal dari subdomain pelanggan
 */
export function isPelangganSubdomain(request: NextRequest): boolean {
  const subdomain = getSubdomain(request)
  return subdomain === 'pelanggan'
}

/**
 * Cek apakah request berasal dari subdomain finance
 */
export function isFinanceSubdomain(request: NextRequest): boolean {
  const subdomain = getSubdomain(request)
  return subdomain === 'finance'
}

/**
 * Mendapatkan base URL berdasarkan subdomain
 */
export function getBaseUrl(request: NextRequest): string {
  const protocol = request.nextUrl.protocol
  const hostname = request.headers.get('host') || request.nextUrl.hostname
  
  return `${protocol}//${hostname}`
}

