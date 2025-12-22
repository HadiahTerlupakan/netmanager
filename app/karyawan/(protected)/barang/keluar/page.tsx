
import { ensureEmployeeAccess } from '@/lib/server-auth'
import BarangKeluarClient from './BarangKeluarClient'

export default async function BarangKeluarPage() {
    await ensureEmployeeAccess('k_barang:read')

    return <BarangKeluarClient />
}
