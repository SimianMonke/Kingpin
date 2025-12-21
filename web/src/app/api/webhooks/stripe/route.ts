import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { MonetizationService } from '@/lib/services'
import { BondService } from '@/lib/services/bond.service'

// =============================================================================
// STRIPE WEBHOOK HANDLER
// =============================================================================

// Initialize Stripe (will fail gracefully if not configured)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-11-17.clover' })
  : null

// Stripe events we handle
const STRIPE_EVENTS = {
  CHECKOUT_COMPLETED: 'checkout.session.completed',
  PAYMENT_SUCCEEDED: 'payment_intent.succeeded',
} as const

// Required metadata fields for user identification
interface DonationMetadata {
  kick_user_id?: string
  twitch_user_id?: string
  discord_user_id?: string
  username?: string
  platform?: string
}

// Bond purchase metadata (from checkout session)
interface BondPurchaseMetadata {
  purchase_type: 'bonds'
  bundle_id: string
  user_id: string
  username: string
  platform: string
  platform_user_id: string
  bonds_base: string
  bonds_bonus: string
  bonds_total: string
}

/**
 * Extract user identification from Stripe metadata
 */
function extractUserFromMetadata(metadata: DonationMetadata): {
  platformUserId: string
  username: string
  platform: 'kick' | 'twitch' | 'discord'
} | null {
  // Try Kick first
  if (metadata.kick_user_id && metadata.username) {
    return {
      platformUserId: metadata.kick_user_id,
      username: metadata.username,
      platform: 'kick',
    }
  }

  // Then Twitch
  if (metadata.twitch_user_id && metadata.username) {
    return {
      platformUserId: metadata.twitch_user_id,
      username: metadata.username,
      platform: 'twitch',
    }
  }

  // Then Discord
  if (metadata.discord_user_id && metadata.username) {
    return {
      platformUserId: metadata.discord_user_id,
      username: metadata.username,
      platform: 'discord',
    }
  }

  // Check for generic platform field
  if (metadata.platform && metadata.username) {
    const platform = metadata.platform.toLowerCase()
    if (platform === 'kick' && metadata.kick_user_id) {
      return {
        platformUserId: metadata.kick_user_id,
        username: metadata.username,
        platform: 'kick',
      }
    }
    if (platform === 'twitch' && metadata.twitch_user_id) {
      return {
        platformUserId: metadata.twitch_user_id,
        username: metadata.username,
        platform: 'twitch',
      }
    }
  }

  return null
}

// =============================================================================
// POST /api/webhooks/stripe
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!stripe || !webhookSecret) {
      console.error('Stripe not configured')
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      )
    }

    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    // Verify and construct event
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
    } catch (err) {
      console.error('Stripe signature verification failed:', err)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const eventId = event.id

    // Check for duplicate event
    const external_event_id = `stripe_${eventId}`
    const isDuplicate = await MonetizationService.isEventProcessed(external_event_id)
    if (isDuplicate) {
      console.log(`Stripe webhook event ${external_event_id} already processed`)
      return NextResponse.json({ success: true, message: 'Already processed' })
    }

    // Handle different event types
    switch (event.type) {
      case STRIPE_EVENTS.CHECKOUT_COMPLETED: {
        const session = event.data.object as Stripe.Checkout.Session

        // Skip non-payment sessions
        if (session.mode !== 'payment' || session.payment_status !== 'paid') {
          return NextResponse.json({
            success: true,
            message: 'Not a completed payment',
          })
        }

        // Get amount in dollars
        const amount_usd = (session.amount_total || 0) / 100

        if (amount_usd <= 0) {
          return NextResponse.json({
            success: true,
            message: 'Zero amount payment',
          })
        }

        const metadata = session.metadata || {}

        // =================================================================
        // BOND PURCHASE FLOW
        // =================================================================
        if (metadata.purchase_type === 'bonds') {
          const bondMetadata = metadata as unknown as BondPurchaseMetadata

          const user_id = parseInt(bondMetadata.user_id, 10)
          const bonds_total = parseInt(bondMetadata.bonds_total, 10)

          if (isNaN(user_id) || isNaN(bonds_total)) {
            console.error('Invalid bond purchase metadata:', bondMetadata)
            return NextResponse.json({
              success: false,
              error: 'Invalid bond purchase metadata',
            }, { status: 400 })
          }

          // Grant bonds to user
          const result = await BondService.grantStripePurchase(
            user_id,
            bondMetadata.bundle_id,
            bonds_total,
            session.id,
            amount_usd
          )

          if (!result.success) {
            console.error('Failed to grant bonds:', result.error)
            return NextResponse.json({
              success: false,
              error: result.error,
            }, { status: 500 })
          }

          console.log(
            `Bond purchase processed: ${bondMetadata.username} bought ${bonds_total} bonds ($${amount_usd})`
          )

          return NextResponse.json({
            success: true,
            type: 'bond_purchase',
            user_id,
            username: bondMetadata.username,
            amount_usd,
            bonds: {
              total: bonds_total,
              base: parseInt(bondMetadata.bonds_base, 10),
              bonus: parseInt(bondMetadata.bonds_bonus, 10),
            },
            newBalance: result.newBalance,
          })
        }

        // =================================================================
        // DONATION FLOW (existing logic)
        // =================================================================
        const donationMetadata = metadata as DonationMetadata
        const userInfo = extractUserFromMetadata(donationMetadata)

        if (!userInfo) {
          console.warn(
            'Stripe checkout completed but no user metadata found:',
            session.id
          )
          return NextResponse.json({
            success: true,
            message: 'No user metadata - donation logged but not credited',
          })
        }

        // Process donation
        const result = await MonetizationService.processStripeDonation(
          userInfo.platformUserId,
          userInfo.username,
          amount_usd,
          external_event_id,
          {
            stripeSessionId: session.id,
            customerEmail: session.customer_email,
            platform: userInfo.platform,
            ...donationMetadata,
          }
        )

        console.log(
          `Stripe donation processed: ${userInfo.username} donated $${amount_usd} - $${result.wealth} wealth`
        )

        return NextResponse.json({
          success: true,
          type: 'donation',
          eventId: result.eventId,
          user_id: result.user_id,
          amount_usd,
          rewards: {
            wealth: result.wealth,
            xp: result.xp,
          },
        })
      }

      case STRIPE_EVENTS.PAYMENT_SUCCEEDED: {
        const paymentIntent = event.data.object as Stripe.PaymentIntent

        // This is a backup handler - checkout.session.completed is preferred
        // Only process if we have metadata indicating this is a donation
        const metadata = (paymentIntent.metadata || {}) as DonationMetadata

        if (!metadata.username) {
          // This might be a regular payment, not a donation
          return NextResponse.json({
            success: true,
            message: 'No donation metadata',
          })
        }

        // Check if already processed via checkout session
        const checkoutEventId = `stripe_checkout_${paymentIntent.id}`
        const alreadyProcessed = await MonetizationService.isEventProcessed(
          checkoutEventId
        )
        if (alreadyProcessed) {
          return NextResponse.json({
            success: true,
            message: 'Already processed via checkout',
          })
        }

        const amount_usd = paymentIntent.amount / 100
        const userInfo = extractUserFromMetadata(metadata)

        if (!userInfo || amount_usd <= 0) {
          return NextResponse.json({
            success: true,
            message: 'Invalid payment or no user info',
          })
        }

        const result = await MonetizationService.processStripeDonation(
          userInfo.platformUserId,
          userInfo.username,
          amount_usd,
          external_event_id,
          {
            stripePaymentIntentId: paymentIntent.id,
            platform: userInfo.platform,
            ...metadata,
          }
        )

        console.log(
          `Stripe payment processed: ${userInfo.username} paid $${amount_usd} - $${result.wealth} wealth`
        )

        return NextResponse.json({
          success: true,
          eventId: result.eventId,
          user_id: result.user_id,
          amount_usd,
          rewards: {
            wealth: result.wealth,
            xp: result.xp,
          },
        })
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`)
        return NextResponse.json({
          success: true,
          message: `Event type ${event.type} not handled`,
        })
    }
  } catch (error) {
    console.error('Stripe webhook error:', error)

    if (error instanceof Error && error.message === 'Event already processed') {
      return NextResponse.json({ success: true, message: 'Already processed' })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// GET /api/webhooks/stripe - Health check
// =============================================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    webhook: 'stripe',
    configured: !!stripe,
    supportedEvents: Object.values(STRIPE_EVENTS),
  })
}
