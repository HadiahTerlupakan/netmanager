
import { ensureEmployeeAccess } from '@/lib/server-auth'
import BarangMasukClient from './BarangMasukClient'

export default async function BarangMasukPage() {
    await ensureEmployeeAccess('k_barang:read')

    return <BarangMasukClient />
}
