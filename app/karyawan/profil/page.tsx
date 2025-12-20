import { ensureEmployeeAccess } from '@/lib/server-auth'
import ProfilClient from './ProfilClient'

export const metadata = {
    title: 'Profil | Portal Karyawan',
}

export default async function ProfilPage() {
    await ensureEmployeeAccess('k_profil:read')
    return <ProfilClient />
}
