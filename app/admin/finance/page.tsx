import { redirect } from 'next/navigation'

export default async function FinancePage() {
    // Redirect ke halaman accounts sebagai default finance page
    redirect('/admin/finance/accounts')
}
