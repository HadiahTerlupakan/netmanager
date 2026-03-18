export const dynamic = "force-dynamic"

import { ensurePermission } from '@/lib/rbac'
import { HolidayClient } from './HolidayClient'

export default async function Page() {
    await ensurePermission('holiday:read')
    return <HolidayClient />
}
