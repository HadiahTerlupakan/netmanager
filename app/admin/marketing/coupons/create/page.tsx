import { ensurePermission } from '@/lib/rbac'
import CouponForm from '../CouponForm'

export const metadata = {
    title: 'Buat Kupon - Admin Portal',
}

export default async function Page() {
    await ensurePermission('coupon:create')
    return <CouponForm />
}
