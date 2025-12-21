import { ClientComponent } from './AdminDashboardClient'

export default async function Page() {
    // Admin dashboard is accessible to all authenticated admin users
    return <ClientComponent />
}
