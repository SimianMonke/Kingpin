# 04. ITEMS & INVENTORY SYSTEM

---

## OVERVIEW

Items provide stat bonuses, passive income, and protection. Players can equip one item per slot (weapon, armor, business, housing). All items have durability and degrade with use. Items are obtained through shops, Black Market, crates, and robbery.

---

## ITEM TYPES

| Type | Slot | Primary Stat | Usage |
|------|------|--------------|-------|
| Weapon | weapon | Rob success bonus | Used in !rob attacks |
| Armor | armor | Defense bonus | Used in !rob defense |
| Business | business | Revenue per cycle | Generates passive income |
| Housing | housing | Insurance % | Reduces rob losses |

---

## ITEM TIERS

| Tier | Rarity | Stat Range | Shop Availability |
|------|--------|------------|-------------------|
| Common | Very common | Low | All tiers |
| Uncommon | Common | Medium | Associate+ |
| Rare | Uncommon | High | Captain+ |
| Legendary | Very rare | Maximum | Black Market only |

---

## ITEM STATS BY TYPE

### Weapons

| Tier | Rob Bonus | Durability | Base Price |
|------|-----------|------------|------------|
| Common | +3-5% | 100 | $2,000 - $5,000 |
| Uncommon | +6-9% | 100 | $8,000 - $15,000 |
| Rare | +10-12% | 100 | $25,000 - $50,000 |
| Legendary | +13-15% | 100 | $100,000 - $200,000 |

### Armor

| Tier | Defense Bonus | Durability | Base Price |
|------|---------------|------------|------------|
| Common | +3-5% | 100 | $2,000 - $5,000 |
| Uncommon | +6-9% | 100 | $8,000 - $15,000 |
| Rare | +10-12% | 100 | $25,000 - $50,000 |
| Legendary | +13-15% | 100 | $100,000 - $200,000 |

### Businesses

| Tier | Revenue Range | Cycle Time | Base Price |
|------|---------------|------------|------------|
| Common | $200 - $500 | 2 hours | $5,000 - $10,000 |
| Uncommon | $500 - $1,000 | 2 hours | $15,000 - $30,000 |
| Rare | $1,000 - $2,000 | 2 hours | $50,000 - $100,000 |
| Legendary | $2,000 - $4,000 | 2 hours | $200,000 - $400,000 |

### Housing

| Tier | Insurance % | Base Price |
|------|-------------|------------|
| Common | 10% | $10,000 - $20,000 |
| Uncommon | 20% | $30,000 - $60,000 |
| Rare | 35% | $100,000 - $200,000 |
| Legendary | 50% | $500,000 - $1,000,000 |

---

## DURABILITY

### Base Values
- All items start at 100 durability
- Items are destroyed at 0 durability

### Degradation Rates

| Action | Weapon Loss | Armor Loss |
|--------|-------------|------------|
| !play | 1-2 | 0 |
| !rob (attacker) | 2-3 | 0 |
| !rob (defender) | 0 | 2-3 |

### Durability Loss Logic
```javascript
function degradeItem(item, minLoss, maxLoss) {
    const loss = minLoss + Math.floor(Math.random() * (maxLoss - minLoss + 1));
    item.durability = Math.max(0, item.durability - loss);
    
    if (item.durability === 0) {
        destroyItem(item);
        return { destroyed: true, item };
    }
    
    return { destroyed: false, loss };
}
```

### Destruction Announcement
```
💥 Your Plasma Cutter has broken and been destroyed!
```

---

## INVENTORY

### Limits

| Attribute | Value |
|-----------|-------|
| Max inventory slots | 10 items |
| Equipped items | 1 per slot (weapon, armor, business, housing) |
| Escrow slots | 3 items (1 hour to claim) |

### Inventory Full Handling
- Items from crates go to escrow if inventory full
- Items from robbery go to escrow if inventory full
- Purchased items blocked if inventory full
- Escrow items expire after 1 hour

---

## EQUIPMENT SLOTS

| Slot | Item Type | Max Equipped |
|------|-----------|--------------|
| weapon | Weapon | 1 |
| armor | Armor | 1 |
| business | Business | 1 |
| housing | Housing | 1 |

### Equip Logic
```javascript
async function equipItem(userId, itemId) {
    const item = await getInventoryItem(userId, itemId);
    if (!item) throw new Error('Item not in inventory');
    
    // Unequip current item in that slot
    await unequipSlot(userId, item.type);
    
    // Equip new item
    await db.query(`
        UPDATE user_inventory
        SET is_equipped = TRUE, slot = $3, equipped_at = NOW()
        WHERE user_id = $1 AND inventory_id = $2
    `, [userId, itemId, item.type]);
}
```

---

## SHOPS

There are TWO distinct shop systems:

### 1. Player Shop (Personal)
- **Unique to each player** - no one else can see or buy from your shop
- Inventory determined by player's tier
- Refreshes periodically or via channel point redemption (!reroll)
- Items purchased go to YOUR inventory
- Cannot sell to other players

### 2. Black Market (Global)
- **Same for all players** - everyone sees the same inventory
- Limited stock per item (when sold out, it's gone until rotation)
- Rotates every 6 hours
- Contains Legendary items (not available in player shops)
- First come, first served

---

## PLAYER SHOP

### Tier-Based Shop Access

| Player Tier | Shop Contents |
|-------------|---------------|
| Rookie | Common items only |
| Associate | Common + Uncommon items |
| Soldier | Common + Uncommon items (more variety) |
| Captain | Common + Uncommon + Rare items |
| Underboss | All tiers except Legendary |
| Kingpin | All tiers except Legendary |

**Note:** Legendary items are Black Market exclusive and NEVER appear in player shops.

### Shop Inventory
- 6-10 items available at any time
- Selection is RANDOM from available tiers
- Each player has their own unique selection
- Two players of the same tier will see DIFFERENT items

### Shop Refresh (!reroll)

| Platform | Trigger | API Source |
|----------|---------|------------|
| Kick | Channel point redemption | Webhook: `channel.reward.redemption.updated` |
| Twitch | Channel point redemption | EventSub: `channel.channel_points_custom_reward_redemption.add` |
| Discord | NOT AVAILABLE | Channel points only |

**Important:** Shop refresh is NOT a chat command. It is triggered by redeeming channel points.

### Refresh Behavior
- Generates new random selection from player's available tiers
- Old shop inventory is replaced entirely
- No cooldown (costs channel points each time)
- Announced in chat: "🔄 @Player rerolled their shop!"

---

## BLACK MARKET

### Rotation Schedule
- Refreshes every 6 hours
- All players see same inventory

### Inventory Composition

| Slot | Tier | Stock |
|------|------|-------|
| 1 | Legendary (30% chance) | 1-3 |
| 2-3 | Rare | 3-8 |
| 4-6 | Uncommon | 5-10 |
| 7-9 | Common | 10-20 |
| Featured | Random (25% discount) | 1 |

### Black Market Access
- View: `!market` command (all platforms)
- Purchase: Website only

### Stock Tracking
- Each item has limited stock
- Once sold out, item unavailable until next rotation
- Stock shared across all players

---

## PURCHASE FLOW

### Shop Purchase (Chat)
```
1. Player uses !buy <item_name>
2. Validate item exists in player's shop
3. Check player has enough wealth
4. Check inventory not full
5. Deduct wealth
6. Add item to inventory
7. Announce purchase
```

### Black Market Purchase (Website Only)
```
1. Player selects item on website
2. Validate item in stock
3. Check player has enough wealth
4. Check inventory not full
5. Deduct wealth
6. Decrement stock
7. Add item to inventory
8. Update website UI
```

---

## BUSINESS REVENUE

### Collection Command
- Command: Business revenue collected automatically or via command
- Cooldown: 2 hours between collections

### Revenue Calculation
```javascript
function calculateBusinessRevenue(business, hasJuicernautBuff) {
    const min = business.revenueMin;
    const max = business.revenueMax;
    let revenue = min + Math.floor(Math.random() * (max - min + 1));
    
    if (hasJuicernautBuff) {
        revenue = Math.floor(revenue * 1.5); // 50% bonus
    }
    
    return revenue;
}
```

### Revenue Announcement
```
💼 @PlayerName collected $1,847 from their Neon Nightclub!
```

---

## DATABASE SCHEMA

### Items Table (Reference)
```sql
CREATE TABLE items (
    item_id SERIAL PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL UNIQUE,
    item_type VARCHAR(50) NOT NULL, -- 'weapon', 'armor', 'business', 'housing'
    tier VARCHAR(50) NOT NULL, -- 'common', 'uncommon', 'rare', 'legendary'
    
    -- Stats
    base_durability INTEGER DEFAULT 100,
    rob_bonus DECIMAL(5,2), -- For weapons
    defense_bonus DECIMAL(5,2), -- For armor
    revenue_min INTEGER, -- For businesses
    revenue_max INTEGER, -- For businesses
    insurance_percent DECIMAL(5,2), -- For housing
    
    -- Economy
    purchase_price INTEGER NOT NULL,
    sell_price INTEGER, -- Usually 50% of purchase
    
    -- Flavor
    description TEXT,
    flavor_text TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### User Inventory Table
```sql
CREATE TABLE user_inventory (
    inventory_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES items(item_id),
    
    -- Item state
    durability INTEGER NOT NULL,
    is_equipped BOOLEAN DEFAULT FALSE,
    slot VARCHAR(50), -- 'weapon', 'armor', 'business', 'housing'
    
    -- Escrow
    is_escrowed BOOLEAN DEFAULT FALSE,
    escrow_expires_at TIMESTAMP,
    
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    equipped_at TIMESTAMP
);

CREATE INDEX idx_inventory_user ON user_inventory(user_id);
CREATE INDEX idx_inventory_equipped ON user_inventory(user_id, is_equipped);
CREATE INDEX idx_inventory_escrow ON user_inventory(is_escrowed, escrow_expires_at);
```

### Black Market Inventory
```sql
CREATE TABLE black_market_inventory (
    market_id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES items(item_id),
    
    stock_quantity INTEGER NOT NULL,
    original_stock INTEGER NOT NULL,
    price INTEGER NOT NULL,
    
    rotation_id INTEGER NOT NULL,
    available_from TIMESTAMP NOT NULL,
    available_until TIMESTAMP NOT NULL,
    
    is_featured BOOLEAN DEFAULT FALSE,
    discount_percent INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## CHAT COMMANDS

| Command | Platform | Description |
|---------|----------|-------------|
| `!inventory` | All | View your inventory |
| `!equip <item>` | All | Equip an item |
| `!unequip <slot>` | All | Unequip a slot |
| `!shop` | All | View tier-based shop |
| `!buy <item>` | Kick/Twitch | Purchase from shop |
| `!market` | All | View Black Market |

### Inventory Output
```
📦 Inventory (7/10):
✓ [Weapon] Plasma Cutter (87/100 dur) +10% rob
✓ [Armor] Kevlar Vest (92/100 dur) +8% def
✓ [Business] Neon Nightclub - $1,000-$2,000/2hr
✓ [Housing] Downtown Loft - 35% insurance
  [Weapon] Combat Knife (100/100 dur) +5% rob
  [Weapon] Stun Baton (45/100 dur) +3% rob
  [Armor] Leather Jacket (100/100 dur) +4% def
```

---

## SAMPLE ITEMS

### Weapons

| Name | Tier | Rob Bonus | Price | Flavor |
|------|------|-----------|-------|--------|
| Combat Knife | Common | +4% | $3,000 | Close quarters classic. |
| Stun Baton | Common | +5% | $4,500 | Non-lethal but effective. |
| Plasma Cutter | Uncommon | +7% | $12,000 | Industrial tool, creative uses. |
| Neural Disruptor | Uncommon | +8% | $15,000 | Scrambles synapses temporarily. |
| Monofilament Wire | Rare | +11% | $35,000 | Cuts through almost anything. |
| Railgun Pistol | Rare | +12% | $45,000 | Miniaturized magnetic acceleration. |
| Quantum Blade | Legendary | +14% | $150,000 | Phase-shifts through armor. |
| Singularity Gun | Legendary | +15% | $200,000 | Creates localized gravitational anomalies. |

### Armor

| Name | Tier | Defense | Price | Flavor |
|------|------|---------|-------|--------|
| Leather Jacket | Common | +4% | $3,000 | Style over substance. |
| Kevlar Vest | Common | +5% | $4,500 | Standard protection. |
| Reflex Armor | Uncommon | +7% | $12,000 | Hardens on impact. |
| Stealth Suit | Uncommon | +8% | $15,000 | Light-bending fibers. |
| Exoskeleton Frame | Rare | +11% | $35,000 | Powered defensive system. |
| Nano-Weave Coat | Rare | +12% | $45,000 | Self-repairing micro-armor. |
| Ghost Protocol Armor | Legendary | +14% | $150,000 | Makes you nearly impossible to hit. |
| Titan Shell | Legendary | +15% | $200,000 | Military-grade mobile fortress. |

### Businesses

| Name | Tier | Revenue | Price | Flavor |
|------|------|---------|-------|--------|
| Stim Stand | Common | $200-$500 | $7,500 | Legal stimulants, mostly. |
| Pawn Shop | Common | $300-$600 | $10,000 | No questions asked. |
| Retro Arcade | Uncommon | $500-$1,000 | $25,000 | Nostalgia sells. |
| Underground Clinic | Uncommon | $700-$1,200 | $35,000 | Discreet medical services. |
| Data Brokerage | Rare | $1,000-$2,000 | $75,000 | Information is currency. |
| Neon Nightclub | Rare | $1,500-$2,500 | $100,000 | Where the elite unwind. |
| Syndicate Casino | Legendary | $2,500-$4,000 | $300,000 | The house always wins. |
| Neural Network Hub | Legendary | $3,000-$5,000 | $400,000 | Connecting the underworld. |

### Housing

| Name | Tier | Insurance | Price | Flavor |
|------|------|-----------|-------|--------|
| Capsule Pod | Common | 10% | $15,000 | Coffin-sized living. |
| Shared Squat | Common | 10% | $18,000 | Safety in numbers. |
| Studio Flat | Uncommon | 20% | $45,000 | Your own four walls. |
| Mid-Rise Apartment | Uncommon | 20% | $55,000 | Views of the smog. |
| Downtown Loft | Rare | 35% | $150,000 | Above the street chaos. |
| Secure Complex | Rare | 35% | $180,000 | Gated, armed, paranoid. |
| Corporate Penthouse | Legendary | 50% | $750,000 | Living like the enemy. |
| Orbital Villa | Legendary | 50% | $1,000,000 | Above it all, literally. |

---

## EDGE CASES

| Scenario | Handling |
|----------|----------|
| Inventory full when buying | Reject: "Inventory full!" |
| Item breaks during use | Destroy, unequip slot, announce |
| Equip item already equipped | No-op, already equipped |
| Equip item not in inventory | Error: "Item not found" |
| Black Market item out of stock | Reject: "Sold out!" |
| Escrow expires | Item deleted, notification sent |
| Sell item while equipped | Must unequip first |

---

**END OF DOCUMENT**
