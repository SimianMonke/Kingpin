# Kingpin Bot

Multi-platform chatbot for the Kingpin RPG game. Connects to Kick, Twitch, and Discord to handle chat commands and channel point redemptions.

## Setup

### 1. Install Dependencies

```bash
cd bot
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `API_BASE_URL` - Your Kingpin web app URL (e.g., `https://kingpin.simianmonke.com`)
- `BOT_API_KEY` - API key for authenticating with the web app
- Platform-specific credentials (see .env.example)

### 3. Run in Development

```bash
npm run dev
```

### 4. Build for Production

```bash
npm run build
npm start
```

## Platform Setup

### Kick
1. Set `KICK_ENABLED=true`
2. Configure channel ID and slug
3. Set up channel point rewards and note their IDs

### Twitch
1. Set `TWITCH_ENABLED=true`
2. Create a bot account and get OAuth token
3. Set up channel point rewards in Twitch dashboard
4. Note reward IDs for configuration

### Discord
1. Set `DISCORD_ENABLED=true`
2. Create a Discord application at https://discord.com/developers
3. Create a bot and get the token
4. Invite bot to your server with appropriate permissions

## Commands

See `REF_CHAT_COMMANDS.md` in the project root for the complete list of commands.

### Profile Commands
- `!profile` / `!p` / `!stats` - View profile
- `!balance` / `!bal` - View wealth
- `!level` / `!lvl` - View level progress

### Leaderboard Commands
- `!lb [period]` - View leaderboard (daily/weekly/monthly/lifetime)
- `!rank` - View your rank

### Game Commands
- `!inventory` / `!inv` - View inventory
- `!crates` - View crate inventory
- `!shop` - View personal shop
- `!market` - View Black Market
- `!missions` - View active missions
- `!achievements` - View achievement progress
- `!titles` - View/equip titles

### Faction Commands
- `!factions` - List all factions
- `!faction` - View your faction
- `!faction join <name>` - Join a faction
- `!faction leave` - Leave faction
- `!territories` - View territory map

### Juicernaut Commands
- `!juice` / `!juicernaut` - View session standings
- `!juicehall` - View Hall of Fame

### Admin Commands (Mod/Broadcaster)
- `!startsession [title]` - Start streaming session
- `!endsession` - End streaming session
- `!givewealth <user> <amount>` - Give wealth (broadcaster only)
- `!givexp <user> <amount>` - Give XP (broadcaster only)
- `!givecrate <user> <tier>` - Give crate (broadcaster only)

## Channel Point Redemptions

These actions are triggered by channel point redemptions, NOT chat commands:

| Action | Description |
|--------|-------------|
| Play | Execute a play action for wealth/XP |
| Rob | Rob another player (requires target in input) |
| Bail | Pay bail to escape jail |
| Reroll Shop | Refresh personal shop inventory |

Configure reward IDs in `.env` to match your Kick/Twitch channel point rewards.

## Deployment (Railway)

1. Create a new project on Railway
2. Connect your Git repository
3. Set the root directory to `bot`
4. Configure environment variables in Railway dashboard
5. Deploy!

Railway will automatically:
- Detect Node.js
- Install dependencies
- Run `npm run build`
- Start with `npm start`

## Architecture

```
bot/src/
├── index.ts          # Entry point, event handling
├── config.ts         # Environment configuration
├── api-client.ts     # HTTP client for web API
├── types.ts          # TypeScript types
├── platforms/        # Platform connections
│   ├── kick.ts       # Kick (Pusher WebSocket)
│   ├── twitch.ts     # Twitch (TMI.js)
│   └── discord.ts    # Discord (discord.js)
├── commands/         # Chat command handlers
│   ├── profile.ts    # !profile, !balance, !level
│   ├── leaderboard.ts# !lb, !rank
│   ├── faction.ts    # !faction, !territories
│   ├── juicernaut.ts # !juice, !juicehall
│   ├── inventory.ts  # !inventory, !crates, !shop
│   ├── missions.ts   # !missions, !achievements
│   ├── heist.ts      # !grab
│   └── admin.ts      # !startsession, !givewealth
├── handlers/         # Event handlers
│   └── redemption.ts # Channel point redemptions
└── utils/            # Utilities
    ├── logger.ts     # Logging
    ├── formatter.ts  # Message formatting
    └── cooldown.ts   # Command cooldowns
```

## Troubleshooting

### Bot won't connect to Kick
- Kick uses Pusher for WebSocket connections
- Verify channel ID and slug are correct
- Note: Sending messages requires Kick API authentication (not implemented)

### Bot won't send messages on Twitch
- Verify OAuth token starts with `oauth:`
- Ensure bot account has permission to chat in channel
- Check that bot is not timed out or banned

### Commands not working
- Verify `COMMAND_PREFIX` matches your expected prefix (default: `!`)
- Check cooldown settings
- Verify user has proper permissions for admin commands

### Redemptions not triggering
- Set reward IDs in environment variables
- Or use title-based matching (reward title must contain "play", "rob", "bail", or "reroll")
