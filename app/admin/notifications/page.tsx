import { ClientComponent } from './NotificationsClient'

export default async function Page() {
    // Notifications are accessible to all authenticated admin users
    return <ClientComponent />
}
