# REF: ENVIRONMENT VARIABLES

---

## OVERVIEW

All environment variables required for Kingpin deployment across all services.

---

## DATABASE

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | `postgresql://user:pass@host:5432/kingpin` | Neon PostgreSQL connection string |
| `DATABASE_SSL` | ❌ | `true` | Enable SSL for database connection |

---

## AUTHENTICATION

### Kick OAuth
| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `KICK_CLIENT_ID` | ✅ | `abc123...` | Kick application client ID |
| `KICK_CLIENT_SECRET` | ✅ | `secret...` | Kick application client secret |
| `KICK_REDIRECT_URI` | ✅ | `https://kingpin.simianmonke.com/auth/kick/callback` | OAuth redirect URI |

### Twitch OAuth
| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `TWITCH_CLIENT_ID` | ✅ | `abc123...` | Twitch application client ID |
| `TWITCH_CLIENT_SECRET` | ✅ | `secret...` | Twitch application client secret |
| `TWITCH_REDIRECT_URI` | ✅ | `https://kingpin.simianmonke.com/auth/twitch/callback` | OAuth redirect URI |

### Discord OAuth
| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `DISCORD_CLIENT_ID` | ✅ | `123456789...` | Discord application client ID |
| `DISCORD_CLIENT_SECRET` | ✅ | `secret...` | Discord application client secret |
| `DISCORD_REDIRECT_URI` | ✅ | `https://kingpin.simianmonke.com/auth/discord/callback` | OAuth redirect URI |
| `DISCORD_BOT_TOKEN` | ✅ | `token...` | Discord bot token |

---

## PLATFORM CONNECTIONS

### Kick Bot
| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `KICK_CHANNEL_ID` | ✅ | `12345` | Kick channel ID to connect to |
| `KICK_CHANNEL_SLUG` | ✅ | `simianmonke` | Kick channel slug |
| `KICK_PUSHER_KEY` | ✅ | `key...` | Pusher key for WebSocket |

### Twitch Bot
| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `TWITCH_CHANNEL` | ✅ | `simianmonke` | Twitch channel name |
| `TWITCH_BOT_USERNAME` | ✅ | `kingpinbot` | Bot account username |
| `TWITCH_BOT_OAUTH` | ✅ | `oauth:abc123...` | Bot account OAuth token |
| `TWITCH_EVENTSUB_SECRET` | ✅ | `secret...` | EventSub webhook secret |

### Discord Bot
| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `DISCORD_GUILD_ID` | ✅ | `123456789...` | Primary Discord server ID |

---

## STRIPE

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | ✅ | `sk_live_...` | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | ✅ | `pk_live_...` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | ✅ | `whsec_...` | Stripe webhook signing secret |
| `STRIPE_DONATION_PRICE_ID` | ✅ | `price_...` | Stripe price ID for donations |

---

## WEBHOOKS

### Discord Admin Webhook
| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `DISCORD_ADMIN_WEBHOOK_URL` | ✅ | `https://discord.com/api/webhooks/...` | Admin notification webhook |

### Lumia Stream
| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `LUMIA_WEBHOOK_SESSION_START` | ❌ | `https://...` | Session start trigger |
| `LUMIA_WEBHOOK_SESSION_END` | ❌ | `https://...` | Session end trigger |
| `LUMIA_WEBHOOK_CROWN_CHANGE` | ❌ | `https://...` | Crown change trigger |
| `LUMIA_WEBHOOK_JUICE_LEADERBOARD` | ❌ | `https://...` | Periodic leaderboard trigger |

---

## APPLICATION

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | ✅ | `production` | Environment (development/production) |
| `PORT` | ❌ | `3000` | Server port (default: 3000) |
| `BASE_URL` | ✅ | `https://kingpin.simianmonke.com` | Public base URL |
| `SESSION_SECRET` | ✅ | `random-32-char-string` | Session encryption secret |
| `JWT_SECRET` | ✅ | `random-64-char-string` | JWT signing secret |

---

## REDIS (Optional)

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | ❌ | `redis://localhost:6379` | Redis connection URL |
| `REDIS_PASSWORD` | ❌ | `password` | Redis password if required |

---

## FEATURE FLAGS

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENABLE_DISCORD` | ❌ | `true` | Enable Discord integration |
| `ENABLE_HEIST_ALERTS` | ❌ | `true` | Enable heist alert events |
| `ENABLE_FACTIONS` | ❌ | `true` | Enable faction system |
| `ENABLE_MISSIONS` | ❌ | `true` | Enable mission system |
| `DEBUG_MODE` | ❌ | `false` | Enable verbose logging |

---

## RATE LIMITING

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | ❌ | `60000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | ❌ | `100` | Max requests per window |
| `COMMAND_RATE_LIMIT` | ❌ | `5` | Max commands per 10 seconds |

---

## GAME CONFIGURATION

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BUST_CHANCE` | ❌ | `0.05` | Chance of getting busted (5%) |
| `JAIL_DURATION_MINUTES` | ❌ | `60` | Jail duration in minutes |
| `BAIL_COST_PERCENT` | ❌ | `0.10` | Bail cost as % of wealth |
| `CRATE_DROP_CHANCE` | ❌ | `0.02` | Base crate drop chance (2%) |
| `ROB_COOLDOWN_HOURS` | ❌ | `24` | Rob cooldown per target |
| `BLACK_MARKET_ROTATION_HOURS` | ❌ | `6` | Black Market rotation interval |

---

## SAMPLE .env FILE

```env
# Database
DATABASE_URL=postgresql://user:password@ep-cool-name-123456.us-east-2.aws.neon.tech/kingpin?sslmode=require

# Kick
KICK_CLIENT_ID=your_kick_client_id
KICK_CLIENT_SECRET=your_kick_client_secret
KICK_REDIRECT_URI=https://kingpin.simianmonke.com/auth/kick/callback
KICK_CHANNEL_ID=12345
KICK_CHANNEL_SLUG=simianmonke
KICK_PUSHER_KEY=your_pusher_key

# Twitch
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_REDIRECT_URI=https://kingpin.simianmonke.com/auth/twitch/callback
TWITCH_CHANNEL=simianmonke
TWITCH_BOT_USERNAME=kingpinbot
TWITCH_BOT_OAUTH=oauth:your_bot_oauth_token
TWITCH_EVENTSUB_SECRET=your_eventsub_secret

# Discord
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=https://kingpin.simianmonke.com/auth/discord/callback
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_guild_id

# Stripe
STRIPE_SECRET_KEY=sk_live_your_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_DONATION_PRICE_ID=price_your_price_id

# Webhooks
DISCORD_ADMIN_WEBHOOK_URL=https://discord.com/api/webhooks/your_webhook
LUMIA_WEBHOOK_SESSION_START=https://your_lumia_webhook
LUMIA_WEBHOOK_SESSION_END=https://your_lumia_webhook
LUMIA_WEBHOOK_CROWN_CHANGE=https://your_lumia_webhook
LUMIA_WEBHOOK_JUICE_LEADERBOARD=https://your_lumia_webhook

# Application
NODE_ENV=production
PORT=3000
BASE_URL=https://kingpin.simianmonke.com
SESSION_SECRET=your_32_character_session_secret_here
JWT_SECRET=your_64_character_jwt_secret_here_make_it_very_long_and_random

# Redis (Optional)
REDIS_URL=redis://localhost:6379

# Feature Flags
ENABLE_DISCORD=true
ENABLE_HEIST_ALERTS=true
ENABLE_FACTIONS=true
ENABLE_MISSIONS=true
DEBUG_MODE=false

# Game Config (Optional - defaults shown)
BUST_CHANCE=0.05
JAIL_DURATION_MINUTES=60
BAIL_COST_PERCENT=0.10
CRATE_DROP_CHANCE=0.02
ROB_COOLDOWN_HOURS=24
BLACK_MARKET_ROTATION_HOURS=6
```

---

## VERCEL DEPLOYMENT

For Vercel (Next.js frontend + API), set these in the Vercel dashboard:

**Required for all deployments:**
- DATABASE_URL
- SESSION_SECRET
- JWT_SECRET
- BASE_URL

**Required for OAuth:**
- All KICK_* variables
- All TWITCH_* variables
- All DISCORD_* variables

**Required for payments:**
- All STRIPE_* variables

---

## RAILWAY DEPLOYMENT

For Railway (Node.js bot service), set these in Railway dashboard:

**Required:**
- DATABASE_URL
- KICK_* (for Kick bot)
- TWITCH_* (for Twitch bot)
- DISCORD_BOT_TOKEN (for Discord bot)
- DISCORD_ADMIN_WEBHOOK_URL

---

## SECURITY NOTES

1. **Never commit .env files to git**
2. **Use different secrets for development and production**
3. **Rotate secrets periodically**
4. **Use environment-specific API keys** (test vs live for Stripe)
5. **Restrict webhook URLs to your domains**

---

**END OF DOCUMENT**
