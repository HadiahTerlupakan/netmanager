import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import LandingPage from '@/components/LandingPage'

export default async function HomePage() {
  // Check if customer is logged in
  const cookieStore = await cookies()
  const customerToken = cookieStore.get('customer-token')

  if (customerToken) {
    // Customer is logged in, redirect to dashboard
    redirect('/dashboard')
  }

  // Not logged in, show Landing Page directly at root
  return <LandingPage />
}
