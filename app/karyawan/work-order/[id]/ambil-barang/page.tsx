
import { ensureEmployeeAccess } from '@/lib/server-auth'
import AmbilBarangClient from './AmbilBarangClient'

export default async function AmbilBarangPage() {
    await ensureEmployeeAccess('k_barang:read')

    return <AmbilBarangClient />
}
