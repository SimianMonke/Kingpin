# REF: CHAT COMMANDS

---

## OVERVIEW

Complete reference of all chat commands and channel point redemptions across platforms.

---

## IMPORTANT: CHANNEL POINT REDEMPTIONS

The following actions are **NOT chat commands**. They are triggered by redeeming channel points on Kick or Twitch:

| Action | Kick Webhook | Twitch EventSub |
|--------|--------------|-----------------|
| Play | `channel.reward.redemption.updated` | `channel.channel_points_custom_reward_redemption.add` |
| Rob | `channel.reward.redemption.updated` | `channel.channel_points_custom_reward_redemption.add` |
| Bail | `channel.reward.redemption.updated` | `channel.channel_points_custom_reward_redemption.add` |
| Reroll Shop | `channel.reward.redemption.updated` | `channel.channel_points_custom_reward_redemption.add` |

These require setting up channel point rewards on each platform with specific titles that the bot recognizes.

### Required Channel Point Rewards

| Reward Title | Cost (Suggested) | Description |
|--------------|------------------|-------------|
| "Play Kingpin" | 100 | Trigger a !play action |
| "Rob Player" | 500 | Attempt to rob (requires target in input) |
| "Bail Out" | 1000 | Escape jail (costs 10% wealth too) |
| "Reroll Shop" | 250 | Refresh your personal shop |

---

## PLATFORM AVAILABILITY

| Symbol | Meaning |
|--------|---------|
| ✅ | Available as chat command |
| ❌ | Not available |
| 🎫 | Channel point redemption (NOT a chat command) |

---

## CHANNEL POINT ACTIONS (NOT CHAT COMMANDS)

| Action | Kick | Twitch | Discord | Description |
|--------|------|--------|---------|-------------|
| Play | 🎫 | 🎫 | ❌ | Main wealth/XP action |
| Rob @user | 🎫 | 🎫 | ❌ | Steal from another player |
| Bail | 🎫 | 🎫 | ❌ | Pay 10% wealth to escape jail |
| Reroll Shop | 🎫 | 🎫 | ❌ | Refresh your personal shop inventory |

---

## PROFILE COMMANDS

| Command | Kick | Twitch | Discord | Cooldown | Description |
|---------|------|--------|---------|----------|-------------|
| `!profile` | ✅ | ✅ | ✅ | None | View your profile |
| `!profile @user` | ✅ | ✅ | ✅ | None | View another player's profile |
| `!balance` | ✅ | ✅ | ✅ | None | View current wealth |
| `!level` | ✅ | ✅ | ✅ | None | View level and XP progress |

---

## INVENTORY COMMANDS

| Command | Kick | Twitch | Discord | Cooldown | Description |
|---------|------|--------|---------|----------|-------------|
| `!inventory` | ✅ | ✅ | ✅ | None | View your inventory |
| `!equip <item>` | ✅ | ✅ | ✅ | None | Equip an item |
| `!unequip <slot>` | ✅ | ✅ | ✅ | None | Unequip a slot |
| `!crates` | ✅ | ✅ | ✅ | None | View your crate inventory |
| `!open crate` | ✅ | ✅ | ✅ | 30s | Open oldest crate |

---

## SHOP COMMANDS

| Command | Kick | Twitch | Discord | Cooldown | Description |
|---------|------|--------|---------|----------|-------------|
| `!shop` | ✅ | ✅ | ✅ | None | View tier-based shop |
| `!buy <item>` | ✅ | ✅ | ❌ | None | Purchase from shop |
| `!market` | ✅ | ✅ | ✅ | None | View Black Market |

---

## LEADERBOARD COMMANDS

| Command | Kick | Twitch | Discord | Cooldown | Description |
|---------|------|--------|---------|----------|-------------|
| `!lb` | ✅ | ✅ | ✅ | None | Default leaderboard (daily wealth) |
| `!lb daily` | ✅ | ✅ | ✅ | None | Daily wealth top 10 |
| `!lb weekly` | ✅ | ✅ | ✅ | None | Weekly wealth top 10 |
| `!lb monthly` | ✅ | ✅ | ✅ | None | Monthly wealth top 10 |
| `!lb lifetime` | ✅ | ✅ | ✅ | None | Lifetime wealth top 10 |
| `!lb donations` | ✅ | ✅ | ✅ | None | Top contributors (weekly) |
| `!lb chatters` | ✅ | ✅ | ✅ | None | Top chatters (weekly) |
| `!rank` | ✅ | ✅ | ✅ | None | Your rank across periods |

---

## ACHIEVEMENT COMMANDS

| Command | Kick | Twitch | Discord | Cooldown | Description |
|---------|------|--------|---------|----------|-------------|
| `!achievements` | ✅ | ✅ | ✅ | None | View your achievements |
| `!achievements @user` | ✅ | ✅ | ✅ | None | View another's achievements |
| `!titles` | ✅ | ✅ | ✅ | None | View unlocked titles |
| `!title <name>` | ✅ | ✅ | ✅ | None | Equip a title |
| `!title none` | ✅ | ✅ | ✅ | None | Remove displayed title |

---

## MISSION COMMANDS

| Command | Kick | Twitch | Discord | Cooldown | Description |
|---------|------|--------|---------|----------|-------------|
| `!missions` | ✅ | ✅ | ✅ | None | View all active missions |
| `!missions daily` | ✅ | ✅ | ✅ | None | View daily missions |
| `!missions weekly` | ✅ | ✅ | ✅ | None | View weekly missions |

---

## FACTION COMMANDS

| Command | Kick | Twitch | Discord | Cooldown | Description |
|---------|------|--------|---------|----------|-------------|
| `!factions` | ✅ | ✅ | ✅ | None | List all factions |
| `!faction` | ✅ | ✅ | ✅ | None | View your faction |
| `!faction join <name>` | ✅ | ✅ | ✅ | None | Join a faction (Lvl 20+) |
| `!faction leave` | ✅ | ✅ | ✅ | 7d switch CD | Leave your faction |
| `!territories` | ✅ | ✅ | ✅ | None | View territory control map |
| `!territory` | ✅ | ✅ | ✅ | None | View your assigned territory |

---

## JUICERNAUT COMMANDS

| Command | Kick | Twitch | Discord | Cooldown | Description |
|---------|------|--------|---------|----------|-------------|
| `!juice` | ✅ | ✅ | ✅ | None | Current session leaderboard |
| `!juicernaut` | ✅ | ✅ | ✅ | None | Alias for !juice |
| `!juicehall` | ✅ | ✅ | ✅ | None | All-time Juicernaut hall of fame |

---

## ADMIN COMMANDS

| Command | Kick | Twitch | Discord | Permission | Description |
|---------|------|--------|---------|------------|-------------|
| `!startSession` | ✅ | ✅ | ❌ | Mod/Broadcaster | Start new streaming session |
| `!endSession` | ✅ | ✅ | ❌ | Mod/Broadcaster | End current session |
| `!giveWealth <user> <amt>` | ✅ | ✅ | ❌ | Broadcaster | Grant wealth to player |
| `!giveXP <user> <amt>` | ✅ | ✅ | ❌ | Broadcaster | Grant XP to player |
| `!giveItem <user> <item>` | ✅ | ✅ | ❌ | Broadcaster | Grant item to player |
| `!giveCrate <user> <tier>` | ✅ | ✅ | ❌ | Broadcaster | Grant crate to player |
| `!rotateMarket` | ✅ | ✅ | ❌ | Broadcaster | Force Black Market rotation |

---

## DISCORD ADMIN COMMANDS

| Command | Description |
|---------|-------------|
| `!kp-admin setchannel commands` | Set commands-only channel |
| `!kp-admin setchannel feed` | Set feed channel |
| `!kp-admin addchannel activity` | Add activity channel |
| `!kp-admin removechannel activity` | Remove activity channel |
| `!kp-admin listchannels` | View channel configuration |

---

## COMMAND ALIASES

| Primary | Aliases |
|---------|---------|
| `!profile` | `!p`, `!stats` |
| `!balance` | `!bal`, `!money`, `!wealth` |
| `!inventory` | `!inv`, `!items` |
| `!leaderboard` | `!lb`, `!top` |
| `!achievements` | `!achieve`, `!ach` |
| `!juice` | `!juicernaut`, `!jn` |
| `!juicehall` | `!juice hall`, `!jnhall` |

---

## COMMAND OUTPUT EXAMPLES

### !profile
```
👤 SimianMonke [🎖️ Captain]
💰 Wealth: $1,234,567
⭐ Level 65 (45,230 / 52,000 XP)
🔥 Check-in Streak: 14 days
⚔️ Faction: The Volkov Bratva
🏆 Title: [Master Thief]
```

### !inventory
```
📦 Inventory (7/10):
✓ [Weapon] Plasma Cutter (87/100) +10% rob
✓ [Armor] Kevlar Vest (92/100) +8% def
✓ [Business] Neon Nightclub - $1,000-$2,000/2hr
✓ [Housing] Downtown Loft - 35% insurance
  [Weapon] Combat Knife (100/100) +5% rob
  [Weapon] Stun Baton (45/100) +3% rob
  [Armor] Leather Jacket (100/100) +4% def
```

### !lb daily
```
🏆 Daily Wealth Leaderboard:
1. 👑 SimianMonke - $145,230
2. CyberPunk2098 - $98,500
3. NeonRaider - $87,320
4. GhostProtocol - $76,100
5. DataThief99 - $65,800
```

### !missions
```
📋 @PlayerName's Missions

📅 DAILY (expires in 6h 23m):
  ✓ Word on the Street - 15/15 messages ✅
  ○ Hustle - 3/5 !plays
  ○ Self-Reflection - 0/1 profile views

📆 WEEKLY (expires in 4d 6h):
  ○ Regular - 67/100 messages
  ○ Worker - 12/25 !plays
```

### !juice
```
👑 JUICERNAUT STANDINGS:
🥇 SimianMonke - $45.00 (CURRENT JUICERNAUT)
🥈 CyberPunk - $32.00
🥉 NeonRaider - $18.50
```

### !faction
```
⚔️ THE VOLKOV BRATVA
"Кровь за кровь" (Blood for blood)

👥 Members: 127
🏴 Territories: 4/12
  • The Ports (Home)
  • Chrome Heights
  • Neon Mile
  • Rustlands

🎁 Active Buffs:
  +5% XP (Chrome Heights)
  +10% Business Revenue (Neon Mile)
  +10% Business Revenue (Rustlands)
  +5% Rob Success (The Ports)
```

---

## ERROR MESSAGES

| Scenario | Message |
|----------|---------|
| On cooldown | `⏰ That command is on cooldown. Try again in Xh Ym.` |
| In jail | `🚔 You're in jail! Time remaining: Xm. Use !bail to escape.` |
| Not enough wealth | `💸 You need $X to do that. You have $Y.` |
| Item not found | `❌ Item not found in your inventory.` |
| User not found | `❌ User not found.` |
| Inventory full | `📦 Your inventory is full! (10/10)` |
| Level too low | `⚠️ You need to be Level X to do that.` |
| No permission | `🚫 You don't have permission to use this command.` |

---

**END OF DOCUMENT**
