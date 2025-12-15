import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { MonetizationService } from '@/lib/services'

// =============================================================================
// KICK WEBHOOK HANDLER
// =============================================================================

// Kick webhook event types
const KICK_EVENTS = {
  SUBSCRIPTION_NEW: 'channel.subscription.new',
  SUBSCRIPTION_GIFTS: 'channel.subscription.gifts',
  KICKS_GIFTED: 'kicks.gifted',
} as const

// Kick webhook payload types
interface KickSubscriptionPayload {
  broadcaster: { user_id: string; username: string }
  subscriber: { user_id: string; username: string }
  duration: number
  tier?: string
  created_at: string
}

interface KickGiftSubPayload {
  broadcaster: { user_id: string; username: string }
  gifter: { user_id: string; username: string }
  giftees: Array<{ user_id: string; username: string }>
  tier?: string
}

interface KickKicksPayload {
  broadcaster: { user_id: string; username: string }
  sender: { user_id: string; username: string }
  amount: number
}

/**
 * Verify Kick webhook signature
 */
function verifyKickSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

/**
 * Extract tier from Kick subscription (default to 1 if not specified)
 */
function extractTier(payload: { tier?: string }): string {
  // Kick uses "tier_1", "tier_2", "tier_3" or just numbers
  if (!payload.tier) return '1'
  const match = payload.tier.match(/(\d)/)
  return match ? match[1] : '1'
}

// =============================================================================
// POST /api/webhooks/kick
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.KICK_WEBHOOK_SECRET

    if (!webhookSecret) {
      console.error('KICK_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      )
    }

    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('kick-signature')
    const eventType = request.headers.get('kick-event-type')
    const eventId = request.headers.get('kick-event-id')

    // Verify signature
    if (!verifyKickSignature(rawBody, signature, webhookSecret)) {
      console.error('Invalid Kick webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    if (!eventType || !eventId) {
      return NextResponse.json(
        { error: 'Missing event headers' },
        { status: 400 }
      )
    }

    // Parse payload
    const payload = JSON.parse(rawBody)

    // Check for duplicate event
    const isDuplicate = await MonetizationService.isEventProcessed(eventId)
    if (isDuplicate) {
      console.log(`Kick webhook event ${eventId} already processed`)
      return NextResponse.json({ success: true, message: 'Already processed' })
    }

    // Handle different event types
    switch (eventType) {
      case KICK_EVENTS.SUBSCRIPTION_NEW: {
        const subPayload = payload as KickSubscriptionPayload
        const tier = extractTier(subPayload)

        const result = await MonetizationService.processKickSubscription(
          subPayload.subscriber.user_id,
          subPayload.subscriber.username,
          tier,
          eventId,
          payload
        )

        console.log(
          `Kick subscription processed: ${subPayload.subscriber.username} (Tier ${tier}) - $${result.wealth} wealth, ${result.xp} XP`
        )

        return NextResponse.json({
          success: true,
          eventId: result.eventId,
          userId: result.userId,
          rewards: {
            wealth: result.wealth,
            xp: result.xp,
          },
        })
      }

      case KICK_EVENTS.SUBSCRIPTION_GIFTS: {
        const giftPayload = payload as KickGiftSubPayload
        const giftCount = giftPayload.giftees?.length || 1
        const tier = extractTier(giftPayload)

        const result = await MonetizationService.processKickGiftSubs(
          giftPayload.gifter.user_id,
          giftPayload.gifter.username,
          giftCount,
          eventId,
          payload
        )

        console.log(
          `Kick gift subs processed: ${giftPayload.gifter.username} gifted ${giftCount} subs - $${result.wealth} wealth, ${result.xp} XP`
        )

        return NextResponse.json({
          success: true,
          eventId: result.eventId,
          userId: result.userId,
          giftCount,
          rewards: {
            wealth: result.wealth,
            xp: result.xp,
          },
        })
      }

      case KICK_EVENTS.KICKS_GIFTED: {
        const kicksPayload = payload as KickKicksPayload
        const kickCount = kicksPayload.amount || 1

        const result = await MonetizationService.processKickKicks(
          kicksPayload.sender.user_id,
          kicksPayload.sender.username,
          kickCount,
          eventId,
          payload
        )

        console.log(
          `Kick kicks processed: ${kicksPayload.sender.username} sent ${kickCount} kicks - $${result.wealth} wealth`
        )

        return NextResponse.json({
          success: true,
          eventId: result.eventId,
          userId: result.userId,
          kickCount,
          rewards: {
            wealth: result.wealth,
            xp: result.xp,
          },
        })
      }

      default:
        console.log(`Unhandled Kick event type: ${eventType}`)
        return NextResponse.json({
          success: true,
          message: `Event type ${eventType} not handled`,
        })
    }
  } catch (error) {
    console.error('Kick webhook error:', error)

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
// GET /api/webhooks/kick - Health check
// =============================================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    webhook: 'kick',
    supportedEvents: Object.values(KICK_EVENTS),
  })
}
