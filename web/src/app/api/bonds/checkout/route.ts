import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  withErrorHandling,
  getAuthSession,
} from '@/lib/api-utils'
import { BOND_CONFIG } from '@/lib/game'
import { prisma } from '@/lib/db'

// =============================================================================
// STRIPE CHECKOUT FOR BOND PURCHASES
// =============================================================================

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-11-17.clover' })
  : null

// Valid bundle IDs from BOND_CONFIG
const VALID_BUNDLE_IDS = BOND_CONFIG.PURCHASE_BUNDLES.map(b => b.id)

/**
 * POST /api/bonds/checkout
 * Create a Stripe Checkout session for bond purchase
 *
 * Body: { bundleId: 'starter' | 'popular' | 'premium' | 'whale' }
 *
 * Returns: { checkoutUrl: string }
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  if (!stripe) {
    return errorResponse('Payment system not configured', 503)
  }

  // Auth required
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return unauthorizedResponse()
  }

  const user_id = session.user.id

  // Get user info for metadata
  const user = await prisma.users.findUnique({
    where: { id: user_id },
    select: {
      id: true,
      username: true,
      kick_user_id: true,
      twitch_user_id: true,
      discord_user_id: true,
    },
  })

  if (!user) {
    return errorResponse('User not found', 404)
  }

  // Parse bundle selection
  const body = await request.json()
  const bundleId = body.bundleId as string

  if (!bundleId || !VALID_BUNDLE_IDS.includes(bundleId)) {
    return errorResponse(
      `Invalid bundle. Valid options: ${VALID_BUNDLE_IDS.join(', ')}`,
      400
    )
  }

  // Find bundle config
  const bundle = BOND_CONFIG.PURCHASE_BUNDLES.find(b => b.id === bundleId)
  if (!bundle) {
    return errorResponse('Bundle not found', 400)
  }

  // Calculate total bonds (base + bonus)
  const totalBonds = bundle.bonds + bundle.bonus

  // Determine platform for metadata
  const platform = user.kick_user_id
    ? 'kick'
    : user.twitch_user_id
    ? 'twitch'
    : user.discord_user_id
    ? 'discord'
    : 'web'

  const platformUserId =
    user.kick_user_id || user.twitch_user_id || user.discord_user_id || String(user.id)

  // Create Stripe Checkout session with ad-hoc pricing
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${totalBonds} Kingpin Bonds`,
            description: bundle.bonus > 0
              ? `${bundle.bonds} bonds + ${bundle.bonus} bonus bonds`
              : `${bundle.bonds} bonds`,
          },
          unit_amount: Math.round(bundle.usd * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    metadata: {
      purchase_type: 'bonds',
      bundle_id: bundleId,
      user_id: String(user.id),
      username: user.username,
      platform,
      platform_user_id: platformUserId,
      bonds_base: String(bundle.bonds),
      bonds_bonus: String(bundle.bonus),
      bonds_total: String(totalBonds),
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://kingpin.simianmonke.com'}/shop/bonds?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://kingpin.simianmonke.com'}/shop/bonds?canceled=true`,
  })

  if (!checkoutSession.url) {
    return errorResponse('Failed to create checkout session', 500)
  }

  return successResponse({
    checkoutUrl: checkoutSession.url,
    sessionId: checkoutSession.id,
    bundle: {
      id: bundleId,
      bonds: bundle.bonds,
      bonus: bundle.bonus,
      total: totalBonds,
      price: bundle.usd,
    },
  })
})

/**
 * GET /api/bonds/checkout
 * Get available bond bundles for purchase
 */
export const GET = withErrorHandling(async () => {
  const bundles = BOND_CONFIG.PURCHASE_BUNDLES.map(bundle => ({
    id: bundle.id,
    bonds: bundle.bonds,
    bonus: bundle.bonus,
    total: bundle.bonds + bundle.bonus,
    price: bundle.usd,
    priceFormatted: `$${bundle.usd.toFixed(2)}`,
    valuePerDollar: ((bundle.bonds + bundle.bonus) / bundle.usd).toFixed(1),
  }))

  return successResponse({
    bundles,
    stripeConfigured: !!stripe,
  })
})
