import { redirect } from 'next/navigation'
import type { Metadata, Viewport } from 'next'
import PWAScript from './pwa-script'
import PelangganLayoutClient from './layout-client'

export const metadata: Metadata = {
  title: 'Portal Pelanggan - NetManager',
  description: 'Portal pelanggan untuk melihat informasi paket internet, tagihan, dan status layanan',
  manifest: '/pelanggan-manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NetManager',
  },
  icons: {
    icon: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'NetManager',
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#0ea5e9', // Sky blue theme color (fresh)
}

export default function PelangganLayout({ children }: { children: React.ReactNode }) {
  // TODO: Cek apakah user sudah login sebagai pelanggan
  // Jika belum login dan bukan di halaman login, redirect ke login
  // const token = cookies().get('pelanggan_token')
  // const pathname = usePathname()
  // if (!token && pathname !== '/pelanggan/login') {
  //   redirect('/pelanggan/login')
  // }

  return (
    <>
      <PWAScript />
      <PelangganLayoutClient>{children}</PelangganLayoutClient>
    </>
  )
}

