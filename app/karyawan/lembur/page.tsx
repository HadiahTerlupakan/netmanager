import { ensureEmployeeAccess } from '@/lib/server-auth'
import LemburClient from './LemburClient'

export const metadata = {
    title: 'Lembur | Portal Karyawan',
}

export default async function LemburPage() {
    await ensureEmployeeAccess('k_absensi:read')
    return <LemburClient />
}
