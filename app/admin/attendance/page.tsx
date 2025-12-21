import { ensurePermission } from '@/lib/rbac'
import { AttendanceClient } from './AttendanceClient'

export default async function AttendancePage() {
    await ensurePermission('attendance:read')
    return <AttendanceClient />
}
