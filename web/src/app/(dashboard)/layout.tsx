'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { DashboardNav } from '@/components/layout/dashboard-nav'
import { MobileNav } from '@/components/layout/mobile-nav'
import { InitializingLoader } from '@/components/ui/initializing-loader'

const AUTH_BOOT_SEQUENCE = [
  'KINGPIN TERMINAL v2.0.45',
  'ESTABLISHING SECURE CONNECTION...',
  'AUTHENTICATING USER CREDENTIALS...',
  'VERIFYING SESSION TOKEN...',
  'LOADING USER PROFILE...',
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-void)]">
        <div className="w-full max-w-md">
          <InitializingLoader lines={AUTH_BOOT_SEQUENCE} speed={80} />
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-void)]">
      <DashboardNav />
      <main className="flex-1 container mx-auto px-4 py-8 pb-24 lg:pb-8">{children}</main>
      <MobileNav />
    </div>
  )
}
