import type { Metadata, Viewport } from 'next'
import ClientLayout from './ClientLayout'

export const metadata: Metadata = {
    title: 'NetManager Employee Portal',
    description: 'Employee self-service portal for NetManager HRIS',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'NetManager Employee',
    },
}

export const viewport: Viewport = {
    themeColor: '#6366f1',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
}

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
    return <ClientLayout>{children}</ClientLayout>
}
