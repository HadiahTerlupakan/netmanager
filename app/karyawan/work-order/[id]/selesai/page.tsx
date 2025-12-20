
import { ensureEmployeeAccess } from '@/lib/server-auth'
import SelesaiClient from './SelesaiClient'

export default async function SelesaiPage() {
    await ensureEmployeeAccess('k_work_order:read')

    return <SelesaiClient />
}
