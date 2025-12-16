# Kingpin Soft Launch Runbook

## Overview
Step-by-step guide for deploying Kingpin to production with minimal risk.

---

## Pre-Launch Checklist

### Environment Variables
Verify all required env vars are set in Vercel:

```bash
# Required
DATABASE_URL          # Neon PostgreSQL connection string
NEXTAUTH_SECRET       # Generate: openssl rand -base64 32
NEXTAUTH_URL          # https://kingpin.simianmonke.com

# OAuth (at least one required)
KICK_CLIENT_ID
KICK_CLIENT_SECRET
TWITCH_CLIENT_ID      # Optional if Kick-only launch
TWITCH_CLIENT_SECRET
DISCORD_CLIENT_ID     # Optional
DISCORD_CLIENT_SECRET

# Payments
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET

# Webhooks
DISCORD_FEED_WEBHOOK_URL    # For game feed
DISCORD_ADMIN_WEBHOOK_URL   # For admin alerts

# Error Monitoring
SENTRY_DSN
NEXT_PUBLIC_SENTRY_DSN
SENTRY_ORG
SENTRY_PROJECT
SENTRY_AUTH_TOKEN
```

### Database
- [ ] Run `npx prisma db push` against production
- [ ] Verify schema applied: `npx prisma studio`
- [ ] Seed initial data if needed: `npm run db:seed`

### Tests
- [ ] All tests passing: `npm test`
- [ ] Type check clean: `npx tsc --noEmit`

### External Services
- [ ] Sentry project created and DSN configured
- [ ] Discord webhooks tested (admin channel receives messages)
- [ ] Stripe webhooks configured and verified
- [ ] OAuth apps created and redirect URIs set

---

## Deployment Steps

### 1. Pre-Deploy
```bash
# Ensure clean working directory
git status

# Pull latest
git pull origin main

# Run final test suite
cd web && npm test && cd ..

# Build locally to catch errors
cd web && npm run build && cd ..
```

### 2. Deploy to Vercel
```bash
# Push to main triggers Vercel deploy
git push origin main

# Or manual deploy
vercel --prod
```

### 3. Verify Deployment
```bash
# Check deployment status
vercel ls

# Test the live URL
curl -I https://kingpin.simianmonke.com
```

---

## Post-Deploy Verification

### Smoke Tests (Manual)
1. **Auth Flow**
   - [ ] Navigate to https://kingpin.simianmonke.com
   - [ ] Click "Login with Kick"
   - [ ] Complete OAuth flow
   - [ ] Verify dashboard loads

2. **Core Gameplay**
   - [ ] Execute `/play` command
   - [ ] Check wealth/XP updates
   - [ ] Verify no errors in Sentry

3. **Economy**
   - [ ] Open gambling page
   - [ ] Place minimum slots bet
   - [ ] Verify balance deduction/payout

4. **Discord Integration**
   - [ ] Check #kingpin-feed for test posts
   - [ ] Check admin channel for system alerts

### API Health Checks
```bash
# Check API is responding
curl https://kingpin.simianmonke.com/api/users/me

# Check health endpoint (if implemented)
curl https://kingpin.simianmonke.com/api/health
```

---

## Rollback Plan

### If Critical Bug Found:

1. **Immediate Rollback via Vercel**
   ```bash
   # List recent deployments
   vercel ls

   # Rollback to previous deployment
   vercel rollback [deployment-url]
   ```

2. **Or via Git**
   ```bash
   # Revert last commit
   git revert HEAD
   git push origin main
   ```

### If Database Issue:
- Neon supports point-in-time recovery
- Contact Neon support or use branching feature
- **DO NOT** run destructive migrations without backup

---

## Monitoring

### Sentry Dashboard
- Monitor error rates at https://sentry.io
- Set up alerts for:
  - Error spike > 10 errors/min
  - New issue types
  - Performance degradation

### Discord Admin Channel
Critical errors auto-post to admin webhook:
- Payment failures
- Auth errors
- Database errors
- External API failures

### Vercel Analytics
- Check function execution times
- Monitor edge function errors
- Watch for cold start issues

---

## Soft Launch Strategy

### Phase 1: Internal Testing (Day 1)
- Deploy to production
- Test with 2-3 trusted users
- Monitor Sentry for errors
- Fix any critical bugs

### Phase 2: Limited Beta (Day 2-3)
- Announce to Discord (limited audience)
- Cap at ~50 active users
- Gather feedback
- Iterate on UX issues

### Phase 3: Public Soft Launch (Day 4+)
- Remove user caps
- Announce on stream
- Monitor scaling
- Be ready for hotfixes

---

## Emergency Contacts

| Service | Support |
|---------|---------|
| Vercel | https://vercel.com/support |
| Neon | https://neon.tech/docs/support |
| Sentry | https://sentry.io/support |
| Stripe | https://support.stripe.com |

---

## Post-Launch Tasks

- [ ] Monitor error rates for 24 hours
- [ ] Check database connection pool usage
- [ ] Review Vercel function logs
- [ ] Gather user feedback
- [ ] Plan first iteration based on data
