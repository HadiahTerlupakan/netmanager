import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import LandingPage from '@/components/LandingPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SBLNET.ID - Provider Internet Fiber Optik Unlimited Tercepat',
  description: 'Rasakan pengalaman internet ngebut tanpa ribet dengan SBLNET.ID. Provider fiber optik dengan koneksi stabil, unlimited tanpa FUP, dan dukungan 24/7 untuk rumah & bisnis.',
  keywords: ['internet wifi', 'fiber optik', 'provider internet jakarta', 'wifi murah', 'pasang wifi', 'sblnet', 'internet stabil'],
  openGraph: {
    title: 'SBLNET.ID - Internet Fiber Optik Ngebut Tanpa Ribet',
    description: 'Internet unlimited stabil untuk produktivitas digital Anda. Support 24/7, Anti Badai, Tanpa FUP.',
    url: 'https://sblnet.id',
    siteName: 'SBLNET.ID',
    locale: 'id_ID',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  }
}

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
