import { ensurePermission } from '@/lib/rbac'
import ChatPageClient from './ChatPageClient'

export default async function ChatPage() {
    // Server-side permission check
    await ensurePermission('chat:read')
    
    return <ChatPageClient />
}

export const metadata = {
    title: 'Chat - Admin Portal',
    description: 'Fitur chat untuk komunikasi dengan tim dan broadcast'
}
