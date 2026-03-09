import { ensureAdminAccess } from '@/lib/server-auth'

import MobileErrorLogClient from './MobileErrorLogClient'

export default async function MobileErrorLogPage() {
    await ensureAdminAccess('system_log:read')

    return <MobileErrorLogClient />
}
