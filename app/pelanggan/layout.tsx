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

export default async function PelangganLayout({ children }: { children: React.ReactNode }) {
  // Catatan: Subdomain routing di-handle oleh middleware
  // Di development, tetap bisa akses langsung dari localhost
  // Di production, bisa enforce subdomain dengan meng-uncomment kode di bawah
  // const headersList = await headers()
  // const host = headersList.get('host') || ''
  // if (host && !host.includes('localhost') && !host.startsWith('pelanggan.')) {
  //   const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  //   redirect(`${protocol}://pelanggan.${host.split(':')[0]}${host.includes(':') ? ':' + host.split(':')[1] : ''}`)
  // }

  // Authentication check moved to client-side in layout-client.tsx
  // Server-side auth check is handled by middleware for API routes

  return (
    <>
      <PWAScript />
      <PelangganLayoutClient>{children}</PelangganLayoutClient>
    </>
  )
}
