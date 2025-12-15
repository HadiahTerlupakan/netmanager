import type { Metadata, Viewport } from 'next'
import { CustomerAuthProvider } from '@/components/customer/CustomerAuthProvider'
import BottomNav from '@/components/customer/BottomNav'
import '../globals.css'

export const metadata: Metadata = {
    title: 'Portal Pelanggan | NetManager',
    description: 'Portal self-service untuk pelanggan NetManager. Cek tagihan, status koneksi, dan kelola akun Anda.',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'NetManager',
    },
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#0d9488' },
        { media: '(prefers-color-scheme: dark)', color: '#115e59' },
    ],
}

export default function CustomerLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <CustomerAuthProvider>
            <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
                {/* Status bar gradient overlay for iOS */}
                <div className="fixed top-0 left-0 right-0 h-12 bg-gradient-to-b from-white/80 to-transparent dark:from-slate-900/80 pointer-events-none z-40" />

                <main className="relative pb-24 min-h-screen">
                    {children}
                </main>

                <BottomNav />
            </div>
        </CustomerAuthProvider>
    )
}
