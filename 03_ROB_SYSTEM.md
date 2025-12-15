# 03. ROB SYSTEM

---

## OVERVIEW

The rob system enables PvP wealth theft between players. Success is determined by a formula considering weapons, armor, and level differences. Items can be stolen, and defenders receive partial protection through housing insurance.

---

## COMMAND TRIGGER

| Platform | Trigger | API Source |
|----------|---------|------------|
| Kick | Channel point redemption | Webhook: `channel.reward.redemption.updated` |
| Twitch | Channel point redemption | EventSub: `channel.channel_points_custom_reward_redemption.add` |
| Discord | NOT AVAILABLE | Channel points only |

**Important:** This is NOT a chat command (!rob). It is triggered by redeeming channel points on Kick or Twitch. The target username is specified in the redemption message/input field.

### Redemption Input
The player types the target username when redeeming:
- Kick: Redemption includes user input field with target name
- Twitch: Redemption includes "user_input" field with target name

### Parsing Target
```javascript
function parseRobTarget(redemptionInput) {
    // Remove @ symbol if present
    const target = redemptionInput.trim().replace(/^@/, '');
    return target.toLowerCase();
}
```

---

## BASIC MECHANICS

| Attribute | Value |
|-----------|-------|
| Cooldown per target | 24 hours |
| Global cooldown | None (can rob different targets back-to-back) |
| Wealth steal range | 8% - 28% of target's wealth |
| Item theft chance | 5% on successful rob |
| XP on success | 50 XP |
| XP on failure | 10 XP (participation) |

---

## SUCCESS RATE CALCULATION

### Formula
```
Base Rate: 60%
+ Attacker Weapon Bonus (0-15%)
- Defender Armor Bonus (0-15%)
+ Level Difference × 1% (max ±10%)
= Final Rate (clamped to 45-85%)
```

### Implementation
```javascript
function calculateRobSuccess(attacker, defender) {
    const baseRate = 0.60;
    
    // Weapon bonus (0-15%)
    const weaponBonus = attacker.equippedWeapon?.robBonus || 0;
    
    // Armor penalty (0-15%)
    const armorPenalty = defender.equippedArmor?.defenseBonus || 0;
    
    // Level difference (±1% per level, max ±10%)
    const levelDiff = attacker.level - defender.level;
    const levelModifier = Math.max(-0.10, Math.min(0.10, levelDiff * 0.01));
    
    // Calculate final rate
    let finalRate = baseRate + weaponBonus - armorPenalty + levelModifier;
    
    // Clamp to 45-85%
    finalRate = Math.max(0.45, Math.min(0.85, finalRate));
    
    return finalRate;
}
```

### Example Calculations

**Example 1: Equal opponents, no gear**
```
Base: 60%
Weapon: +0%
Armor: -0%
Level diff: 0%
Final: 60%
```

**Example 2: Attacker has legendary weapon, defender has no armor**
```
Base: 60%
Weapon: +15%
Armor: -0%
Level diff: 0%
Final: 75%
```

**Example 3: High-level attacker vs low-level defender, both geared**
```
Base: 60%
Weapon: +10%
Armor: -12%
Level diff: +10% (attacker 50 levels higher, capped)
Final: 68%
```

---

## WEALTH THEFT

### Calculation
```javascript
function calculateStolenAmount(defender) {
    // Random percentage between 8-28%
    const stealPercent = 0.08 + (Math.random() * 0.20);
    
    // Calculate base stolen amount
    let stolen = Math.floor(defender.wealth * stealPercent);
    
    // Apply housing insurance reduction
    const insurancePercent = defender.equippedHousing?.insurancePercent || 0;
    const insuranceReduction = stolen * insurancePercent;
    stolen = Math.floor(stolen - insuranceReduction);
    
    return stolen;
}
```

### Insurance Protection

| Housing Tier | Insurance |
|--------------|-----------|
| None | 0% |
| Common | 10% |
| Uncommon | 20% |
| Rare | 35% |
| Legendary | 50% |

### Example
```
Defender wealth: $100,000
Roll: 20% steal
Base stolen: $20,000
Defender has Rare housing (35% insurance)
Insurance reduction: $7,000
Actual stolen: $13,000
```

---

## ITEM THEFT

### Mechanics
- 5% chance on successful rob to steal an EQUIPPED item
- Can ONLY steal from defender's equipped slots (weapon, armor, business, housing)
- Unequipped inventory items are PROTECTED and cannot be stolen
- If defender has no equipped items, no theft occurs
- Stolen item is unequipped from defender and added to attacker's inventory

### Item Theft Logic
```javascript
function attemptItemTheft(defender) {
    if (Math.random() > 0.05) return null;
    
    // Only equipped items can be stolen
    const equippedItems = defender.inventory.filter(i => i.isEquipped);
    if (equippedItems.length === 0) return null;
    
    // Random selection from equipped items only
    const randomIndex = Math.floor(Math.random() * equippedItems.length);
    const stolenItem = equippedItems[randomIndex];
    
    // Unequip from defender
    await unequipItem(defender.user_id, stolenItem.inventory_id);
    
    return stolenItem;
}
```

### Theft Priority (Optional Weighting)
If you want certain slots to be more likely targets:

| Slot | Weight | Reasoning |
|------|--------|-----------|
| Weapon | 35% | Offensive gear, high value |
| Armor | 35% | Defensive gear, high value |
| Business | 20% | Income source |
| Housing | 10% | Insurance, harder to steal |

Or use equal weighting (25% each) for simplicity.

---

## JUICERNAUT IMMUNITY

Players holding the Juicernaut crown are **completely immune** to robbery.

### Check
```javascript
function canBeRobbed(target) {
    // Check for Juicernaut immunity buff
    const immunityBuff = await getActiveBuff(target.user_id, 'juicernaut_immunity');
    if (immunityBuff) return false;
    
    return true;
}
```

### Rejection Message
```
🛡️ @Target is the current Juicernaut and cannot be robbed!
```

---

## COOLDOWNS

### Per-Target Cooldown
- 24 hours after robbing a specific player
- Tracked per attacker-target pair
- Cannot rob same person twice in 24 hours

### Cooldown Storage
```sql
INSERT INTO cooldowns (user_id, command_type, target_identifier, expires_at)
VALUES ($1, 'rob_target', $2, NOW() + INTERVAL '24 hours')
ON CONFLICT (user_id, command_type, target_identifier)
DO UPDATE SET expires_at = NOW() + INTERVAL '24 hours';
```

---

## DURABILITY

Both attacker and defender items lose durability:

| Item | Durability Loss |
|------|-----------------|
| Attacker's weapon | 2-3 |
| Defender's armor | 2-3 |

Items destroyed at 0 durability with announcement.

---

## ROB FLOW

```
1. Player redeems channel points for !rob @target
2. Validate target exists
3. Check if target is Juicernaut (immune)
4. Check attacker-target cooldown (24h)
5. Check target has wealth > $0
6. Calculate success rate
7. Roll for success
8. If successful:
   a. Calculate stolen amount (8-28% with insurance)
   b. Transfer wealth
   c. Roll for item theft (5%)
   d. Award 50 XP to attacker
   e. Decrease item durability
   f. Set 24h cooldown on this target
9. If failed:
   a. Award 10 XP to attacker (participation)
   b. Decrease item durability
   c. Set 24h cooldown on this target
10. Log event for both players
11. Update achievements (rob counts)
12. Announce result
13. Send notification to defender
```

---

## DATABASE SCHEMA

### Rob Event Logging
```sql
INSERT INTO game_events (
    user_id, event_type, wealth_change, xp_change,
    target_user_id, success, event_description
) VALUES (
    $1, 'rob', $2, $3, $4, $5, $6
);
```

### Cooldown Check
```sql
SELECT * FROM cooldowns
WHERE user_id = $1
  AND command_type = 'rob_target'
  AND target_identifier = $2
  AND expires_at > NOW();
```

---

## CHAT ANNOUNCEMENTS

### Successful Rob (No Item)
```
💰 @Attacker robbed @Defender for $13,000! (🛡️ Insurance saved $7,000)
```

### Successful Rob (With Item Theft)
```
💰 @Attacker robbed @Defender for $13,000! (🛡️ Insurance saved $7,000)
🔥 @Attacker also stole @Defender's Plasma Cutter!
```

### Failed Rob
```
❌ @Attacker tried to rob @Defender but failed! Better luck next time.
```

### Blocked by Immunity
```
🛡️ @Defender is the current Juicernaut and cannot be robbed!
```

### On Cooldown
```
⏰ @Attacker: You already robbed @Defender today. Try again in 14h 32m.
```

### Target Has No Money
```
💸 @Defender has no wealth to steal!
```

---

## WEBSITE NOTIFICATIONS

### To Defender (Successful)
```
Title: "You were robbed!"
Message: "@Attacker stole $13,000 from you!"
Icon: 💸
Link: /profile/attacker
```

### To Defender (Failed)
```
Title: "Robbery attempt blocked!"
Message: "@Attacker tried to rob you but failed!"
Icon: 🛡️
Link: /profile/attacker
```

### To Defender (Item Stolen)
```
Title: "Item stolen!"
Message: "@Attacker stole your Plasma Cutter!"
Icon: 🔥
Link: /profile/attacker
```

---

## EDGE CASES

| Scenario | Handling |
|----------|----------|
| Target has $0 | Reject with message: "Target has no wealth to steal" |
| Target goes offline during rob | Rob proceeds normally |
| Target's weapon breaks during defense | Breaks after rob resolves |
| Attacker robs self | Rejected: "You can't rob yourself" |
| Target doesn't exist | Rejected: "User not found" |
| Attacker is jailed | Rejected: "You can't rob while in jail" |
| Target is jailed | Rob proceeds normally (can rob jailed players) |
| Item theft when attacker inventory full | Item goes to escrow |

---

## ACHIEVEMENT TRIGGERS

- `rob_attempts`: Increment on any rob attempt
- `rob_successes`: Increment on successful rob
- `rob_defenses`: Increment for defender on failed rob
- `wealth_stolen`: Track total wealth stolen
- `items_stolen`: Track total items stolen

---

## CONFIGURATION

```javascript
const ROB_CONFIG = {
    baseSuccessRate: 0.60,
    minSuccessRate: 0.45,
    maxSuccessRate: 0.85,
    minStealPercent: 0.08,
    maxStealPercent: 0.28,
    itemTheftChance: 0.05,
    successXP: 50,
    failureXP: 10,
    cooldownHours: 24,
    durabilityLossMin: 2,
    durabilityLossMax: 3
};
```

---

**END OF DOCUMENT**
