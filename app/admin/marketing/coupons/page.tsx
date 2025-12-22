import { ensurePermission } from '@/lib/rbac'
import CouponList from './CouponList'

export const metadata = {
    title: 'Manajemen Kupon - Admin Portal',
}

export default async function Page() {
    await ensurePermission('coupon:read')

    return <CouponList />
}
