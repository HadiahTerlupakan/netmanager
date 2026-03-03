/**
 * Client-side utility untuk mendapatkan subdomain dan URL lengkap
 * Digunakan di browser/client components
 */

/**
 * Mendapatkan subdomain dari window.location
 */
export function getSubdomainFromWindow(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const hostname = window.location.hostname

  if (!hostname) {
    return null
  }

  // Untuk localhost, Next.js mendukung *.localhost secara native
  if (hostname.includes('localhost')) {
    const parts = hostname.split('.')
    if (parts.length > 1 && parts[0] !== 'localhost') {
      return parts[0] ?? null // admin, pelanggan, dll
    }
    return null // localhost tanpa subdomain
  }

  // Untuk production domain
  const parts = hostname.split('.')

  // Jika hanya 2 bagian (example.com), tidak ada subdomain
  if (parts.length <= 2) {
    return null
  }

  // Ambil subdomain pertama
  return parts[0] ?? null
}

/**
 * Cek apakah saat ini di admin subdomain
 */
export function isAdminSubdomainFromWindow(): boolean {
  const subdomain = getSubdomainFromWindow()
  return subdomain === 'admin' || subdomain === 'admin-staging'
}

/**
 * Cek apakah saat ini di pelanggan subdomain
 */
export function isPelangganSubdomainFromWindow(): boolean {
  const subdomain = getSubdomainFromWindow()
  return subdomain === 'pelanggan' || subdomain === 'pelanggan-staging'
}

/**
 * Mendapatkan URL lengkap dengan subdomain untuk path tertentu
 */
export function getUrlWithSubdomain(path: string): string {
  if (typeof window === 'undefined') {
    return path
  }

  const subdomain = getSubdomainFromWindow()
  const protocol = window.location.protocol
  const port = window.location.port ? `:${window.location.port}` : ''

  // Jika sudah ada subdomain, gunakan subdomain yang sama
  if (subdomain) {
    const hostname = window.location.hostname
    // Jika hostname sudah memiliki subdomain, gunakan hostname yang sama
    if (hostname.startsWith(`${subdomain}.`)) {
      return `${protocol}//${hostname}${port}${path}`
    }
    // Jika belum, tambahkan subdomain
    const baseHostname = hostname.replace(/^[^.]+\./, '') // Hapus subdomain jika ada
    return `${protocol}//${subdomain}.${baseHostname}${port}${path}`
  }

  // Jika tidak ada subdomain, return path relatif (akan tetap di domain yang sama)
  return path
}

/**
 * Mendapatkan URL untuk admin dengan subdomain yang benar
 * @param path Path yang ingin diakses (default: '/admin')
 * @param forceFullUrl Jika true, selalu return URL lengkap meskipun sudah di admin subdomain
 */
export function getAdminUrl(path: string = '/admin', forceFullUrl: boolean = false): string {
  if (typeof window === 'undefined') {
    return path
  }

  const protocol = window.location.protocol
  const hostname = window.location.hostname
  const port = window.location.port ? `:${window.location.port}` : ''

  // Jika sudah di admin subdomain dan tidak force full URL, gunakan path relatif
  if (isAdminSubdomainFromWindow() && !forceFullUrl) {
    return path
  }

  // Jika hostname adalah localhost atau 127.0.0.1, gunakan admin.localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('.localhost')) {
    return `${protocol}//admin.localhost${port}${path}`
  }

  // Untuk custom domain atau production
  const isStaging = hostname.includes('-staging.') || hostname.startsWith('staging.')
  const targetSubdomain = isStaging ? 'admin-staging' : 'admin'

  if (hostname.includes('.')) {
    const parts = hostname.split('.')
    // Jika sudah ada subdomain, ganti dengan targetSubdomain
    if (parts.length > 2) {
      parts[0] = targetSubdomain
      return `${protocol}//${parts.join('.')}${port}${path}`
    }
    // Jika belum ada subdomain, tambahkan targetSubdomain
    return `${protocol}//${targetSubdomain}.${hostname}${port}${path}`
  }

  // Fallback: tambahkan targetSubdomain
  return `${protocol}//${targetSubdomain}.${hostname}${port}${path}`
}

/**
 * Mendapatkan URL untuk pelanggan dengan subdomain yang benar
 */
export function getPelangganUrl(path: string = '/pelanggan'): string {
  if (typeof window === 'undefined') {
    return path
  }

  const protocol = window.location.protocol
  const hostname = window.location.hostname
  const port = window.location.port ? `:${window.location.port}` : ''

  // Jika sudah di pelanggan subdomain, gunakan path relatif
  if (isPelangganSubdomainFromWindow()) {
    return path
  }

  // Jika hostname adalah localhost, gunakan pelanggan.localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('.localhost')) {
    return `${protocol}//pelanggan.localhost${port}${path}`
  }

  // Untuk custom domain atau production
  const isStaging = hostname.includes('-staging.') || hostname.startsWith('staging.')
  const targetSubdomain = isStaging ? 'pelanggan-staging' : 'pelanggan'

  const parts = hostname.split('.')
  if (parts.length > 2) {
    parts[0] = targetSubdomain
    return `${protocol}//${parts.join('.')}${port}${path}`
  }
  return `${protocol}//${targetSubdomain}.${hostname}${port}${path}`
}

