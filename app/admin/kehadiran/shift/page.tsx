import { ensurePermission } from "@/lib/rbac"
import ShiftClient from "./ShiftClient"

export default async function ShiftPage() {
    await ensurePermission('shift:read')
    return <ShiftClient />
}
