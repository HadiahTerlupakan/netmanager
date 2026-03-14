import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './UsersNewClient'

import { Suspense } from 'react'

export default async function Page() {
    await ensurePermission('users:create')
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ClientComponent />
        </Suspense>
    )
}
