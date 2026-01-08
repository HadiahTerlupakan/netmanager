import type { Metadata } from 'next'
import RingtoneSettingsClient from './RingtoneSettingsClient'
import { ensurePermission } from '@/lib/rbac'

export const metadata: Metadata = {
    title: 'Pengaturan Nada Dering | NetManager',
    description: 'Atur preferensi suara notifikasi chat',
}

export default async function RingtoneSettingsPage() {
    await ensurePermission('nada_dering:read')
    return <RingtoneSettingsClient />
}
