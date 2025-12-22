
import { ensureEmployeeAccess } from '@/lib/server-auth'
import RiwayatBarangClient from './RiwayatBarangClient'

export default async function RiwayatBarangPage() {
    await ensureEmployeeAccess('k_barang:read')

    return <RiwayatBarangClient />
}
