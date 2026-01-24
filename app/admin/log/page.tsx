import { redirect } from 'next/navigation'

export default async function LogPage() {
    // Redirect ke halaman login log sebagai default
    redirect('/admin/log/login')
}
