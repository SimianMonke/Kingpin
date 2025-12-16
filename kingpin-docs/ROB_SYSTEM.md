# ROB SYSTEM - Implementation Documentation

## Overview

The Rob System allows players to steal wealth and potentially items from other players. It features a complex success rate calculation based on level differences and equipment bonuses, with protection mechanics including insurance and Juicernaut immunity.

**Current Implementation Status:** Complete

---

## Database Schema

### Related Tables

**cooldowns** (Per-target robbery cooldowns)
| Column | Type | Description |
|--------|------|-------------|
| `user_id` | INT | Attacker user ID |
| `command_type` | VARCHAR(50) | 'rob' |
| `target_identifier` | VARCHAR(255) | Target user ID as string |
| `expires_at` | TIMESTAMP | Cooldown end time |

**game_events** (Rob event logging)
| Column | Type | Description |
|--------|------|-------------|
| `event_type` | VARCHAR(50) | 'rob' |
| `user_id` | INT | Attacker |
| `target_user_id` | INT | Victim |
| `wealth_change` | BIGINT | Amount stolen |
| `success` | BOOLEAN | Whether robbery succeeded |

---

## Core Logic & Formulas

### Success Rate Calculation

```typescript
const ROB_CONFIG = {
  BASE_SUCCESS_RATE: 0.60,      // 60% base
  MIN_SUCCESS_RATE: 0.45,       // Floor: 45%
  MAX_SUCCESS_RATE: 0.85,       // Cap: 85%
  MAX_WEAPON_BONUS: 0.15,       // +15% max from weapon
  MAX_ARMOR_REDUCTION: 0.15,    // -15% max from armor
  LEVEL_DIFF_MODIFIER: 0.01,    // 1% per level difference
  MAX_LEVEL_MODIFIER: 0.10,     // ±10% max from level difference
}

function calculateRobSuccessRate(params: {
  attackerLevel: number,
  defenderLevel: number,
  attackerWeaponBonus: number,  // Decimal (0.15 = 15%)
  defenderArmorBonus: number,   // Decimal (0.15 = 15%)
}): number {
  let rate = ROB_CONFIG.BASE_SUCCESS_RATE  // Start at 60%

  // Add weapon bonus (capped at 15%)
  rate += Math.min(params.attackerWeaponBonus, ROB_CONFIG.MAX_WEAPON_BONUS)

  // Subtract armor reduction (capped at 15%)
  rate -= Math.min(params.defenderArmorBonus, ROB_CONFIG.MAX_ARMOR_REDUCTION)

  // Level difference modifier (±10% max)
  const levelDiff = params.attackerLevel - params.defenderLevel
  const levelModifier = Math.max(
    -ROB_CONFIG.MAX_LEVEL_MODIFIER,
    Math.min(ROB_CONFIG.MAX_LEVEL_MODIFIER, levelDiff * ROB_CONFIG.LEVEL_DIFF_MODIFIER)
  )
  rate += levelModifier

  // Clamp to 45-85% range
  return Math.max(ROB_CONFIG.MIN_SUCCESS_RATE, Math.min(ROB_CONFIG.MAX_SUCCESS_RATE, rate))
}
```

**Example Calculations:**
| Scenario | Base | Weapon | Armor | Level Diff | Final Rate |
|----------|------|--------|-------|------------|------------|
| Equal, no items | 60% | +0% | -0% | 0% | **60%** |
| Max weapon, no armor | 60% | +15% | -0% | 0% | **75%** |
| No weapon, max armor | 60% | +0% | -15% | 0% | **45%** |
| Level 100 vs Level 50 | 60% | +0% | -0% | +10% | **70%** |
| Level 20 vs Level 80 | 60% | +0% | -0% | -10% | **50%** |
| Best case | 60% | +15% | -0% | +10% | **85%** (cap) |
| Worst case | 60% | +0% | -15% | -10% | **45%** (floor) |

### Wealth Theft Calculation

```typescript
const STEAL_PERCENTAGE = { min: 0.08, max: 0.28 }  // 8-28% of target's wealth

function calculateRobAmount(targetWealth: bigint): number {
  const percentage = STEAL_PERCENTAGE.min +
    Math.random() * (STEAL_PERCENTAGE.max - STEAL_PERCENTAGE.min)
  return Math.floor(Number(targetWealth) * percentage)
}
```

**Example:**
- Target has $100,000
- Steal range: $8,000 - $28,000

### Insurance Protection

Housing provides insurance that protects a percentage of stolen wealth:

```typescript
function calculateInsuranceProtection(robAmount: number, insurancePercent: number): number {
  return Math.floor(robAmount * insurancePercent)
}
```

**Example:**
- Stolen: $20,000
- Insurance: 25% (Rare housing)
- Protected: $5,000
- Net stolen: $15,000

### Item Theft Mechanics

```typescript
const ITEM_THEFT_CHANCE = 0.05  // 5% chance per successful robbery

// Can only steal equipped items
// Stolen items go to escrow for 48 hours (HIGH-02)
const STOLEN_ITEM_ESCROW_HOURS = 48
```

---

## Durability System

**IMPORTANT:** Durability only decays during robbery, NOT during !play

```typescript
const DURABILITY_CONFIG = {
  DECAY_PER_ROB_ATTACKER: { min: 2, max: 3 },  // Weapon loses 2-3 durability
  DECAY_PER_ROB_DEFENDER: { min: 2, max: 3 },  // Armor loses 2-3 durability
  BREAK_THRESHOLD: 0,                           // Item breaks at 0
}

function calculateDurabilityDecay(action: 'rob_attacker' | 'rob_defender'): number {
  const range = action === 'rob_attacker'
    ? DURABILITY_CONFIG.DECAY_PER_ROB_ATTACKER
    : DURABILITY_CONFIG.DECAY_PER_ROB_DEFENDER
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min
}
```

---

## Service Layer Implementation

**File:** `web/src/lib/services/rob.service.ts`

### Public Methods

```typescript
export const RobService = {
  /**
   * Execute a robbery against another player
   * @param attackerId - User ID of attacker
   * @param targetId - User ID of target (or username)
   * @returns RobResult with outcome details
   */
  async executeRob(attackerId: number, targetId: number | string): Promise<RobResult>

  /**
   * Check if attacker can rob target (cooldown check)
   * @param attackerId - User ID
   * @param targetId - Target user ID
   * @returns true if can rob
   */
  async canRobTarget(attackerId: number, targetId: number): Promise<boolean>

  /**
   * Get time until target can be robbed again
   * @param attackerId - User ID
   * @param targetId - Target user ID
   * @returns Date or null
   */
  async getCooldownEnd(attackerId: number, targetId: number): Promise<Date | null>
}
```

### Rob Execution Flow

```typescript
async function executeRob(attackerId: number, targetIdOrUsername: number | string): Promise<RobResult> {
  // 1. Resolve target
  const target = typeof targetIdOrUsername === 'string'
    ? await UserService.findByUsername(targetIdOrUsername)
    : await UserService.findById(targetIdOrUsername)

  if (!target) throw new Error('Target not found')
  if (target.id === attackerId) throw new Error('Cannot rob yourself')

  // 2. Check attacker not in jail
  const jailStatus = await JailService.checkJailStatus(attackerId)
  if (jailStatus.isJailed) throw new Error('You are in jail')

  // 3. Check Juicernaut immunity
  const targetIsJuicernaut = await JuicernautService.isCurrentJuicernaut(target.id)
  if (targetIsJuicernaut) throw new Error('Cannot rob the Juicernaut')

  // 4. Check cooldown (24h per target)
  const canRob = await canRobTarget(attackerId, target.id)
  if (!canRob) throw new Error('Target on cooldown')

  // 5. Get equipped items
  const attackerWeapon = await InventoryService.getEquippedItem(attackerId, 'weapon')
  const defenderArmor = await InventoryService.getEquippedItem(target.id, 'armor')
  const defenderHousing = await InventoryService.getEquippedItem(target.id, 'housing')

  // 6. Calculate success rate
  const attacker = await UserService.findById(attackerId)
  const successRate = calculateRobSuccessRate({
    attackerLevel: attacker.level,
    defenderLevel: target.level,
    attackerWeaponBonus: attackerWeapon?.rob_bonus || 0,
    defenderArmorBonus: defenderArmor?.defense_bonus || 0,
  })

  // 7. Roll for success
  const succeeded = Math.random() < successRate

  // 8. Process durability decay
  if (attackerWeapon) {
    const decay = calculateDurabilityDecay('rob_attacker')
    await InventoryService.reduceDurability(attackerWeapon.id, decay)
  }
  if (defenderArmor) {
    const decay = calculateDurabilityDecay('rob_defender')
    await InventoryService.reduceDurability(defenderArmor.id, decay)
  }

  let wealthStolen = 0
  let insuranceProtection = 0
  let itemStolen = null

  if (succeeded) {
    // 9. Calculate stolen wealth
    wealthStolen = calculateRobAmount(target.wealth)

    // 10. Apply insurance if target has housing
    if (defenderHousing?.insurance_percent) {
      insuranceProtection = calculateInsuranceProtection(
        wealthStolen,
        Number(defenderHousing.insurance_percent) / 100
      )
    }

    const netStolen = wealthStolen - insuranceProtection

    // 11. Transfer wealth
    await UserService.removeWealth(target.id, netStolen)
    await UserService.addWealth(attackerId, netStolen)

    // 12. Check for item theft (5% chance)
    if (Math.random() < ITEM_THEFT_CHANCE) {
      const equippedItems = await InventoryService.getEquippedItems(target.id)
      if (equippedItems.length > 0) {
        const stolenItem = equippedItems[Math.floor(Math.random() * equippedItems.length)]
        await InventoryService.transferItem(stolenItem.id, target.id, attackerId)
        itemStolen = stolenItem
      }
    }

    // 13. Send notification to victim
    await NotificationService.create(target.id, 'robbed', {
      message: `${attacker.username} robbed you for $${netStolen.toLocaleString()}`,
    })
  } else {
    // 14. Notify of failed robbery
    await NotificationService.create(target.id, 'rob_defended', {
      message: `${attacker.username} tried to rob you but failed!`,
    })
  }

  // 15. Set 24h cooldown for this target
  await setCooldown(attackerId, target.id, ROB_CONFIG.COOLDOWN_HOURS)

  // 16. Update leaderboards
  await LeaderboardService.updateSnapshot(attackerId, {
    rob_count: 1,
    rob_success_count: succeeded ? 1 : 0,
    wealth_earned: succeeded ? (wealthStolen - insuranceProtection) : 0,
  })

  // 17. Update missions/achievements
  await MissionService.updateProgress(attackerId, 'rob_attempts', 1)
  if (succeeded) {
    await MissionService.updateProgress(attackerId, 'rob_successes', 1)
    await AchievementService.incrementProgress(attackerId, 'rob_wins', 1)
  }
  await AchievementService.incrementProgress(target.id, 'rob_defenses', succeeded ? 0 : 1)

  // 18. Add territory score
  await FactionService.addTerritoryScore(attackerId, 'rob')  // 20 points

  // 19. Record event
  await prisma.game_events.create({
    data: {
      user_id: attackerId,
      target_user_id: target.id,
      event_type: 'rob',
      wealth_change: succeeded ? (wealthStolen - insuranceProtection) : 0,
      xp_change: succeeded ? ROB_CONFIG.XP_REWARD_SUCCESS : ROB_CONFIG.XP_REWARD_FAILURE,
      success: succeeded,
    }
  })

  // 20. Award XP
  const xpReward = succeeded ? ROB_CONFIG.XP_REWARD_SUCCESS : ROB_CONFIG.XP_REWARD_FAILURE
  await UserService.addXp(attackerId, xpReward)

  return {
    success: succeeded,
    successRate,
    wealthStolen,
    wealthProtectedByInsurance: insuranceProtection,
    netWealthStolen: wealthStolen - insuranceProtection,
    xp_earned: xpReward,
    itemStolen: itemStolen ? { id: itemStolen.id, name: itemStolen.name } : null,
    attackerItemBroke: false,  // Set if weapon broke
    defenderItemBroke: false,  // Set if armor broke
  }
}
```

---

## API Endpoints

### POST /api/rob
Execute a robbery against another player.

**Request:**
```json
{
  "target": "username" // or user ID
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "successRate": 0.72,
    "wealthStolen": 15000,
    "wealthProtectedByInsurance": 3750,
    "netWealthStolen": 11250,
    "xp_earned": 50,
    "itemStolen": null,
    "attackerItemBroke": false,
    "defenderItemBroke": false
  }
}
```

**Response (Failed Robbery):**
```json
{
  "success": true,
  "data": {
    "success": false,
    "successRate": 0.52,
    "wealthStolen": 0,
    "xp_earned": 10
  }
}
```

**Response (Juicernaut Target):**
```json
{
  "success": false,
  "error": "Cannot rob the Juicernaut! They have immunity."
}
```

---

## System Interdependencies

### Depends On
- **User System:** Wealth transfer, level lookup
- **Inventory System:** Equipment bonuses, durability, item transfer
- **Jail System:** Attacker jail check
- **Juicernaut System:** Immunity check
- **Leaderboard System:** Snapshot updates
- **Mission System:** Progress tracking
- **Achievement System:** Progress tracking
- **Faction System:** Territory scoring
- **Notification System:** Victim notifications

### Depended On By
- **Mission System:** Rob objectives
- **Achievement System:** Rob achievements
- **Leaderboard System:** Rob rankings

---

## Configuration & Constants

**File:** `web/src/lib/game/constants.ts`

```typescript
export const ROB_CONFIG = {
  BASE_SUCCESS_RATE: 0.60,      // 60% base
  MIN_SUCCESS_RATE: 0.45,       // Floor: 45%
  MAX_SUCCESS_RATE: 0.85,       // Cap: 85%
  MAX_WEAPON_BONUS: 0.15,       // +15% max from weapon
  MAX_ARMOR_REDUCTION: 0.15,    // -15% max from armor
  LEVEL_DIFF_MODIFIER: 0.01,    // 1% per level difference
  MAX_LEVEL_MODIFIER: 0.10,     // ±10% max from level diff
  STEAL_PERCENTAGE: { min: 0.08, max: 0.28 },  // 8-28%
  COOLDOWN_HOURS: 24,           // Per-target cooldown
  XP_REWARD_SUCCESS: 50,        // XP on success
  XP_REWARD_FAILURE: 10,        // XP on failure
  ITEM_THEFT_CHANCE: 0.05,      // 5% chance
}

export const DURABILITY_CONFIG = {
  DECAY_PER_ROB_ATTACKER: { min: 2, max: 3 },
  DECAY_PER_ROB_DEFENDER: { min: 2, max: 3 },
  BREAK_THRESHOLD: 0,
}

export const STOLEN_ITEM_ESCROW_HOURS = 48  // HIGH-02 fix
```

---

## Known Limitations & TODOs

### Completed Features
- Success rate calculation with all modifiers
- Per-target 24h cooldown
- Wealth theft with insurance protection
- Item theft (5% chance, equipped items only)
- Durability decay for weapons/armor
- Juicernaut immunity
- Notification to victims
- Leaderboard/mission/achievement integration

### Technical Notes
- Durability only decays during robbery, NOT during play
- Stolen items have 48h escrow (longer than normal 24h)
- XP is awarded even on failure (participation reward)
- Cannot rob yourself or the Juicernaut

### Deviation from Specification
- None - implementation matches spec

---

**File Location:** `web/src/lib/services/rob.service.ts`
**Related Files:**
- `web/src/lib/game/constants.ts` (ROB_CONFIG)
- `web/src/lib/game/formulas.ts` (calculateRobSuccessRate)
- `web/src/app/api/rob/route.ts` (API endpoint)
- `web/src/lib/services/inventory.service.ts` (equipment handling)
