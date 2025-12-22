import type { Metadata, Viewport } from 'next'
import { KaryawanProviders } from '@/components/karyawan/KaryawanProviders'

export const metadata: Metadata = {
    title: 'Portal Karyawan | NetManager',
    description: 'Portal untuk karyawan NetManager. Ambil tiket work order, input barang masuk/keluar.',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'Portal Karyawan',
    },
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#2563eb' },
        { media: '(prefers-color-scheme: dark)', color: '#1e40af' },
    ],
}

// NO ensureEmployeeAccess() here - this is for auth pages (login)
export default function KaryawanAuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <KaryawanProviders>
            {children}
        </KaryawanProviders>
    )
}
