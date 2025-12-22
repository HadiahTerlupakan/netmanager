import { ensureEmployeeAccess } from '@/lib/server-auth'
import BarangIndexClient from './BarangIndexClient'

export const metadata = {
    title: 'Barang | Portal Karyawan',
}

export default async function BarangPage() {
    await ensureEmployeeAccess('k_barang:read')
    return <BarangIndexClient />
}
