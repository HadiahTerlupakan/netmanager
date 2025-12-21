import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './CaptchaClient'

export default async function Page() {
    await ensurePermission('captcha:read')
    return <ClientComponent />
}
