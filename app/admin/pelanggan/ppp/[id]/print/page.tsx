import { ensurePermission } from '@/lib/rbac'
import PppPrintClient from './PppPrintClient'

export default async function Page() {
    await ensurePermission('pelanggan:read')
    return <PppPrintClient />
}
