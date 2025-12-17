'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'

function LoginPageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const errorParam = searchParams.get('error')

  useEffect(() => {
    // Redirect if already logged in
    if (status === 'authenticated') {
      router.push(callbackUrl)
    }
  }, [status, router, callbackUrl])

  useEffect(() => {
    // Handle error from NextAuth
    if (errorParam) {
      switch (errorParam) {
        case 'OAuthAccountNotLinked':
          setError('This account is already linked to another user.')
          break
        case 'DiscordAccountNotLinked':
          setError('Please create an account using Kick or Twitch first, then link Discord from your profile.')
          break
        case 'OAuthSignin':
          setError('Error during sign in. Please try again.')
          break
        case 'OAuthCallback':
          setError('Error during callback. Please try again.')
          break
        default:
          setError(`Auth error: ${errorParam}. Please try again.`)
      }
    }
  }, [errorParam])

  const handleSignIn = async (provider: string) => {
    setIsLoading(provider)
    setError(null)

    try {
      await signIn(provider, { callbackUrl })
    } catch (err) {
      setError('Failed to sign in. Please try again.')
      setIsLoading(null)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-4xl font-bold text-gradient">KINGPIN</h1>
          </Link>
          <p className="text-gray-400 mt-2">Sign in to start playing</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Sign in buttons */}
        <div className="space-y-4">
          {/* Kick */}
          <button
            onClick={() => handleSignIn('kick')}
            disabled={isLoading !== null}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#53fc18]/10 hover:bg-[#53fc18]/20 border border-[#53fc18]/30 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading === 'kick' ? (
              <div className="w-5 h-5 border-2 border-[#53fc18] border-t-transparent rounded-full animate-spin" />
            ) : (
              <KickIcon className="w-5 h-5" />
            )}
            <span className="text-[#53fc18]">Continue with Kick</span>
          </button>

          {/* Twitch */}
          <button
            onClick={() => handleSignIn('twitch')}
            disabled={isLoading !== null}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#9146FF]/10 hover:bg-[#9146FF]/20 border border-[#9146FF]/30 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading === 'twitch' ? (
              <div className="w-5 h-5 border-2 border-[#9146FF] border-t-transparent rounded-full animate-spin" />
            ) : (
              <TwitchIcon className="w-5 h-5" />
            )}
            <span className="text-[#9146FF]">Continue with Twitch</span>
          </button>

          {/* Divider */}
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-gray-900 px-2 text-gray-500">or if you've linked Discord</span>
            </div>
          </div>

          {/* Discord */}
          <button
            onClick={() => handleSignIn('discord')}
            disabled={isLoading !== null}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#5865F2]/5 hover:bg-[#5865F2]/15 border border-[#5865F2]/20 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading === 'discord' ? (
              <div className="w-5 h-5 border-2 border-[#5865F2] border-t-transparent rounded-full animate-spin" />
            ) : (
              <DiscordIcon className="w-5 h-5" />
            )}
            <span className="text-[#5865F2]/80">Sign in with Discord</span>
          </button>
          <p className="text-xs text-gray-600 text-center mt-1">
            Requires existing Kick/Twitch account
          </p>
        </div>

        {/* Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            By signing in, you agree to participate in the Kingpin economy game.
          </p>
          <p className="mt-2">
            You can link Discord after creating an account with Kick or Twitch.
          </p>
        </div>

        {/* Back to home */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}

// Platform icons
function KickIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l6.9 3.45L12 11.08 5.1 7.63 12 4.18zM4 8.82l7 3.5v7.36l-7-3.5V8.82zm9 10.86v-7.36l7-3.5v7.36l-7 3.5z" />
    </svg>
  )
}

function TwitchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  )
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}
