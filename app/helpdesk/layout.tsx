import type { Metadata, Viewport } from 'next'
import ClientLayout from './ClientLayout'

export const metadata: Metadata = {
    title: 'NetManager Helpdesk Portal',
    description: 'Technician and Support Portal for NetManager',
}

export const viewport: Viewport = {
    themeColor: '#3b82f6',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
}

export default function HelpdeskLayout({ children }: { children: React.ReactNode }) {
    return <ClientLayout>{children}</ClientLayout>
}
