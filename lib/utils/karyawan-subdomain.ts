/**
 * Client-side subdomain helper untuk employee portal
 * Digunakan untuk redirect atau generate URL ke karyawan.localhost
 */

/**
 * Get employee portal URL
 * Returns karyawan.localhost URL in development
 */
export function getKaryawanPortalUrl(path: string = '/'): string {
    if (typeof window === 'undefined') {
        return path
    }

    const protocol = window.location.protocol
    const hostname = window.location.hostname
    const port = window.location.port ? `:${window.location.port}` : ''

    // Jika hostname adalah localhost, gunakan karyawan.localhost
    if (hostname === 'localhost' || hostname.includes('.localhost')) {
        return `${protocol}//karyawan.localhost${port}${path}`
    }

    // Untuk production, gunakan subdomain karyawan
    // Contoh: example.com -> karyawan.example.com
    const parts = hostname.split('.')
    if (parts.length >= 2) {
        // Jika sudah ada subdomain, replace dengan karyawan
        if (parts.length > 2) {
            parts[0] = 'karyawan'
            return `${protocol}//${parts.join('.')}${port}${path}`
        }
        // Jika tidak ada subdomain, tambahkan karyawan
        return `${protocol}//karyawan.${hostname}${port}${path}`
    }

    // Fallback
    return path
}

/**
 * Redirect to employee portal
 */
export function redirectToKaryawanPortal(path: string = '/') {
    if (typeof window !== 'undefined') {
        window.location.href = getKaryawanPortalUrl(path)
    }
}

/**
 * Check if currently on karyawan subdomain
 */
export function isOnKaryawanSubdomain(): boolean {
    if (typeof window === 'undefined') {
        return false
    }

    const hostname = window.location.hostname
    return hostname.startsWith('karyawan.')
}
