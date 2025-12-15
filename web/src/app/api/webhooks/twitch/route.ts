import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { MonetizationService } from '@/lib/services'

// =============================================================================
// TWITCH EVENTSUB WEBHOOK HANDLER
// =============================================================================

// Twitch EventSub subscription types
const TWITCH_EVENTS = {
  SUBSCRIBE: 'channel.subscribe',
  SUBSCRIPTION_GIFT: 'channel.subscription.gift',
  CHEER: 'channel.cheer',
  RAID: 'channel.raid',
} as const

// Twitch EventSub message types
const MESSAGE_TYPES = {
  VERIFICATION: 'webhook_callback_verification',
  NOTIFICATION: 'notification',
  REVOCATION: 'revocation',
} as const

// Twitch EventSub payload types
interface TwitchSubscribeEvent {
  user_id: string
  user_login: string
  user_name: string
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
  tier: string // "1000", "2000", "3000"
  is_gift: boolean
}

interface TwitchGiftSubEvent {
  user_id: string
  user_login: string
  user_name: string
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
  tier: string
  total: number
  cumulative_total: number | null
  is_anonymous: boolean
}

interface TwitchCheerEvent {
  user_id: string
  user_login: string
  user_name: string
  broadcaster_user_id: string
  broadcaster_user_login: string
  broadcaster_user_name: string
  bits: number
  message: string
  is_anonymous: boolean
}

interface TwitchRaidEvent {
  from_broadcaster_user_id: string
  from_broadcaster_user_login: string
  from_broadcaster_user_name: string
  to_broadcaster_user_id: string
  to_broadcaster_user_login: string
  to_broadcaster_user_name: string
  viewers: number
}

interface TwitchEventSubPayload {
  subscription: {
    id: string
    type: string
    version: string
    status: string
    condition: Record<string, string>
    created_at: string
  }
  event?: Record<string, unknown>
  challenge?: string
}

/**
 * Verify Twitch EventSub signature
 */
function verifyTwitchSignature(
  messageId: string | null,
  timestamp: string | null,
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!messageId || !timestamp || !signature) return false

  try {
    const message = messageId + timestamp + body
    const expectedSignature =
      'sha256=' +
      crypto.createHmac('sha256', secret).update(message).digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

/**
 * Convert Twitch tier to simple tier number
 * Twitch uses "1000", "2000", "3000"
 */
function normalizeTier(tier: string): string {
  switch (tier) {
    case '3000':
      return '3'
    case '2000':
      return '2'
    default:
      return '1'
  }
}

// =============================================================================
// POST /api/webhooks/twitch
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.TWITCH_WEBHOOK_SECRET

    if (!webhookSecret) {
      console.error('TWITCH_WEBHOOK_SECRET not configured')
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      )
    }

    // Get raw body for signature verification
    const rawBody = await request.text()

    // Get Twitch headers
    const messageId = request.headers.get('twitch-eventsub-message-id')
    const timestamp = request.headers.get('twitch-eventsub-message-timestamp')
    const signature = request.headers.get('twitch-eventsub-message-signature')
    const messageType = request.headers.get('twitch-eventsub-message-type')

    // Verify signature
    if (
      !verifyTwitchSignature(
        messageId,
        timestamp,
        rawBody,
        signature,
        webhookSecret
      )
    ) {
      console.error('Invalid Twitch webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // HIGH-01 fix: Validate timestamp to prevent replay attacks
    // Twitch recommends rejecting messages older than 10 minutes
    if (timestamp) {
      const messageTimestamp = new Date(timestamp).getTime()
      const currentTime = Date.now()
      const timeDiff = Math.abs(currentTime - messageTimestamp)
      const maxAge = 10 * 60 * 1000 // 10 minutes in milliseconds

      if (timeDiff > maxAge) {
        console.error(`Twitch webhook timestamp too old: ${timestamp} (${timeDiff}ms ago)`)
        return NextResponse.json({ error: 'Message timestamp too old' }, { status: 401 })
      }
    }

    const payload = JSON.parse(rawBody) as TwitchEventSubPayload

    // Handle webhook verification challenge
    if (messageType === MESSAGE_TYPES.VERIFICATION) {
      console.log('Twitch webhook verification challenge received')
      return new NextResponse(payload.challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    // Handle revocation
    if (messageType === MESSAGE_TYPES.REVOCATION) {
      console.log(
        `Twitch subscription revoked: ${payload.subscription.type}`,
        payload.subscription
      )
      return NextResponse.json({ success: true, message: 'Revocation noted' })
    }

    // Handle notification
    if (messageType !== MESSAGE_TYPES.NOTIFICATION) {
      return NextResponse.json({
        success: true,
        message: `Unknown message type: ${messageType}`,
      })
    }

    const subscriptionType = payload.subscription.type
    const subscriptionId = payload.subscription.id
    const event = payload.event

    if (!event || !messageId) {
      return NextResponse.json({ error: 'Missing event data' }, { status: 400 })
    }

    // Use message ID as external event ID for deduplication
    const externalEventId = `twitch_${messageId}`

    // Check for duplicate event
    const isDuplicate = await MonetizationService.isEventProcessed(externalEventId)
    if (isDuplicate) {
      console.log(`Twitch webhook event ${externalEventId} already processed`)
      return NextResponse.json({ success: true, message: 'Already processed' })
    }

    // Handle different subscription types
    switch (subscriptionType) {
      case TWITCH_EVENTS.SUBSCRIBE: {
        const subEvent = event as unknown as TwitchSubscribeEvent

        // Skip gift subs - they're handled by SUBSCRIPTION_GIFT event
        if (subEvent.is_gift) {
          return NextResponse.json({
            success: true,
            message: 'Gift sub handled by separate event',
          })
        }

        const tier = normalizeTier(subEvent.tier)

        const result = await MonetizationService.processTwitchSubscription(
          subEvent.user_id,
          subEvent.user_login,
          tier,
          externalEventId,
          event as Record<string, unknown>
        )

        console.log(
          `Twitch subscription processed: ${subEvent.user_login} (Tier ${tier}) - $${result.wealth} wealth, ${result.xp} XP`
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

      case TWITCH_EVENTS.SUBSCRIPTION_GIFT: {
        const giftEvent = event as unknown as TwitchGiftSubEvent

        // Skip anonymous gifts - we can't track the user
        if (giftEvent.is_anonymous) {
          console.log('Skipping anonymous gift sub')
          return NextResponse.json({
            success: true,
            message: 'Anonymous gifts not tracked',
          })
        }

        const tier = normalizeTier(giftEvent.tier)

        const result = await MonetizationService.processTwitchGiftSubs(
          giftEvent.user_id,
          giftEvent.user_login,
          giftEvent.total,
          tier,
          externalEventId,
          event as Record<string, unknown>
        )

        console.log(
          `Twitch gift subs processed: ${giftEvent.user_login} gifted ${giftEvent.total} subs (Tier ${tier}) - $${result.wealth} wealth, ${result.xp} XP`
        )

        return NextResponse.json({
          success: true,
          eventId: result.eventId,
          userId: result.userId,
          giftCount: giftEvent.total,
          rewards: {
            wealth: result.wealth,
            xp: result.xp,
          },
        })
      }

      case TWITCH_EVENTS.CHEER: {
        const cheerEvent = event as unknown as TwitchCheerEvent

        // Skip anonymous cheers
        if (cheerEvent.is_anonymous) {
          console.log('Skipping anonymous cheer')
          return NextResponse.json({
            success: true,
            message: 'Anonymous cheers not tracked',
          })
        }

        const result = await MonetizationService.processTwitchBits(
          cheerEvent.user_id,
          cheerEvent.user_login,
          cheerEvent.bits,
          externalEventId,
          event as Record<string, unknown>
        )

        console.log(
          `Twitch bits processed: ${cheerEvent.user_login} cheered ${cheerEvent.bits} bits - $${result.wealth} wealth`
        )

        return NextResponse.json({
          success: true,
          eventId: result.eventId,
          userId: result.userId,
          bits: cheerEvent.bits,
          rewards: {
            wealth: result.wealth,
            xp: result.xp,
          },
        })
      }

      case TWITCH_EVENTS.RAID: {
        const raidEvent = event as unknown as TwitchRaidEvent

        const result = await MonetizationService.processTwitchRaid(
          raidEvent.from_broadcaster_user_id,
          raidEvent.from_broadcaster_user_login,
          raidEvent.viewers,
          externalEventId,
          event as Record<string, unknown>
        )

        console.log(
          `Twitch raid processed: ${raidEvent.from_broadcaster_user_login} raided with ${raidEvent.viewers} viewers - $${result.wealth} wealth, ${result.xp} XP`
        )

        return NextResponse.json({
          success: true,
          eventId: result.eventId,
          userId: result.userId,
          viewers: raidEvent.viewers,
          rewards: {
            wealth: result.wealth,
            xp: result.xp,
          },
        })
      }

      default:
        console.log(`Unhandled Twitch subscription type: ${subscriptionType}`)
        return NextResponse.json({
          success: true,
          message: `Subscription type ${subscriptionType} not handled`,
        })
    }
  } catch (error) {
    console.error('Twitch webhook error:', error)

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
// GET /api/webhooks/twitch - Health check
// =============================================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    webhook: 'twitch',
    supportedEvents: Object.values(TWITCH_EVENTS),
  })
}
