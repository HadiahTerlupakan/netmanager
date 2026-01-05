import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './UsersDetailClient'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>, searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const { id } = await params
    const session = await getServerSession(authConfig)
    
    // Check if user is viewing their own profile
    const isOwnProfile = session?.user?.id === id

    // If not own profile, enforce permission
    if (!isOwnProfile) {
        await ensurePermission('users:read')
    } else if (!session?.user) {
        // If no session at all, redirect to login
        redirect('/login')
    }

    return <ClientComponent params={params} searchParams={searchParams} />
}
