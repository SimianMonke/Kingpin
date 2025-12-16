# INVENTORY SYSTEM - Implementation Documentation

## Overview

The Inventory System manages item ownership, equipping, durability tracking, shops (player and black market), and the escrow system for stolen/dropped items.

**Current Implementation Status:** Complete

---

## Database Schema

### Primary Table: `user_inventory`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Inventory entry ID |
| `user_id` | INT (FK) | Owner user ID |
| `item_id` | INT (FK) | Reference to items table |
| `durability` | INT | Current durability |
| `is_equipped` | BOOLEAN | Whether item is equipped |
| `slot` | VARCHAR(50) | Equipment slot (weapon, armor, business, housing) |
| `is_escrowed` | BOOLEAN | Whether item is in escrow |
| `escrow_expires_at` | TIMESTAMP | When escrow ends |
| `acquired_at` | TIMESTAMP | When item was obtained |
| `equipped_at` | TIMESTAMP | When item was last equipped |

### Items Definition Table: `items`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Item ID |
| `name` | VARCHAR(100) | Unique item name |
| `type` | VARCHAR(50) | weapon, armor, business, housing |
| `tier` | VARCHAR(50) | common, uncommon, rare, legendary |
| `base_durability` | INT | Starting durability (default: 100) |
| `rob_bonus` | DECIMAL(5,2) | Attack bonus for weapons |
| `defense_bonus` | DECIMAL(5,2) | Defense bonus for armor |
| `revenue_min` | INT | Min business revenue |
| `revenue_max` | INT | Max business revenue |
| `insurance_percent` | DECIMAL(5,2) | Housing insurance % |
| `purchase_price` | INT | Shop buy price |
| `sell_price` | INT | Sell value |
| `description` | TEXT | Item description |
| `flavor_text` | TEXT | Flavor/lore text |
| `daily_revenue_potential` | INT | Business daily potential |
| `upkeep_cost` | INT | Housing daily upkeep |
| `operating_cost` | INT | Business operating cost |

### Player Shop: `player_shop_inventory`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Entry ID |
| `user_id` | INT (FK) | Shop owner |
| `item_id` | INT (FK) | Item for sale |
| `price` | INT | Sale price |
| `generated_at` | TIMESTAMP | When shop was generated |
| `expires_at` | TIMESTAMP | When shop expires |

### Black Market: `black_market_inventory`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT (PK) | Entry ID |
| `item_id` | INT (FK) | Item for sale |
| `stock_quantity` | INT | Available stock |
| `original_stock` | INT | Starting stock |
| `is_featured` | BOOLEAN | Featured item flag |
| `discount_percent` | INT | Discount % |
| `available_until` | TIMESTAMP | Rotation end time |
| `created_at` | TIMESTAMP | When added |

---

## Core Logic & Configuration

### Inventory Limits

```typescript
const MAX_INVENTORY_SIZE = 10      // Maximum inventory slots
const MAX_ITEM_ESCROW = 3          // Maximum escrowed items
const ITEM_ESCROW_HOURS = 24       // Normal item escrow duration
const STOLEN_ITEM_ESCROW_HOURS = 48 // Stolen item escrow (HIGH-02)
```

### Equipment Slots

```typescript
const EQUIPMENT_SLOTS = ['weapon', 'armor', 'business', 'housing']
type EquipmentSlot = 'weapon' | 'armor' | 'business' | 'housing'
```

### Item Types and Tiers

```typescript
const ITEM_TYPES = {
  WEAPON: 'weapon',    // Provides rob_bonus
  ARMOR: 'armor',      // Provides defense_bonus
  BUSINESS: 'business', // Generates revenue
  HOUSING: 'housing',  // Provides insurance
}

const ITEM_TIERS = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  LEGENDARY: 'legendary',
}
```

### Item Stats by Type

**Weapons (rob_bonus):**
| Tier | Rob Bonus Range |
|------|-----------------|
| Common | 0-5% |
| Uncommon | 5-8% |
| Rare | 8-12% |
| Legendary | 12-15% |

**Armor (defense_bonus):**
| Tier | Defense Bonus Range |
|------|---------------------|
| Common | 0-5% |
| Uncommon | 5-8% |
| Rare | 8-12% |
| Legendary | 12-15% |

**Housing (insurance_percent):**
| Tier | Insurance Range |
|------|-----------------|
| Common | 5-10% |
| Uncommon | 12-18% |
| Rare | 20-28% |
| Legendary | 30-40% |

**Business (daily revenue):**
| Tier | Daily Revenue |
|------|---------------|
| Common | $2,000 - $5,000 |
| Uncommon | $6,000 - $15,000 |
| Rare | $18,000 - $35,000 |
| Legendary | $40,000 - $80,000 |

---

## Service Layer Implementation

**Files:**
- `web/src/lib/services/inventory.service.ts`
- `web/src/lib/services/shop.service.ts`
- `web/src/lib/services/black-market.service.ts`

### InventoryService Methods

```typescript
export const InventoryService = {
  // Get user's full inventory
  async getInventory(userId: number): Promise<InventoryItem[]>

  // Get equipped items
  async getEquippedItems(userId: number): Promise<EquippedItems>

  // Get specific equipped item
  async getEquippedItem(userId: number, slot: EquipmentSlot): Promise<InventoryItem | null>

  // Equip an item
  async equipItem(userId: number, inventoryId: number): Promise<void>

  // Unequip an item
  async unequipItem(userId: number, inventoryId: number): Promise<void>

  // Add item to inventory
  async addItem(userId: number, itemId: number, escrow?: boolean): Promise<InventoryItem>

  // Remove item from inventory
  async removeItem(inventoryId: number): Promise<void>

  // Reduce item durability
  async reduceDurability(inventoryId: number, amount: number): Promise<{ destroyed: boolean }>

  // Transfer item between users
  async transferItem(inventoryId: number, fromUserId: number, toUserId: number): Promise<void>

  // Get escrow items
  async getEscrowItems(userId: number): Promise<InventoryItem[]>

  // Claim item from escrow
  async claimFromEscrow(userId: number, inventoryId: number): Promise<void>

  // Check inventory space
  async hasSpace(userId: number): Promise<boolean>

  // Degrade attacker weapon (robbery)
  async degradeAttackerWeapon(userId: number, tx?: PrismaTransactionClient): Promise<DegradeResult>

  // Degrade defender armor (robbery)
  async degradeDefenderArmor(userId: number, tx?: PrismaTransactionClient): Promise<DegradeResult>
}
```

### ShopService Methods

```typescript
export const ShopService = {
  // Get player's shop (generates if needed)
  async getPlayerShop(userId: number): Promise<ShopItem[]>

  // Purchase item from shop
  async purchaseItem(userId: number, shopItemId: number): Promise<PurchaseResult>

  // Refresh player shop (costs premium currency)
  async refreshShop(userId: number): Promise<ShopItem[]>

  // Generate new shop inventory for user
  async generateShop(userId: number, tier: Tier): Promise<void>
}
```

### BlackMarketService Methods

```typescript
export const BlackMarketService = {
  // Get current black market inventory
  async getInventory(): Promise<BlackMarketItem[]>

  // Purchase item from black market
  async purchaseItem(userId: number, marketItemId: number): Promise<PurchaseResult>

  // Rotate black market (scheduled job)
  async rotateInventory(): Promise<void>

  // Get featured item
  async getFeaturedItem(): Promise<BlackMarketItem | null>
}
```

---

## Equip/Unequip Logic

```typescript
async function equipItem(userId: number, inventoryId: number): Promise<void> {
  const item = await getInventoryItem(inventoryId)

  if (!item || item.user_id !== userId) {
    throw new Error('Item not found')
  }

  if (item.is_escrowed) {
    throw new Error('Cannot equip escrowed items')
  }

  // Determine slot from item type
  const slot = item.items.type as EquipmentSlot

  // Unequip any existing item in same slot
  await prisma.user_inventory.updateMany({
    where: {
      user_id: userId,
      slot,
      is_equipped: true,
    },
    data: {
      is_equipped: false,
      slot: null,
      equipped_at: null,
    },
  })

  // Equip new item
  await prisma.user_inventory.update({
    where: { id: inventoryId },
    data: {
      is_equipped: true,
      slot,
      equipped_at: new Date(),
    },
  })
}
```

---

## Shop Generation Logic

### Player Shop

```typescript
const PLAYER_SHOP_CONFIG = {
  ITEMS_COUNT: { min: 6, max: 10 },
  TIER_ACCESS: {
    Rookie: ['common'],
    Associate: ['common', 'uncommon'],
    Soldier: ['common', 'uncommon', 'rare'],
    Captain: ['common', 'uncommon', 'rare'],
    Underboss: ['uncommon', 'rare'],
    Kingpin: ['uncommon', 'rare'],
  },
}

async function generatePlayerShop(userId: number, tier: Tier): Promise<void> {
  const availableTiers = PLAYER_SHOP_CONFIG.TIER_ACCESS[tier]
  const itemCount = randomInt(
    PLAYER_SHOP_CONFIG.ITEMS_COUNT.min,
    PLAYER_SHOP_CONFIG.ITEMS_COUNT.max
  )

  // Get random items from available tiers
  const items = await prisma.items.findMany({
    where: { tier: { in: availableTiers } },
    take: itemCount * 2,  // Get extra for randomization
  })

  const shuffled = shuffle(items).slice(0, itemCount)

  // Create shop entries
  await prisma.player_shop_inventory.createMany({
    data: shuffled.map(item => ({
      user_id: userId,
      item_id: item.id,
      price: item.purchase_price,
      generated_at: new Date(),
      expires_at: getShopExpiry(),  // Daily reset
    })),
  })
}
```

### Black Market

```typescript
const BLACK_MARKET_CONFIG = {
  ROTATION_HOURS: 6,
  LEGENDARY_CHANCE: 0.30,
  RARE_COUNT: { min: 2, max: 3 },
  UNCOMMON_COUNT: { min: 3, max: 5 },
  COMMON_COUNT: { min: 3, max: 5 },
  FEATURED_DISCOUNT: 0.25,
  STOCK_RANGES: {
    legendary: { min: 1, max: 3 },
    rare: { min: 3, max: 8 },
    uncommon: { min: 5, max: 10 },
    common: { min: 10, max: 20 },
  },
}

async function rotateBlackMarket(): Promise<void> {
  // Clear old inventory
  await prisma.black_market_inventory.deleteMany({})

  // 30% chance for legendary
  if (Math.random() < BLACK_MARKET_CONFIG.LEGENDARY_CHANCE) {
    const legendary = await getRandomItem('legendary')
    await addToBlackMarket(legendary, true)  // Featured
  }

  // Add rare, uncommon, common items
  const rareCount = randomInt(2, 3)
  const uncommonCount = randomInt(3, 5)
  const commonCount = randomInt(3, 5)

  // ... add items with appropriate stock
}
```

---

## Escrow System

### Adding to Escrow

```typescript
async function addItemWithEscrow(
  userId: number,
  itemId: number,
  source: 'dropped' | 'stolen'
): Promise<void> {
  const escrowHours = source === 'stolen'
    ? STOLEN_ITEM_ESCROW_HOURS  // 48 hours
    : ITEM_ESCROW_HOURS         // 24 hours

  const escrowExpires = new Date()
  escrowExpires.setHours(escrowExpires.getHours() + escrowHours)

  // Check escrow slots
  const escrowCount = await prisma.user_inventory.count({
    where: { user_id: userId, is_escrowed: true },
  })

  if (escrowCount >= MAX_ITEM_ESCROW) {
    // Oldest escrow item expires automatically
    await expireOldestEscrow(userId)
  }

  await prisma.user_inventory.create({
    data: {
      user_id: userId,
      item_id: itemId,
      durability: item.base_durability,
      is_escrowed: true,
      escrow_expires_at: escrowExpires,
    },
  })
}
```

### Claiming from Escrow

```typescript
async function claimFromEscrow(userId: number, inventoryId: number): Promise<void> {
  const item = await prisma.user_inventory.findUnique({
    where: { id: inventoryId },
  })

  if (!item || item.user_id !== userId || !item.is_escrowed) {
    throw new Error('Invalid escrow item')
  }

  // Check main inventory has space
  const inventoryCount = await prisma.user_inventory.count({
    where: { user_id: userId, is_escrowed: false },
  })

  if (inventoryCount >= MAX_INVENTORY_SIZE) {
    throw new Error('Inventory full')
  }

  await prisma.user_inventory.update({
    where: { id: inventoryId },
    data: {
      is_escrowed: false,
      escrow_expires_at: null,
    },
  })
}
```

---

## API Endpoints

### GET /api/users/me/inventory
Get user's inventory.

### POST /api/users/me/inventory/equip
Equip an item.

### POST /api/users/me/inventory/unequip
Unequip an item.

### GET /api/market
Get player shop and black market.

### POST /api/market/buy
Purchase item from shop or black market.

### GET /api/users/me/shop/reroll
Reroll player shop (premium currency).

---

## System Interdependencies

### Depends On
- **User System:** Wealth deduction for purchases
- **Database Layer:** Item storage

### Depended On By
- **Rob System:** Equipment bonuses, item theft, durability decay
- **Play System:** Crate drop item rewards
- **Crate System:** Item distribution
- **Business System:** Business item revenue
- **Housing System:** Housing upkeep, insurance

---

## Configuration & Constants

```typescript
// Inventory limits
const MAX_INVENTORY_SIZE = 10
const MAX_ITEM_ESCROW = 3
const ITEM_ESCROW_HOURS = 24
const STOLEN_ITEM_ESCROW_HOURS = 48

// Equipment slots
const EQUIPMENT_SLOTS = ['weapon', 'armor', 'business', 'housing']

// Durability
const DURABILITY_CONFIG = {
  DECAY_PER_ROB_ATTACKER: { min: 2, max: 3 },
  DECAY_PER_ROB_DEFENDER: { min: 2, max: 3 },
  BREAK_THRESHOLD: 0,
}

// Business revenue (collected every 3 hours)
const BUSINESS_REVENUE_CONFIG = {
  INTERVAL_HOURS: 3,
  CALCULATIONS_PER_DAY: 8,
  VARIANCE_PERCENT: 20,
}

// Housing upkeep
const HOUSING_UPKEEP_CONFIG = {
  UPKEEP_BY_TIER: {
    common: 100,
    uncommon: 300,
    rare: 800,
    legendary: 2000,
  },
  GRACE_PERIOD_DAYS: 3,
  EVICTION_DAYS: 7,
  DEBUFF_PERCENT: 20,
}
```

---

## Known Limitations & TODOs

### Completed Features
- 4 equipment slots (weapon, armor, business, housing)
- Inventory limit of 10 items
- Escrow system with separate limits (3 items)
- Player shop per tier
- Black Market with 6-hour rotation
- Durability system (robbery only)
- Business revenue generation
- Housing upkeep system

### Technical Notes
- Durability does NOT decay during !play
- Stolen items have longer escrow (48h vs 24h)
- Shop reroll requires premium currency
- Black Market featured item gets 25% discount

---

**File Location:** `web/src/lib/services/inventory.service.ts`
**Related Files:**
- `web/src/lib/services/shop.service.ts`
- `web/src/lib/services/black-market.service.ts`
- `web/src/lib/services/business.service.ts`
- `web/src/lib/services/housing.service.ts`
- `web/src/app/api/market/route.ts`
