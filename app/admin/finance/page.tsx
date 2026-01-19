import { redirect } from 'next/navigation'

export default async function FinancePage() {
    // Redirect ke halaman transactions sebagai default finance page
    redirect('/admin/finance/transactions')
}
