import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './UsersDetailClient'

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>, searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
    await ensurePermission('users:read')
    return <ClientComponent params={params} searchParams={searchParams} />
}
