// =============================================================================
// KINGPIN GAME CONSTANTS
// Based on specifications from documentation
// =============================================================================

// =============================================================================
// TIER SYSTEM
// =============================================================================

export const TIERS = {
  ROOKIE: 'Rookie',
  ASSOCIATE: 'Associate',
  SOLDIER: 'Soldier',
  CAPTAIN: 'Captain',
  UNDERBOSS: 'Underboss',
  KINGPIN: 'Kingpin',
} as const

export type Tier = typeof TIERS[keyof typeof TIERS]

export const TIER_LEVELS = {
  [TIERS.ROOKIE]: { min: 1, max: 19 },
  [TIERS.ASSOCIATE]: { min: 20, max: 39 },
  [TIERS.SOLDIER]: { min: 40, max: 59 },
  [TIERS.CAPTAIN]: { min: 60, max: 79 },
  [TIERS.UNDERBOSS]: { min: 80, max: 99 },
  [TIERS.KINGPIN]: { min: 100, max: Infinity },
} as const

export const TIER_MULTIPLIERS: Record<Tier, number> = {
  [TIERS.ROOKIE]: 1.0,
  [TIERS.ASSOCIATE]: 1.1,
  [TIERS.SOLDIER]: 1.2,
  [TIERS.CAPTAIN]: 1.3,
  [TIERS.UNDERBOSS]: 1.4,
  [TIERS.KINGPIN]: 1.5,
}

// =============================================================================
// ITEM TYPES & SLOTS
// =============================================================================

export const ITEM_TYPES = {
  WEAPON: 'weapon',
  ARMOR: 'armor',
  BUSINESS: 'business',
  HOUSING: 'housing',
} as const

export type ItemType = typeof ITEM_TYPES[keyof typeof ITEM_TYPES]

export const ITEM_TIERS = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  LEGENDARY: 'legendary',
} as const

export type ItemTier = typeof ITEM_TIERS[keyof typeof ITEM_TIERS]

export const EQUIPMENT_SLOTS = ['weapon', 'armor', 'business', 'housing'] as const
export type EquipmentSlot = typeof EQUIPMENT_SLOTS[number]

export const MAX_INVENTORY_SIZE = 10
export const MAX_ITEM_ESCROW = 3  // CRIT-05: Item escrow limit (separate from crate escrow)
export const ITEM_ESCROW_HOURS = 24 // 24 hours for dropped items
export const STOLEN_ITEM_ESCROW_HOURS = 48 // HIGH-02: 48 hours for stolen items (longer to give victims time)

// =============================================================================
// BUSINESS SYSTEM (Design Drift Remediation)
// =============================================================================

export const MAX_BUSINESSES_OWNED = 3  // Players can own up to 3 businesses

export const BUSINESS_REVENUE_CONFIG = {
  INTERVAL_HOURS: 3,          // Revenue collected every 3 hours
  CALCULATIONS_PER_DAY: 8,    // 24 / 3 = 8 collections per day
  VARIANCE_PERCENT: 20,       // ±20% random variance on revenue
  DAILY_REVENUE_BY_TIER: {
    common: { min: 2000, max: 5000 },
    uncommon: { min: 6000, max: 15000 },
    rare: { min: 18000, max: 35000 },
    legendary: { min: 40000, max: 80000 },
  },
  OPERATING_COST_BY_TIER: {
    common: { min: 200, max: 500 },
    uncommon: { min: 600, max: 1500 },
    rare: { min: 1800, max: 3500 },
    legendary: { min: 4000, max: 8000 },
  },
} as const

// =============================================================================
// HOUSING SYSTEM (Design Drift Remediation)
// =============================================================================

export const HOUSING_UPKEEP_CONFIG = {
  UPKEEP_BY_TIER: {
    common: 100,      // $100/day
    uncommon: 300,    // $300/day
    rare: 800,        // $800/day
    legendary: 2000,  // $2,000/day
  },
  INSURANCE_BY_TIER: {
    common: { min: 5, max: 10 },       // 5-10%
    uncommon: { min: 12, max: 18 },    // 12-18%
    rare: { min: 20, max: 28 },        // 20-28%
    legendary: { min: 30, max: 40 },   // 30-40%
  },
  GRACE_PERIOD_DAYS: 3,    // Days before stat debuff
  EVICTION_DAYS: 7,        // Days before eviction
  DEBUFF_PERCENT: 20,      // 20% stat reduction when overdue
} as const

// =============================================================================
// CRATE SYSTEM
// =============================================================================

export const CRATE_TIERS = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  LEGENDARY: 'legendary',
} as const

export type CrateTier = typeof CRATE_TIERS[keyof typeof CRATE_TIERS]

// Crate inventory limits (per 11_CRATES_LOOT.md spec)
export const MAX_CRATES = 10
export const MAX_CRATE_ESCROW = 3
export const CRATE_ESCROW_HOURS = 1 // 1 hour escrow (different from item escrow)

// Drop type distribution when opening crates (per 11_CRATES_LOOT.md spec)
// Weapon + Armor are separate categories, not combined "item"
export const CRATE_DROP_TABLES = {
  [CRATE_TIERS.COMMON]: {
    weapon: 0.40,    // 40% weapon
    armor: 0.40,     // 40% armor
    wealth: 0.20,    // 20% wealth
    title: 0,        // 0% title
    item_tierWeights: {
      [ITEM_TIERS.COMMON]: 0.85,
      [ITEM_TIERS.UNCOMMON]: 0.15,
      [ITEM_TIERS.RARE]: 0,
      [ITEM_TIERS.LEGENDARY]: 0,
    },
    wealthRange: { min: 500, max: 1500 },
  },
  [CRATE_TIERS.UNCOMMON]: {
    weapon: 0.39,      // MED-01 fix: Titles only from Rare+ crates
    armor: 0.39,       // Redistributed 2% from title
    wealth: 0.22,
    title: 0,          // MED-01: No titles from Uncommon crates
    item_tierWeights: {
      [ITEM_TIERS.COMMON]: 0.40,
      [ITEM_TIERS.UNCOMMON]: 0.50,
      [ITEM_TIERS.RARE]: 0.10,
      [ITEM_TIERS.LEGENDARY]: 0,
    },
    wealthRange: { min: 1500, max: 4000 },
  },
  [CRATE_TIERS.RARE]: {
    weapon: 0.35,
    armor: 0.35,
    wealth: 0.25,
    title: 0.05,
    item_tierWeights: {
      [ITEM_TIERS.COMMON]: 0.10,
      [ITEM_TIERS.UNCOMMON]: 0.40,
      [ITEM_TIERS.RARE]: 0.45,
      [ITEM_TIERS.LEGENDARY]: 0.05,
    },
    wealthRange: { min: 4000, max: 10000 },
  },
  [CRATE_TIERS.LEGENDARY]: {
    weapon: 0.30,
    armor: 0.30,
    wealth: 0.30,
    title: 0.10,
    item_tierWeights: {
      [ITEM_TIERS.COMMON]: 0,
      [ITEM_TIERS.UNCOMMON]: 0.15,
      [ITEM_TIERS.RARE]: 0.50,
      [ITEM_TIERS.LEGENDARY]: 0.35,
    },
    wealthRange: { min: 10000, max: 30000 },
  },
}

// Wealth given when receiving a duplicate title from crate
export const CRATE_TITLE_DUPLICATE_VALUES: Record<CrateTier, number> = {
  [CRATE_TIERS.COMMON]: 500,
  [CRATE_TIERS.UNCOMMON]: 1500,
  [CRATE_TIERS.RARE]: 5000,
  [CRATE_TIERS.LEGENDARY]: 15000,
}

// Crate sources for tracking
export const CRATE_SOURCES = {
  PLAY: 'play',
  CHECKIN_MILESTONE: 'checkin_milestone',
  MISSION: 'mission',
  JUICERNAUT: 'juicernaut',
  ACHIEVEMENT: 'achievement',
  FACTION: 'faction',
  PURCHASE: 'purchase',
  GIFT: 'gift',
} as const

export type CrateSource = typeof CRATE_SOURCES[keyof typeof CRATE_SOURCES]

// Crate drop chances from !play command
export const PLAY_CRATE_DROP_CHANCE = 0.02 // 2% base chance
export const JUICERNAUT_CRATE_MULTIPLIER = 3.0 // 3x for Juicernaut

// CRIT-07: Play event configuration
export const PLAY_CONFIG = {
  NEGATIVE_EVENT_CHANCE: 0.15,  // 15% chance of negative outcome
  MIN_EVENTS_PER_TIER: 10,      // Minimum positive events per tier
}

// =============================================================================
// PLAY COMMAND - TIER-BASED EVENTS
// Based on 02_ECONOMY_PLAY.md specification
// CRIT-07 fix: Expanded to 10+ positive events per tier + 3 negative events
// =============================================================================

// Play event definition
export interface PlayEventDef {
  name: string
  description: string
  wealth: { min: number; max: number }
  xp: { min: number; max: number }
  isNegative?: boolean  // CRIT-07: Flag for negative (loss) events
}

// Tier-specific play events (Phase 12: expanded to 50 events per tier)
// Categories per tier:
// Rookie: Petty Crime, Street Hustles, Scavenging, Information, Survival
// Associate: Protection, Drugs, Vehicles, Gambling, Blackmail
// Soldier: Heists, Convoys, Enforcement, Data, Smuggling
// Captain: Banks, Kidnapping, Arms, Territory, Cyber
// Underboss: Corporate, Political, Syndicate, Markets, Intelligence
// Kingpin: Acquisitions, Government, Manipulation, Power, Ascension
export const TIER_PLAY_EVENTS: Record<Tier, PlayEventDef[]> = {
  [TIERS.ROOKIE]: [
    // ===== PETTY CRIME (10 events) =====
    { name: 'Petty Theft', description: 'Grabbed a tourist\'s wallet in the crowd.', wealth: { min: 50, max: 150 }, xp: { min: 10, max: 20 } },
    { name: 'Alley Mugging', description: 'Cornered a corp drone in the back alleys.', wealth: { min: 80, max: 200 }, xp: { min: 12, max: 25 } },
    { name: 'Shoplifting Spree', description: 'Five-finger discounted some merch.', wealth: { min: 60, max: 140 }, xp: { min: 8, max: 18 } },
    { name: 'Purse Snatch', description: 'Quick grab, quicker feet.', wealth: { min: 70, max: 180 }, xp: { min: 10, max: 22 } },
    { name: 'Transit Pickpocket', description: 'Crowded train, easy marks.', wealth: { min: 90, max: 220 }, xp: { min: 14, max: 28 } },
    { name: 'Parking Meter Raid', description: 'Old tech, easy credits.', wealth: { min: 40, max: 120 }, xp: { min: 6, max: 15 } },
    { name: 'Bike Theft', description: 'Borrowed someone\'s ride permanently.', wealth: { min: 100, max: 250 }, xp: { min: 15, max: 30 } },
    { name: 'Coin Jar Heist', description: 'Raided a laundromat\'s change box.', wealth: { min: 55, max: 130 }, xp: { min: 8, max: 16 } },
    { name: 'Locker Break-in', description: 'Gym lockers hold secrets and cash.', wealth: { min: 75, max: 190 }, xp: { min: 11, max: 24 } },
    { name: 'Charity Can Skim', description: 'Donations redirected to your pocket.', wealth: { min: 65, max: 160 }, xp: { min: 9, max: 20 } },
    // ===== STREET HUSTLES (10 events) =====
    { name: 'Street Hustle', description: 'Sold knockoff stims to desperate workers.', wealth: { min: 100, max: 250 }, xp: { min: 15, max: 30 } },
    { name: 'Three Card Monte', description: 'The hand is quicker than the eye.', wealth: { min: 120, max: 280 }, xp: { min: 18, max: 35 } },
    { name: 'Fake Watch Sale', description: 'Rolex? More like NoLex.', wealth: { min: 90, max: 220 }, xp: { min: 12, max: 26 } },
    { name: 'Shell Game', description: 'Where\'s the ball? Not where they think.', wealth: { min: 110, max: 260 }, xp: { min: 16, max: 32 } },
    { name: 'Bootleg Media', description: 'Sold pirated braindances to tourists.', wealth: { min: 80, max: 200 }, xp: { min: 10, max: 24 } },
    { name: 'Fortune Telling Scam', description: 'Predicted their future: poorer.', wealth: { min: 130, max: 300 }, xp: { min: 20, max: 38 } },
    { name: 'Fake Charity Pitch', description: 'Donations for a cause... your cause.', wealth: { min: 95, max: 230 }, xp: { min: 14, max: 28 } },
    { name: 'Rigged Dice Game', description: 'Lucky sevens, every time for you.', wealth: { min: 140, max: 320 }, xp: { min: 22, max: 42 } },
    { name: 'Knockoff Designer', description: 'Gucci? Sure, from the trunk.', wealth: { min: 105, max: 245 }, xp: { min: 15, max: 30 } },
    { name: 'Panhandling Pro', description: 'Professional sympathy extraction.', wealth: { min: 70, max: 170 }, xp: { min: 8, max: 20 } },
    // ===== SCAVENGING (10 events) =====
    { name: 'Scrap Run', description: 'Stripped a crashed vehicle for parts.', wealth: { min: 150, max: 350 }, xp: { min: 25, max: 45 } },
    { name: 'Dumpster Dive', description: 'Corp waste is street treasure.', wealth: { min: 100, max: 240 }, xp: { min: 15, max: 30 } },
    { name: 'E-Waste Harvest', description: 'Old tech, new profit.', wealth: { min: 130, max: 300 }, xp: { min: 20, max: 38 } },
    { name: 'Construction Site Raid', description: 'Borrowed materials from a build.', wealth: { min: 180, max: 400 }, xp: { min: 28, max: 50 } },
    { name: 'Abandoned Factory', description: 'Stripped copper from dead machinery.', wealth: { min: 160, max: 370 }, xp: { min: 26, max: 48 } },
    { name: 'Junkyard Score', description: 'Found salvageable parts in the heaps.', wealth: { min: 120, max: 280 }, xp: { min: 18, max: 35 } },
    { name: 'Storm Drain Treasure', description: 'What washes down is yours now.', wealth: { min: 90, max: 210 }, xp: { min: 12, max: 26 } },
    { name: 'Foreclosed Property', description: 'Picked clean before demo day.', wealth: { min: 170, max: 380 }, xp: { min: 27, max: 49 } },
    { name: 'Battlefield Salvage', description: 'Gang war aftermath, free loot.', wealth: { min: 200, max: 450 }, xp: { min: 32, max: 55 } },
    { name: 'Warehouse Cleanout', description: 'Abandoned storage, your gain.', wealth: { min: 140, max: 320 }, xp: { min: 22, max: 40 } },
    // ===== INFORMATION (10 events) =====
    { name: 'Info Peddling', description: 'Sold rumors to interested parties.', wealth: { min: 200, max: 450 }, xp: { min: 30, max: 55 } },
    { name: 'Tip Off', description: 'Got paid for watching a certain door.', wealth: { min: 150, max: 350 }, xp: { min: 22, max: 42 } },
    { name: 'Eavesdrop Report', description: 'Overheard something valuable.', wealth: { min: 180, max: 400 }, xp: { min: 28, max: 50 } },
    { name: 'Photo Evidence', description: 'Right place, right time, wrong couple.', wealth: { min: 220, max: 480 }, xp: { min: 35, max: 60 } },
    { name: 'Schedule Leak', description: 'Sold a VIP\'s daily routine.', wealth: { min: 170, max: 380 }, xp: { min: 26, max: 48 } },
    { name: 'Password Sale', description: 'Found login creds, found a buyer.', wealth: { min: 190, max: 420 }, xp: { min: 30, max: 52 } },
    { name: 'Witness for Hire', description: 'Your memory is flexible... for a price.', wealth: { min: 160, max: 360 }, xp: { min: 24, max: 45 } },
    { name: 'Meeting Location', description: 'Told someone where to find someone.', wealth: { min: 140, max: 320 }, xp: { min: 20, max: 40 } },
    { name: 'Voicemail Intercept', description: 'Hacked a cheap phone, sold the msgs.', wealth: { min: 210, max: 460 }, xp: { min: 33, max: 58 } },
    { name: 'Network Map', description: 'Mapped out a gang\'s structure for rivals.', wealth: { min: 250, max: 500 }, xp: { min: 38, max: 65 } },
    // ===== SURVIVAL (5 events) =====
    { name: 'Lucky Find', description: 'Stumbled on a stash someone forgot.', wealth: { min: 200, max: 450 }, xp: { min: 30, max: 50 } },
    { name: 'Fence Job', description: 'Moved hot merchandise for a cut.', wealth: { min: 150, max: 350 }, xp: { min: 22, max: 42 } },
    { name: 'Distraction Scam', description: 'Ran a two-person lift on a mark.', wealth: { min: 170, max: 380 }, xp: { min: 26, max: 46 } },
    { name: 'Vending Hack', description: 'Convinced a machine to dispense free.', wealth: { min: 80, max: 200 }, xp: { min: 10, max: 24 } },
    { name: 'Safe House Rent', description: 'Let someone hide, charged premium.', wealth: { min: 230, max: 500 }, xp: { min: 35, max: 60 } },
    // ===== NEGATIVE EVENTS (5 events) =====
    { name: 'Caught Red-Handed', description: 'Security grabbed you mid-heist.', wealth: { min: -200, max: -50 }, xp: { min: 5, max: 15 }, isNegative: true },
    { name: 'Bad Intel', description: 'Your tip was a setup.', wealth: { min: -150, max: -40 }, xp: { min: 5, max: 12 }, isNegative: true },
    { name: 'Pickpocket Fail', description: 'The mark noticed. Paid them off.', wealth: { min: -120, max: -30 }, xp: { min: 3, max: 10 }, isNegative: true },
    { name: 'Scrap Trap', description: 'Salvage site was being watched.', wealth: { min: -180, max: -45 }, xp: { min: 5, max: 14 }, isNegative: true },
    { name: 'Hustle Busted', description: 'Your mark called the badges.', wealth: { min: -160, max: -35 }, xp: { min: 4, max: 12 }, isNegative: true },
  ],
  [TIERS.ASSOCIATE]: [
    // ===== PROTECTION (10 events) =====
    { name: 'Protection Shakedown', description: 'Shop owner needs "insurance."', wealth: { min: 500, max: 1000 }, xp: { min: 50, max: 80 } },
    { name: 'Weekly Collection', description: 'Regular rounds on your turf.', wealth: { min: 600, max: 1100 }, xp: { min: 55, max: 88 } },
    { name: 'New Business Welcome', description: 'Introduced yourself to a new shop.', wealth: { min: 700, max: 1200 }, xp: { min: 62, max: 95 } },
    { name: 'Insurance Adjustment', description: 'Raised the rates. They paid.', wealth: { min: 800, max: 1350 }, xp: { min: 70, max: 105 } },
    { name: 'Competitor Removal', description: 'Convinced a rival to relocate.', wealth: { min: 900, max: 1450 }, xp: { min: 78, max: 115 } },
    { name: 'Late Fee Enforcement', description: 'Someone was behind on payments.', wealth: { min: 550, max: 1050 }, xp: { min: 52, max: 82 } },
    { name: 'Holiday Bonus', description: 'Seasonal rate increase collected.', wealth: { min: 750, max: 1300 }, xp: { min: 65, max: 100 } },
    { name: 'Restaurant Kickback', description: 'Your table is always reserved.', wealth: { min: 650, max: 1150 }, xp: { min: 58, max: 90 } },
    { name: 'Vendor Fee', description: 'Street sellers need permission.', wealth: { min: 450, max: 950 }, xp: { min: 45, max: 75 } },
    { name: 'Block Party Tax', description: 'Events in your area pay tribute.', wealth: { min: 850, max: 1400 }, xp: { min: 75, max: 110 } },
    // ===== DRUGS (10 events) =====
    { name: 'Drug Courier', description: 'Moved product across district lines.', wealth: { min: 750, max: 1250 }, xp: { min: 65, max: 100 } },
    { name: 'Corner Sales', description: 'Supervised a busy intersection.', wealth: { min: 650, max: 1150 }, xp: { min: 58, max: 92 } },
    { name: 'Stash House Cut', description: 'Your warehouse, your percentage.', wealth: { min: 850, max: 1400 }, xp: { min: 75, max: 112 } },
    { name: 'New Product Launch', description: 'Introduced a new blend to market.', wealth: { min: 950, max: 1500 }, xp: { min: 82, max: 120 } },
    { name: 'Bulk Deal', description: 'Moved a significant quantity.', wealth: { min: 1100, max: 1650 }, xp: { min: 92, max: 135 } },
    { name: 'Party Supply', description: 'Club kids always need more.', wealth: { min: 700, max: 1200 }, xp: { min: 62, max: 95 } },
    { name: 'Medical Diversion', description: 'Prescription goods, street prices.', wealth: { min: 800, max: 1350 }, xp: { min: 70, max: 105 } },
    { name: 'Rehab Referral', description: 'Sent customers to your clinic.', wealth: { min: 600, max: 1100 }, xp: { min: 55, max: 88 } },
    { name: 'Territory Expansion', description: 'Opened a new sales corner.', wealth: { min: 1000, max: 1550 }, xp: { min: 88, max: 125 } },
    { name: 'Supplier Bonus', description: 'Volume discount from your connect.', wealth: { min: 550, max: 1050 }, xp: { min: 50, max: 82 } },
    // ===== VEHICLES (10 events) =====
    { name: 'Chop Shop Delivery', description: 'Dropped off a hot vehicle.', wealth: { min: 1000, max: 1500 }, xp: { min: 85, max: 120 } },
    { name: 'Parts Fence', description: 'Sold components to mechanics.', wealth: { min: 800, max: 1300 }, xp: { min: 70, max: 105 } },
    { name: 'VIN Swap', description: 'New identity for a stolen ride.', wealth: { min: 900, max: 1400 }, xp: { min: 78, max: 112 } },
    { name: 'Getaway Driver', description: 'Clean escape, clean payment.', wealth: { min: 1100, max: 1600 }, xp: { min: 92, max: 128 } },
    { name: 'Street Race Bet', description: 'Your driver won the race.', wealth: { min: 1200, max: 1700 }, xp: { min: 98, max: 135 } },
    { name: 'Repo Job', description: 'Collected a vehicle for a lender.', wealth: { min: 750, max: 1250 }, xp: { min: 65, max: 100 } },
    { name: 'Luxury Lift', description: 'High-end car, high-end price.', wealth: { min: 1300, max: 1800 }, xp: { min: 105, max: 142 } },
    { name: 'Fleet Theft', description: 'Hit a rental company lot.', wealth: { min: 1150, max: 1650 }, xp: { min: 95, max: 132 } },
    { name: 'Motorcycle Ring', description: 'Bikes are easy to move.', wealth: { min: 850, max: 1350 }, xp: { min: 72, max: 108 } },
    { name: 'Trucking Hijack', description: 'Cargo fell off the back.', wealth: { min: 1400, max: 1900 }, xp: { min: 112, max: 148 } },
    // ===== GAMBLING (10 events) =====
    { name: 'Gambling Den Take', description: 'Skimmed profits from a game.', wealth: { min: 1250, max: 1750 }, xp: { min: 102, max: 140 } },
    { name: 'Rigged Fights', description: 'Bet on the predetermined winner.', wealth: { min: 1100, max: 1600 }, xp: { min: 92, max: 128 } },
    { name: 'Numbers Running', description: 'Lottery tickets, your odds.', wealth: { min: 800, max: 1300 }, xp: { min: 70, max: 105 } },
    { name: 'Poker House', description: 'Your table, your rake.', wealth: { min: 950, max: 1450 }, xp: { min: 82, max: 118 } },
    { name: 'Sports Book', description: 'Taking bets on the big game.', wealth: { min: 1050, max: 1550 }, xp: { min: 88, max: 125 } },
    { name: 'Fixed Races', description: 'The dog that should have lost, won.', wealth: { min: 1150, max: 1650 }, xp: { min: 95, max: 132 } },
    { name: 'Dice Games', description: 'Weighted cubes, weighted pockets.', wealth: { min: 700, max: 1200 }, xp: { min: 62, max: 98 } },
    { name: 'High Stakes Loan', description: 'Fronted a gambler, collected interest.', wealth: { min: 1300, max: 1800 }, xp: { min: 105, max: 142 } },
    { name: 'Casino Inside Job', description: 'Employee on payroll shared info.', wealth: { min: 1400, max: 1900 }, xp: { min: 112, max: 150 } },
    { name: 'Private Game Host', description: 'Organized elite underground poker.', wealth: { min: 1200, max: 1700 }, xp: { min: 98, max: 138 } },
    // ===== BLACKMAIL (5 events) =====
    { name: 'Blackmail Collection', description: 'Secrets pay well.', wealth: { min: 1500, max: 2000 }, xp: { min: 120, max: 160 } },
    { name: 'Photo Leverage', description: 'Compromising images, premium price.', wealth: { min: 1350, max: 1850 }, xp: { min: 108, max: 148 } },
    { name: 'Account Records', description: 'Financial dirt on the right target.', wealth: { min: 1450, max: 1950 }, xp: { min: 115, max: 155 } },
    { name: 'Affair Evidence', description: 'Marriage insurance, your way.', wealth: { min: 1250, max: 1750 }, xp: { min: 100, max: 140 } },
    { name: 'Corporate Secret', description: 'Executive indiscretion documented.', wealth: { min: 1600, max: 2000 }, xp: { min: 128, max: 165 } },
    // ===== NEGATIVE EVENTS (5 events) =====
    { name: 'Rival Ambush', description: 'Another crew jumped you.', wealth: { min: -900, max: -250 }, xp: { min: 20, max: 45 }, isNegative: true },
    { name: 'Cop Shakedown', description: 'Badge wanted his cut.', wealth: { min: -700, max: -180 }, xp: { min: 15, max: 35 }, isNegative: true },
    { name: 'Bad Product', description: 'Your supplier burned you.', wealth: { min: -600, max: -150 }, xp: { min: 12, max: 30 }, isNegative: true },
    { name: 'Gambling Bust', description: 'Raid on your game. Lost the pot.', wealth: { min: -850, max: -220 }, xp: { min: 18, max: 42 }, isNegative: true },
    { name: 'Vehicle Traced', description: 'Hot car led back to you.', wealth: { min: -750, max: -200 }, xp: { min: 16, max: 38 }, isNegative: true },
  ],
  [TIERS.SOLDIER]: [
    // ===== HEISTS (10 events) =====
    { name: 'Warehouse Heist', description: 'Hit a poorly guarded supply depot.', wealth: { min: 2000, max: 3500 }, xp: { min: 150, max: 220 } },
    { name: 'Jewelry Store Hit', description: 'Smash and grab, quick exit.', wealth: { min: 2500, max: 4000 }, xp: { min: 175, max: 250 } },
    { name: 'Security Van', description: 'Intercepted a cash transport.', wealth: { min: 3000, max: 4800 }, xp: { min: 200, max: 280 } },
    { name: 'Museum Piece', description: 'Art heist, quick fence.', wealth: { min: 3500, max: 5200 }, xp: { min: 225, max: 310 } },
    { name: 'Safe Cracker', description: 'Professional job, clean entry.', wealth: { min: 2800, max: 4400 }, xp: { min: 190, max: 265 } },
    { name: 'Penthouse Burglary', description: 'Rich targets, rich rewards.', wealth: { min: 3200, max: 5000 }, xp: { min: 210, max: 295 } },
    { name: 'Corporate Office', description: 'After hours acquisition.', wealth: { min: 2600, max: 4200 }, xp: { min: 180, max: 255 } },
    { name: 'Bank Side Door', description: 'Insider access, outside profits.', wealth: { min: 3800, max: 5600 }, xp: { min: 240, max: 330 } },
    { name: 'Mansion Job', description: 'Old money, new owner.', wealth: { min: 3400, max: 5400 }, xp: { min: 220, max: 315 } },
    { name: 'Tech Lab Raid', description: 'Prototypes have value.', wealth: { min: 4000, max: 5800 }, xp: { min: 250, max: 345 } },
    // ===== CONVOYS (10 events) =====
    { name: 'Convoy Interception', description: 'Ambushed a transport.', wealth: { min: 2500, max: 4000 }, xp: { min: 175, max: 250 } },
    { name: 'Supply Chain Hit', description: 'Intercepted corporate shipment.', wealth: { min: 2800, max: 4400 }, xp: { min: 190, max: 265 } },
    { name: 'Fuel Tanker', description: 'Redirected a delivery.', wealth: { min: 2200, max: 3800 }, xp: { min: 160, max: 235 } },
    { name: 'Medical Transport', description: 'Prescription drugs, street value.', wealth: { min: 3200, max: 5000 }, xp: { min: 210, max: 295 } },
    { name: 'Electronics Truck', description: 'Consumer goods acquired.', wealth: { min: 3000, max: 4700 }, xp: { min: 200, max: 280 } },
    { name: 'Luxury Car Transport', description: 'Premium vehicles liberated.', wealth: { min: 3600, max: 5400 }, xp: { min: 230, max: 320 } },
    { name: 'Weapons Shipment', description: 'Arms for the black market.', wealth: { min: 4000, max: 5800 }, xp: { min: 250, max: 345 } },
    { name: 'Data Center Move', description: 'Servers have secrets.', wealth: { min: 3400, max: 5200 }, xp: { min: 220, max: 310 } },
    { name: 'Food Distribution', description: 'Controlled the supply.', wealth: { min: 2000, max: 3600 }, xp: { min: 150, max: 225 } },
    { name: 'Cash Courier', description: 'Followed the money.', wealth: { min: 3800, max: 5600 }, xp: { min: 240, max: 335 } },
    // ===== ENFORCEMENT (10 events) =====
    { name: 'Enforcer Contract', description: 'Got paid to send a message.', wealth: { min: 3000, max: 4800 }, xp: { min: 200, max: 285 } },
    { name: 'Collection Agent', description: 'Debts collected, premium charged.', wealth: { min: 2500, max: 4100 }, xp: { min: 175, max: 255 } },
    { name: 'Territory Defense', description: 'Repelled an incursion.', wealth: { min: 2800, max: 4400 }, xp: { min: 190, max: 270 } },
    { name: 'Hostile Takeover', description: 'Removed competition.', wealth: { min: 3500, max: 5300 }, xp: { min: 225, max: 315 } },
    { name: 'Security Detail', description: 'Protected a VIP, got paid.', wealth: { min: 2600, max: 4200 }, xp: { min: 180, max: 260 } },
    { name: 'Street Justice', description: 'Settled disputes, kept the fee.', wealth: { min: 2200, max: 3800 }, xp: { min: 160, max: 240 } },
    { name: 'Intimidation Job', description: 'Words backed by presence.', wealth: { min: 2400, max: 4000 }, xp: { min: 170, max: 250 } },
    { name: 'Asset Recovery', description: 'Retrieved what belonged to the boss.', wealth: { min: 3200, max: 5000 }, xp: { min: 210, max: 300 } },
    { name: 'Union Muscle', description: 'Negotiated with leverage.', wealth: { min: 2900, max: 4600 }, xp: { min: 195, max: 275 } },
    { name: 'Witness Handler', description: 'Ensured testimony went right.', wealth: { min: 3400, max: 5200 }, xp: { min: 220, max: 310 } },
    // ===== DATA (10 events) =====
    { name: 'Data Extraction', description: 'Downloaded corporate secrets.', wealth: { min: 3500, max: 5300 }, xp: { min: 225, max: 315 } },
    { name: 'Server Breach', description: 'Infiltrated a data center.', wealth: { min: 3800, max: 5600 }, xp: { min: 240, max: 335 } },
    { name: 'Identity Package', description: 'Compiled and sold personal data.', wealth: { min: 2800, max: 4400 }, xp: { min: 190, max: 270 } },
    { name: 'Financial Records', description: 'Bank data has buyers.', wealth: { min: 3200, max: 5000 }, xp: { min: 210, max: 300 } },
    { name: 'R&D Theft', description: 'Research data for competitors.', wealth: { min: 4000, max: 5800 }, xp: { min: 250, max: 345 } },
    { name: 'Customer Database', description: 'Contact lists, premium price.', wealth: { min: 2500, max: 4100 }, xp: { min: 175, max: 255 } },
    { name: 'Security Protocols', description: 'Sold building blueprints.', wealth: { min: 3000, max: 4700 }, xp: { min: 200, max: 285 } },
    { name: 'Medical Records', description: 'Health data, unhealthy profit.', wealth: { min: 3400, max: 5200 }, xp: { min: 220, max: 310 } },
    { name: 'Government Files', description: 'Classified has a price.', wealth: { min: 4200, max: 6000 }, xp: { min: 260, max: 355 } },
    { name: 'Competitor Intel', description: 'Business secrets sold.', wealth: { min: 3600, max: 5400 }, xp: { min: 230, max: 325 } },
    // ===== SMUGGLING (5 events) =====
    { name: 'Smuggling Run', description: 'Moved contraband through checks.', wealth: { min: 4000, max: 5800 }, xp: { min: 250, max: 350 } },
    { name: 'Border Crossing', description: 'Goods that avoid taxes.', wealth: { min: 3600, max: 5400 }, xp: { min: 230, max: 325 } },
    { name: 'Hidden Cargo', description: 'Custom compartments, custom fees.', wealth: { min: 3800, max: 5600 }, xp: { min: 240, max: 340 } },
    { name: 'Tunnel Run', description: 'Underground logistics.', wealth: { min: 3400, max: 5200 }, xp: { min: 220, max: 310 } },
    { name: 'Diplomatic Pouch', description: 'Immunity has its uses.', wealth: { min: 4200, max: 6000 }, xp: { min: 260, max: 360 } },
    // ===== NEGATIVE EVENTS (5 events) =====
    { name: 'Setup', description: 'Client sold you out. Barely escaped.', wealth: { min: -2800, max: -900 }, xp: { min: 50, max: 110 }, isNegative: true },
    { name: 'Heist Gone Wrong', description: 'Silent alarm. Abandoned take.', wealth: { min: -2200, max: -700 }, xp: { min: 40, max: 90 }, isNegative: true },
    { name: 'Territory War', description: 'Lost ground. Costly retreat.', wealth: { min: -1800, max: -500 }, xp: { min: 30, max: 70 }, isNegative: true },
    { name: 'Data Trap', description: 'Honeypot server. Traced back.', wealth: { min: -2500, max: -800 }, xp: { min: 45, max: 100 }, isNegative: true },
    { name: 'Convoy Ambush', description: 'They were waiting for you.', wealth: { min: -2000, max: -600 }, xp: { min: 35, max: 80 }, isNegative: true },
  ],
  [TIERS.CAPTAIN]: [
    // ===== BANKS (10 events) =====
    { name: 'Bank Vault Access', description: 'Inside job at financial institution.', wealth: { min: 6000, max: 9500 }, xp: { min: 350, max: 480 } },
    { name: 'Wire Transfer Fraud', description: 'Digital heist, clean exit.', wealth: { min: 7000, max: 10500 }, xp: { min: 400, max: 530 } },
    { name: 'Safe Deposit Raid', description: 'Premium boxes, premium contents.', wealth: { min: 6500, max: 10000 }, xp: { min: 375, max: 505 } },
    { name: 'Mortgage Scam', description: 'Paper houses, real profits.', wealth: { min: 8000, max: 12000 }, xp: { min: 450, max: 580 } },
    { name: 'Currency Exchange', description: 'Exploited rate fluctuations.', wealth: { min: 7500, max: 11000 }, xp: { min: 420, max: 555 } },
    { name: 'Loan Officer', description: 'Approvals for a fee.', wealth: { min: 6200, max: 9800 }, xp: { min: 360, max: 495 } },
    { name: 'ATM Network', description: 'Compromised the whole system.', wealth: { min: 8500, max: 12500 }, xp: { min: 475, max: 605 } },
    { name: 'Investment Fraud', description: 'Other people\'s money, your pocket.', wealth: { min: 9000, max: 13500 }, xp: { min: 500, max: 640 } },
    { name: 'Bank Insider', description: 'Employee provided access codes.', wealth: { min: 7800, max: 11500 }, xp: { min: 435, max: 570 } },
    { name: 'Offshore Transfer', description: 'Money moves, no trace.', wealth: { min: 9500, max: 14000 }, xp: { min: 525, max: 665 } },
    // ===== KIDNAPPING (10 events) =====
    { name: 'Executive Kidnapping', description: 'High-value target, quick ransom.', wealth: { min: 7000, max: 10500 }, xp: { min: 400, max: 530 } },
    { name: 'Heir Ransom', description: 'Family pays for family.', wealth: { min: 8500, max: 12500 }, xp: { min: 475, max: 605 } },
    { name: 'Corporate Hostage', description: 'Company buyout, literal.', wealth: { min: 7500, max: 11000 }, xp: { min: 420, max: 555 } },
    { name: 'Political Target', description: 'Officials have wealthy friends.', wealth: { min: 9000, max: 13500 }, xp: { min: 500, max: 640 } },
    { name: 'Celebrity Grab', description: 'Fame commands high price.', wealth: { min: 8000, max: 12000 }, xp: { min: 450, max: 580 } },
    { name: 'Tech Founder', description: 'Startup cash, startup ransom.', wealth: { min: 7800, max: 11500 }, xp: { min: 435, max: 570 } },
    { name: 'Family Member', description: 'Leverage through loved ones.', wealth: { min: 6500, max: 10000 }, xp: { min: 375, max: 505 } },
    { name: 'Witness Acquisition', description: 'Someone needed them gone.', wealth: { min: 7200, max: 10800 }, xp: { min: 410, max: 545 } },
    { name: 'Competitor CEO', description: 'Hostile takeover, literally.', wealth: { min: 9500, max: 14000 }, xp: { min: 525, max: 665 } },
    { name: 'Doctor Ransom', description: 'Medical skills in demand.', wealth: { min: 6800, max: 10200 }, xp: { min: 390, max: 515 } },
    // ===== ARMS (10 events) =====
    { name: 'Arms Deal', description: 'Brokered military-grade hardware.', wealth: { min: 8000, max: 12000 }, xp: { min: 450, max: 580 } },
    { name: 'Weapons Cache', description: 'Found and moved a stockpile.', wealth: { min: 7500, max: 11200 }, xp: { min: 420, max: 560 } },
    { name: 'Gun Running', description: 'Cross-border arms trade.', wealth: { min: 8500, max: 12800 }, xp: { min: 475, max: 615 } },
    { name: 'Military Surplus', description: 'Decommissioned? Not really.', wealth: { min: 7000, max: 10500 }, xp: { min: 400, max: 530 } },
    { name: 'Custom Fabrication', description: 'Untraceable weapons made.', wealth: { min: 9000, max: 13500 }, xp: { min: 500, max: 645 } },
    { name: 'Ammunition Supply', description: 'Bullets are always needed.', wealth: { min: 6500, max: 9800 }, xp: { min: 375, max: 495 } },
    { name: 'Explosive Materials', description: 'Specialty items, premium price.', wealth: { min: 9500, max: 14200 }, xp: { min: 525, max: 670 } },
    { name: 'Defense Contract Skim', description: 'Government weapons, private sale.', wealth: { min: 10000, max: 14800 }, xp: { min: 550, max: 700 } },
    { name: 'Tech Weapons', description: 'Cyber-enhanced armaments.', wealth: { min: 8800, max: 13200 }, xp: { min: 490, max: 630 } },
    { name: 'Collector Sales', description: 'Rare pieces for wealthy buyers.', wealth: { min: 7200, max: 10800 }, xp: { min: 410, max: 545 } },
    // ===== TERRITORY (10 events) =====
    { name: 'Territory Takeover', description: 'Seized control of a block.', wealth: { min: 9000, max: 13500 }, xp: { min: 500, max: 645 } },
    { name: 'District Control', description: 'Your word is law here now.', wealth: { min: 9500, max: 14200 }, xp: { min: 525, max: 675 } },
    { name: 'Business District', description: 'Commercial zone under your thumb.', wealth: { min: 8500, max: 12800 }, xp: { min: 475, max: 615 } },
    { name: 'Port Access', description: 'Shipping lanes controlled.', wealth: { min: 10000, max: 14800 }, xp: { min: 550, max: 700 } },
    { name: 'Entertainment Strip', description: 'Clubs and bars pay tribute.', wealth: { min: 8000, max: 12000 }, xp: { min: 450, max: 580 } },
    { name: 'Industrial Zone', description: 'Factories under your protection.', wealth: { min: 7500, max: 11200 }, xp: { min: 420, max: 560 } },
    { name: 'Residential Block', description: 'Even homes pay rent to you.', wealth: { min: 7000, max: 10500 }, xp: { min: 400, max: 530 } },
    { name: 'Transit Hub', description: 'Control the flow of people.', wealth: { min: 8800, max: 13200 }, xp: { min: 490, max: 630 } },
    { name: 'Market Square', description: 'Every vendor pays dues.', wealth: { min: 7800, max: 11700 }, xp: { min: 435, max: 575 } },
    { name: 'Underground Network', description: 'Tunnels and hideouts secured.', wealth: { min: 8200, max: 12400 }, xp: { min: 460, max: 595 } },
    // ===== CYBER (5 events) =====
    { name: 'Cyber Heist', description: 'Drained accounts through the net.', wealth: { min: 10000, max: 15000 }, xp: { min: 550, max: 710 } },
    { name: 'Ransomware Attack', description: 'Encrypted files, demanded payment.', wealth: { min: 9500, max: 14200 }, xp: { min: 525, max: 675 } },
    { name: 'Crypto Theft', description: 'Digital wallets emptied.', wealth: { min: 10500, max: 15500 }, xp: { min: 575, max: 735 } },
    { name: 'Database Ransom', description: 'Customer data held hostage.', wealth: { min: 9000, max: 13500 }, xp: { min: 500, max: 645 } },
    { name: 'System Backdoor', description: 'Persistent access sells well.', wealth: { min: 11000, max: 16000 }, xp: { min: 600, max: 760 } },
    // ===== NEGATIVE EVENTS (5 events) =====
    { name: 'Federal Investigation', description: 'Had to burn assets to stay clean.', wealth: { min: -8000, max: -2500 }, xp: { min: 100, max: 220 }, isNegative: true },
    { name: 'Betrayal', description: 'Lieutenant sold you out.', wealth: { min: -7000, max: -2000 }, xp: { min: 85, max: 180 }, isNegative: true },
    { name: 'Market Crash', description: 'Your investments tanked.', wealth: { min: -6000, max: -1500 }, xp: { min: 70, max: 150 }, isNegative: true },
    { name: 'Ransom Failed', description: 'Target wasn\'t worth what you thought.', wealth: { min: -7500, max: -2200 }, xp: { min: 90, max: 200 }, isNegative: true },
    { name: 'Cyber Traced', description: 'Digital footprints led back.', wealth: { min: -6500, max: -1800 }, xp: { min: 75, max: 165 }, isNegative: true },
  ],
  [TIERS.UNDERBOSS]: [
    // ===== CORPORATE (10 events) =====
    { name: 'Corporate Sabotage', description: 'Crippled a rival corp.', wealth: { min: 15000, max: 23000 }, xp: { min: 700, max: 920 } },
    { name: 'Hostile Takeover Assist', description: 'Helped sharks eat sharks.', wealth: { min: 18000, max: 27000 }, xp: { min: 820, max: 1060 } },
    { name: 'Board Room Leverage', description: 'Controlled key votes.', wealth: { min: 16500, max: 25000 }, xp: { min: 760, max: 990 } },
    { name: 'Patent Theft Ring', description: 'Organized intellectual property heists.', wealth: { min: 20000, max: 30000 }, xp: { min: 900, max: 1150 } },
    { name: 'Executive Compromise', description: 'C-suite on your strings.', wealth: { min: 17500, max: 26500 }, xp: { min: 800, max: 1040 } },
    { name: 'Insider Trading Ring', description: 'Information flows to you first.', wealth: { min: 22000, max: 33000 }, xp: { min: 980, max: 1240 } },
    { name: 'Corporate Espionage', description: 'Sold secrets between giants.', wealth: { min: 19000, max: 28500 }, xp: { min: 860, max: 1110 } },
    { name: 'Merger Manipulation', description: 'Profited from corporate marriages.', wealth: { min: 21000, max: 31500 }, xp: { min: 940, max: 1200 } },
    { name: 'Labor Dispute Profit', description: 'Both sides paid for peace.', wealth: { min: 15500, max: 23500 }, xp: { min: 720, max: 940 } },
    { name: 'Supply Chain Control', description: 'Became an essential link.', wealth: { min: 23000, max: 34500 }, xp: { min: 1020, max: 1300 } },
    // ===== POLITICAL (10 events) =====
    { name: 'Political Leverage', description: 'Acquired influence over officials.', wealth: { min: 18000, max: 27000 }, xp: { min: 820, max: 1060 } },
    { name: 'Campaign Finance', description: 'Your donations buy loyalty.', wealth: { min: 16000, max: 24000 }, xp: { min: 740, max: 960 } },
    { name: 'Zoning Bribery', description: 'Changed the map for profit.', wealth: { min: 19500, max: 29000 }, xp: { min: 880, max: 1130 } },
    { name: 'Regulatory Capture', description: 'Your people write the rules.', wealth: { min: 21000, max: 31500 }, xp: { min: 940, max: 1200 } },
    { name: 'Government Contract Fix', description: 'Bids always go your way.', wealth: { min: 22500, max: 33500 }, xp: { min: 1000, max: 1270 } },
    { name: 'Lobbyist Network', description: 'Professional influence for hire.', wealth: { min: 17000, max: 25500 }, xp: { min: 780, max: 1010 } },
    { name: 'Election Assistance', description: 'Helped the right people win.', wealth: { min: 20000, max: 30000 }, xp: { min: 900, max: 1150 } },
    { name: 'Scandal Suppression', description: 'Kept secrets for officials.', wealth: { min: 18500, max: 27500 }, xp: { min: 840, max: 1080 } },
    { name: 'Committee Control', description: 'Your voice in every hearing.', wealth: { min: 23500, max: 35000 }, xp: { min: 1040, max: 1320 } },
    { name: 'Judicial Influence', description: 'Cases go the right way.', wealth: { min: 24000, max: 36000 }, xp: { min: 1060, max: 1350 } },
    // ===== SYNDICATE (10 events) =====
    { name: 'Syndicate War Profit', description: 'Played both sides.', wealth: { min: 20000, max: 30000 }, xp: { min: 900, max: 1150 } },
    { name: 'Alliance Brokering', description: 'United factions under terms.', wealth: { min: 22000, max: 33000 }, xp: { min: 980, max: 1250 } },
    { name: 'Territory Treaty', description: 'Drew new lines, took fees.', wealth: { min: 18500, max: 27500 }, xp: { min: 840, max: 1080 } },
    { name: 'Conflict Resolution', description: 'Peace costs money.', wealth: { min: 19500, max: 29000 }, xp: { min: 880, max: 1130 } },
    { name: 'Leadership Transition', description: 'New bosses owe you.', wealth: { min: 24000, max: 36000 }, xp: { min: 1060, max: 1350 } },
    { name: 'Tribute Collection', description: 'Smaller crews pay respect.', wealth: { min: 17000, max: 25500 }, xp: { min: 780, max: 1010 } },
    { name: 'Joint Venture', description: 'Partnered for mutual profit.', wealth: { min: 21000, max: 31500 }, xp: { min: 940, max: 1200 } },
    { name: 'Enforcement Monopoly', description: 'Only you solve problems.', wealth: { min: 23000, max: 34500 }, xp: { min: 1020, max: 1300 } },
    { name: 'Underground Council', description: 'Your seat at the table.', wealth: { min: 25000, max: 37500 }, xp: { min: 1100, max: 1400 } },
    { name: 'Succession Rights', description: 'Positioned for inheritance.', wealth: { min: 16000, max: 24000 }, xp: { min: 740, max: 960 } },
    // ===== MARKETS (10 events) =====
    { name: 'Black Market Monopoly', description: 'Cornered rare goods market.', wealth: { min: 22000, max: 33000 }, xp: { min: 980, max: 1250 } },
    { name: 'Price Fixing Cartel', description: 'Set the rates industry-wide.', wealth: { min: 24000, max: 36000 }, xp: { min: 1060, max: 1350 } },
    { name: 'Commodity Manipulation', description: 'Controlled supply and demand.', wealth: { min: 20000, max: 30000 }, xp: { min: 900, max: 1150 } },
    { name: 'Currency Speculation', description: 'Moved exchange rates.', wealth: { min: 23000, max: 34500 }, xp: { min: 1020, max: 1300 } },
    { name: 'Futures Rigging', description: 'Knew tomorrow\'s prices today.', wealth: { min: 21500, max: 32000 }, xp: { min: 960, max: 1220 } },
    { name: 'Import Monopoly', description: 'Only your goods get through.', wealth: { min: 19000, max: 28500 }, xp: { min: 860, max: 1110 } },
    { name: 'Auction Control', description: 'Bids always favor you.', wealth: { min: 18000, max: 27000 }, xp: { min: 820, max: 1060 } },
    { name: 'Distribution Network', description: 'Everything flows through you.', wealth: { min: 25000, max: 37500 }, xp: { min: 1100, max: 1400 } },
    { name: 'Counterfeit Luxury', description: 'Fake goods, real profits.', wealth: { min: 17000, max: 25500 }, xp: { min: 780, max: 1010 } },
    { name: 'Shortage Creation', description: 'Made scarcity, sold plenty.', wealth: { min: 26000, max: 39000 }, xp: { min: 1140, max: 1450 } },
    // ===== INTELLIGENCE (5 events) =====
    { name: 'Intelligence Auction', description: 'Sold secrets to highest bidder.', wealth: { min: 25000, max: 38000 }, xp: { min: 1100, max: 1420 } },
    { name: 'Spy Network', description: 'Eyes everywhere, info flows to you.', wealth: { min: 23500, max: 35500 }, xp: { min: 1040, max: 1340 } },
    { name: 'Counter-Intelligence', description: 'Sold protection from watchers.', wealth: { min: 22000, max: 33000 }, xp: { min: 980, max: 1260 } },
    { name: 'Information Broker', description: 'The central hub for secrets.', wealth: { min: 27000, max: 40000 }, xp: { min: 1180, max: 1500 } },
    { name: 'Digital Surveillance', description: 'Owned the watching eyes.', wealth: { min: 24000, max: 36000 }, xp: { min: 1060, max: 1360 } },
    // ===== NEGATIVE EVENTS (5 events) =====
    { name: 'Asset Seizure', description: 'Government froze your accounts.', wealth: { min: -20000, max: -6000 }, xp: { min: 200, max: 450 }, isNegative: true },
    { name: 'War Casualty', description: 'Lost a major battle.', wealth: { min: -17000, max: -5000 }, xp: { min: 170, max: 380 }, isNegative: true },
    { name: 'Whistleblower', description: 'Someone talked. Damage control costly.', wealth: { min: -14000, max: -4000 }, xp: { min: 140, max: 320 }, isNegative: true },
    { name: 'Market Manipulation Exposed', description: 'Regulators caught on.', wealth: { min: -18000, max: -5500 }, xp: { min: 180, max: 400 }, isNegative: true },
    { name: 'Alliance Betrayal', description: 'Partners turned enemies.', wealth: { min: -16000, max: -4500 }, xp: { min: 160, max: 360 }, isNegative: true },
  ],
  [TIERS.KINGPIN]: [
    // ===== ACQUISITIONS (10 events) =====
    { name: 'Hostile Acquisition', description: 'Absorbed a competitor entirely.', wealth: { min: 40000, max: 62000 }, xp: { min: 1400, max: 1850 } },
    { name: 'Mega-Corp Merger', description: 'United rival empires.', wealth: { min: 48000, max: 75000 }, xp: { min: 1650, max: 2150 } },
    { name: 'Conglomerate Formation', description: 'Built an untouchable entity.', wealth: { min: 52000, max: 80000 }, xp: { min: 1780, max: 2300 } },
    { name: 'Asset Stripping', description: 'Bought, broke, sold pieces.', wealth: { min: 45000, max: 70000 }, xp: { min: 1550, max: 2020 } },
    { name: 'Market Dominance', description: 'No competition remains.', wealth: { min: 55000, max: 85000 }, xp: { min: 1880, max: 2430 } },
    { name: 'Brand Absorption', description: 'Their name, your profits.', wealth: { min: 42000, max: 65000 }, xp: { min: 1450, max: 1900 } },
    { name: 'Infrastructure Buyout', description: 'Owned essential systems.', wealth: { min: 50000, max: 77000 }, xp: { min: 1720, max: 2230 } },
    { name: 'Global Expansion', description: 'Took operations international.', wealth: { min: 47000, max: 73000 }, xp: { min: 1620, max: 2100 } },
    { name: 'Vertical Integration', description: 'Controlled every step.', wealth: { min: 53000, max: 82000 }, xp: { min: 1820, max: 2360 } },
    { name: 'Legacy Acquisition', description: 'Old money, new owner.', wealth: { min: 58000, max: 90000 }, xp: { min: 1980, max: 2560 } },
    // ===== GOVERNMENT (10 events) =====
    { name: 'Government Contract', description: 'Even the state needs you.', wealth: { min: 45000, max: 70000 }, xp: { min: 1550, max: 2020 } },
    { name: 'Policy Purchase', description: 'Laws written to your spec.', wealth: { min: 50000, max: 77000 }, xp: { min: 1720, max: 2230 } },
    { name: 'Regulatory Control', description: 'You decide what\'s legal.', wealth: { min: 55000, max: 85000 }, xp: { min: 1880, max: 2430 } },
    { name: 'Defense Partnership', description: 'Military-grade profits.', wealth: { min: 60000, max: 92000 }, xp: { min: 2040, max: 2630 } },
    { name: 'Intelligence Alliance', description: 'State secrets flow both ways.', wealth: { min: 52000, max: 80000 }, xp: { min: 1780, max: 2300 } },
    { name: 'Tax Authority', description: 'You decide who pays.', wealth: { min: 48000, max: 74000 }, xp: { min: 1650, max: 2140 } },
    { name: 'Infrastructure Project', description: 'Public funds, private gain.', wealth: { min: 57000, max: 88000 }, xp: { min: 1950, max: 2520 } },
    { name: 'Judicial Appointment', description: 'Your judges in place.', wealth: { min: 53000, max: 82000 }, xp: { min: 1820, max: 2360 } },
    { name: 'Embassy Access', description: 'Diplomatic immunity, criminal profits.', wealth: { min: 46000, max: 71000 }, xp: { min: 1580, max: 2060 } },
    { name: 'Central Bank Influence', description: 'Money policy serves you.', wealth: { min: 62000, max: 95000 }, xp: { min: 2110, max: 2720 } },
    // ===== MANIPULATION (10 events) =====
    { name: 'Market Manipulation', description: 'Moved prices, made fortunes.', wealth: { min: 50000, max: 78000 }, xp: { min: 1720, max: 2250 } },
    { name: 'Media Empire', description: 'Controlled the narrative.', wealth: { min: 55000, max: 85000 }, xp: { min: 1880, max: 2450 } },
    { name: 'Public Opinion', description: 'Shaped what people believe.', wealth: { min: 48000, max: 74000 }, xp: { min: 1650, max: 2150 } },
    { name: 'Crisis Manufacturing', description: 'Created problems to solve them.', wealth: { min: 58000, max: 90000 }, xp: { min: 1980, max: 2580 } },
    { name: 'Economic Warfare', description: 'Bankrupted nations.', wealth: { min: 62000, max: 96000 }, xp: { min: 2110, max: 2750 } },
    { name: 'Social Engineering', description: 'Movements born from your think tanks.', wealth: { min: 52000, max: 80000 }, xp: { min: 1780, max: 2320 } },
    { name: 'Information Control', description: 'Truth is what you say it is.', wealth: { min: 56000, max: 86000 }, xp: { min: 1910, max: 2480 } },
    { name: 'Trend Setting', description: 'What\'s popular is your profit.', wealth: { min: 45000, max: 70000 }, xp: { min: 1550, max: 2030 } },
    { name: 'Fear Marketing', description: 'Sold solutions to problems you made.', wealth: { min: 60000, max: 92000 }, xp: { min: 2040, max: 2650 } },
    { name: 'Historical Revision', description: 'Rewrote the past to own the future.', wealth: { min: 53000, max: 82000 }, xp: { min: 1820, max: 2380 } },
    // ===== POWER (10 events) =====
    { name: 'Shadow Council Seat', description: 'Your vote shapes the city.', wealth: { min: 55000, max: 88000 }, xp: { min: 1880, max: 2520 } },
    { name: 'Kingmaker', description: 'You decide who rules.', wealth: { min: 60000, max: 95000 }, xp: { min: 2040, max: 2700 } },
    { name: 'Political Dynasty', description: 'Your people at every level.', wealth: { min: 58000, max: 90000 }, xp: { min: 1980, max: 2600 } },
    { name: 'Military Influence', description: 'Armed forces answer to you.', wealth: { min: 65000, max: 100000 }, xp: { min: 2210, max: 2850 } },
    { name: 'Economic Monopoly', description: 'All money flows through you.', wealth: { min: 62000, max: 96000 }, xp: { min: 2110, max: 2750 } },
    { name: 'Religious Authority', description: 'Faith serves your purposes.', wealth: { min: 50000, max: 78000 }, xp: { min: 1720, max: 2260 } },
    { name: 'Educational Control', description: 'Shaped the next generation.', wealth: { min: 52000, max: 80000 }, xp: { min: 1780, max: 2330 } },
    { name: 'Healthcare Dominance', description: 'Life and death, your call.', wealth: { min: 57000, max: 88000 }, xp: { min: 1950, max: 2540 } },
    { name: 'Transportation Monopoly', description: 'Nothing moves without you.', wealth: { min: 54000, max: 84000 }, xp: { min: 1850, max: 2420 } },
    { name: 'Energy Control', description: 'Power in every sense.', wealth: { min: 67000, max: 100000 }, xp: { min: 2280, max: 2900 } },
    // ===== ASCENSION (5 events) =====
    { name: 'Lazarus Ascension', description: 'You ARE the power in this city.', wealth: { min: 65000, max: 100000 }, xp: { min: 2200, max: 3000 } },
    { name: 'Legacy Secured', description: 'Your empire outlasts empires.', wealth: { min: 60000, max: 92000 }, xp: { min: 2040, max: 2680 } },
    { name: 'Immortal Institution', description: 'Built something eternal.', wealth: { min: 70000, max: 100000 }, xp: { min: 2380, max: 3100 } },
    { name: 'Absolute Authority', description: 'No one questions your word.', wealth: { min: 68000, max: 100000 }, xp: { min: 2310, max: 3000 } },
    { name: 'Beyond Law', description: 'Rules don\'t apply to you.', wealth: { min: 72000, max: 100000 }, xp: { min: 2450, max: 3200 } },
    // ===== NEGATIVE EVENTS (5 events) =====
    { name: 'Revolution', description: 'The people rose up.', wealth: { min: -55000, max: -18000 }, xp: { min: 500, max: 1100 }, isNegative: true },
    { name: 'International Sanctions', description: 'Global powers moved against you.', wealth: { min: -45000, max: -14000 }, xp: { min: 420, max: 900 }, isNegative: true },
    { name: 'Succession Crisis', description: 'Internal power struggle.', wealth: { min: -40000, max: -12000 }, xp: { min: 360, max: 800 }, isNegative: true },
    { name: 'Empire Fracture', description: 'Key holdings broke away.', wealth: { min: -50000, max: -16000 }, xp: { min: 460, max: 1000 }, isNegative: true },
    { name: 'Coup Attempt', description: 'Survived, but at great cost.', wealth: { min: -48000, max: -15000 }, xp: { min: 440, max: 950 }, isNegative: true },
  ],
}

// Crate drop weights by player tier (from spec)
export const PLAY_CRATE_TIER_WEIGHTS: Record<Tier, { common: number; uncommon: number; rare: number; legendary: number }> = {
  [TIERS.ROOKIE]: { common: 0.80, uncommon: 0.18, rare: 0.02, legendary: 0 },
  [TIERS.ASSOCIATE]: { common: 0.70, uncommon: 0.25, rare: 0.05, legendary: 0 },
  [TIERS.SOLDIER]: { common: 0.55, uncommon: 0.35, rare: 0.09, legendary: 0.01 },
  [TIERS.CAPTAIN]: { common: 0.40, uncommon: 0.40, rare: 0.17, legendary: 0.03 },
  [TIERS.UNDERBOSS]: { common: 0.25, uncommon: 0.40, rare: 0.28, legendary: 0.07 },
  [TIERS.KINGPIN]: { common: 0.15, uncommon: 0.35, rare: 0.35, legendary: 0.15 },
}

// Legacy play events (keeping for backwards compatibility)
export const PLAY_EVENTS = {
  // Tier 1: Common (45% total)
  STREET_HUSTLE: { tier: 1, weight: 15, wealth: { min: 50, max: 150 }, xp: { min: 10, max: 25 } },
  CORNER_DEAL: { tier: 1, weight: 15, wealth: { min: 75, max: 200 }, xp: { min: 15, max: 30 } },
  PETTY_THEFT: { tier: 1, weight: 15, wealth: { min: 100, max: 250 }, xp: { min: 20, max: 35 } },

  // Tier 2: Uncommon (30% total)
  BACK_ALLEY_TRADE: { tier: 2, weight: 10, wealth: { min: 200, max: 500 }, xp: { min: 35, max: 60 } },
  INFO_BROKER: { tier: 2, weight: 10, wealth: { min: 250, max: 600 }, xp: { min: 40, max: 70 } },
  PROTECTION_RACKET: { tier: 2, weight: 10, wealth: { min: 300, max: 700 }, xp: { min: 45, max: 80 } },

  // Tier 3: Rare (18% total)
  DATA_HEIST: { tier: 3, weight: 6, wealth: { min: 500, max: 1200 }, xp: { min: 70, max: 120 } },
  SMUGGLING_RUN: { tier: 3, weight: 6, wealth: { min: 600, max: 1400 }, xp: { min: 80, max: 140 } },
  CORPORATE_ESPIONAGE: { tier: 3, weight: 6, wealth: { min: 700, max: 1600 }, xp: { min: 90, max: 160 } },

  // Tier 4: Epic (5.5% total)
  BANK_JOB: { tier: 4, weight: 2, wealth: { min: 1500, max: 3500 }, xp: { min: 150, max: 250 } },
  SYNDICATE_CONTRACT: { tier: 4, weight: 2, wealth: { min: 1800, max: 4000 }, xp: { min: 175, max: 300 } },
  BLACK_MARKET_AUCTION: { tier: 4, weight: 1.5, wealth: { min: 2000, max: 4500 }, xp: { min: 200, max: 350 } },

  // Tier 5: Legendary (1.5% total)
  MEGACORP_HEIST: { tier: 5, weight: 0.5, wealth: { min: 5000, max: 10000 }, xp: { min: 400, max: 600 } },
  GOVERNMENT_CONTRACT: { tier: 5, weight: 0.5, wealth: { min: 6000, max: 12000 }, xp: { min: 450, max: 700 } },
  KINGPIN_DEAL: { tier: 5, weight: 0.5, wealth: { min: 7500, max: 15000 }, xp: { min: 500, max: 800 } },
} as const

export type PlayEventType = keyof typeof PLAY_EVENTS

// =============================================================================
// ROBBERY SYSTEM
// =============================================================================

export const ROB_CONFIG = {
  BASE_SUCCESS_RATE: 0.60,      // 60% base
  MIN_SUCCESS_RATE: 0.45,       // Floor: 45%
  MAX_SUCCESS_RATE: 0.85,       // Cap: 85%
  MAX_WEAPON_BONUS: 0.15,       // +15% max from weapon
  MAX_ARMOR_REDUCTION: 0.15,    // -15% max from armor
  LEVEL_DIFF_MODIFIER: 0.01,    // 1% per level difference
  MAX_LEVEL_MODIFIER: 0.10,     // ±10% max from level difference
  STEAL_PERCENTAGE: { min: 0.08, max: 0.28 }, // 8-28% of target's wealth (per spec)
  COOLDOWN_HOURS: 24,           // Per-target cooldown
  XP_REWARD_SUCCESS: 50,        // XP on successful rob
  XP_REWARD_FAILURE: 10,        // XP on failed rob (participation)
  ITEM_THEFT_CHANCE: 0.05,      // 5% chance to steal equipped item (per spec)
}

// =============================================================================
// JAIL SYSTEM
// =============================================================================

export const JAIL_CONFIG = {
  BUST_CHANCE: 0.05,            // 5% chance to get busted on !play
  DURATION_MINUTES: 60,         // 1 hour sentence
  BAIL_COST_PERCENT: 0.10,      // 10% of wealth
  MIN_BAIL: 100,                // Minimum bail amount
}

// =============================================================================
// CHECK-IN SYSTEM
// =============================================================================

export const CHECKIN_CONFIG = {
  BASE_WEALTH: 100,
  BASE_XP: 20,
  STREAK_BONUS_WEALTH_PER_DAY: 100,  // +$100 per streak day
  STREAK_BONUS_XP_PER_DAY: 20,       // +20 XP per streak day
  MAX_STREAK_BONUS_DAYS: 30,         // Cap multiplier at 30 days

  // CRIT-06 fix: Perpetual repeating milestone cycle
  // Every 7 days: Uncommon crate
  // Every 28 days: Legendary crate (overrides 7-day reward)
  MILESTONE_CYCLE: {
    WEEKLY_INTERVAL: 7,
    WEEKLY_CRATE: CRATE_TIERS.UNCOMMON,
    MONTHLY_INTERVAL: 28,
    MONTHLY_CRATE: CRATE_TIERS.LEGENDARY,
  },
}

// =============================================================================
// DURABILITY SYSTEM
// =============================================================================

export const DURABILITY_CONFIG = {
  // Durability only decays during robbery events, NOT during !play
  // HIGH-01 fix: Now using random ranges per game design spec
  DECAY_PER_ROB_ATTACKER: { min: 2, max: 3 },  // -2 to -3 durability for attacker's weapon
  DECAY_PER_ROB_DEFENDER: { min: 2, max: 3 },  // -2 to -3 durability for defender's armor
  BREAK_THRESHOLD: 0,                          // Item breaks at 0
}

// =============================================================================
// BLACK MARKET
// =============================================================================

export const BLACK_MARKET_CONFIG = {
  ROTATION_HOURS: 6,
  LEGENDARY_CHANCE: 0.30,       // 30% chance for legendary item
  RARE_COUNT: { min: 2, max: 3 },
  UNCOMMON_COUNT: { min: 3, max: 5 },
  COMMON_COUNT: { min: 3, max: 5 },
  FEATURED_DISCOUNT: 0.25,      // 25% off featured item
  STOCK_RANGES: {
    [ITEM_TIERS.LEGENDARY]: { min: 1, max: 3 },
    [ITEM_TIERS.RARE]: { min: 3, max: 8 },
    [ITEM_TIERS.UNCOMMON]: { min: 5, max: 10 },
    [ITEM_TIERS.COMMON]: { min: 10, max: 20 },
  },
}

// =============================================================================
// PLAYER SHOP
// =============================================================================

export const PLAYER_SHOP_CONFIG = {
  ITEMS_COUNT: { min: 6, max: 10 },
  // Items available by tier
  TIER_ACCESS: {
    [TIERS.ROOKIE]: [ITEM_TIERS.COMMON],
    [TIERS.ASSOCIATE]: [ITEM_TIERS.COMMON, ITEM_TIERS.UNCOMMON],
    [TIERS.SOLDIER]: [ITEM_TIERS.COMMON, ITEM_TIERS.UNCOMMON, ITEM_TIERS.RARE],
    [TIERS.CAPTAIN]: [ITEM_TIERS.COMMON, ITEM_TIERS.UNCOMMON, ITEM_TIERS.RARE],
    [TIERS.UNDERBOSS]: [ITEM_TIERS.UNCOMMON, ITEM_TIERS.RARE],
    [TIERS.KINGPIN]: [ITEM_TIERS.UNCOMMON, ITEM_TIERS.RARE],
  },
}

// =============================================================================
// MISSIONS
// =============================================================================

export const MISSION_CONFIG = {
  DAILY_COUNT: 3,
  WEEKLY_COUNT: 2,
  DAILY_BONUS_MULTIPLIER: 1.5,    // 50% bonus for completing all dailies
  WEEKLY_BONUS_MULTIPLIER: 2.0,   // 100% bonus for completing all weeklies
  DAILY_CRATE_REWARD: CRATE_TIERS.UNCOMMON,
  WEEKLY_CRATE_REWARD: CRATE_TIERS.RARE,
}

// =============================================================================
// FACTIONS & TERRITORIES
// =============================================================================

export const FACTION_CONFIG = {
  MIN_LEVEL_TO_JOIN: 20,        // Associate tier
  SWITCH_COOLDOWN_DAYS: 7,
  REWARD_COOLDOWN_DAYS: 7,      // Can't earn rewards for 7 days after switching
}

export const TERRITORY_SCORE_POINTS = {
  MESSAGE: 1,
  PLAY: 10,
  ROB: 20,
  MISSION: 25,
  CHECKIN: 15,
}

export const TERRITORY_REWARDS = {
  BASE_WEALTH_PER_TERRITORY: 2000,
  BASE_XP_PER_TERRITORY: 200,
  CONTESTED_MULTIPLIER: 1.5,
  WINNER_BONUS: 0.25,           // 25% bonus to winning faction
  MIN_CONTRIBUTION_FOR_REWARD: 100,
}

// =============================================================================
// JUICERNAUT
// =============================================================================

export const JUICERNAUT_BUFF_TYPES = {
  XP: 'juicernaut_xp',
  LOOT: 'juicernaut_loot',
  IMMUNITY: 'juicernaut_immunity',
  BUSINESS: 'juicernaut_business',
  WEALTH: 'juicernaut_wealth',
} as const

export type JuicernautBuffType = typeof JUICERNAUT_BUFF_TYPES[keyof typeof JUICERNAUT_BUFF_TYPES]

export const JUICERNAUT_BUFFS = {
  XP_MULTIPLIER: 2.0,           // 2x XP
  LOOT_MULTIPLIER: 3.0,         // 3x crate drop chance
  ROB_IMMUNITY: true,           // Cannot be robbed
  BUSINESS_MULTIPLIER: 1.5,     // 50% bonus business revenue
  WEALTH_MULTIPLIER: 1.25,      // 25% bonus wealth from !play
}

// All Juicernaut buffs with their multipliers
export const JUICERNAUT_BUFF_CONFIG = [
  { type: JUICERNAUT_BUFF_TYPES.XP, multiplier: 2.0, description: 'Double XP from all sources' },
  { type: JUICERNAUT_BUFF_TYPES.LOOT, multiplier: 3.0, description: 'Triple crate drop rate' },
  { type: JUICERNAUT_BUFF_TYPES.IMMUNITY, multiplier: 1.0, description: 'Cannot be robbed' },
  { type: JUICERNAUT_BUFF_TYPES.BUSINESS, multiplier: 1.5, description: '50% bonus business revenue' },
  { type: JUICERNAUT_BUFF_TYPES.WEALTH, multiplier: 1.25, description: '25% bonus wealth from play' },
] as const

export const JUICERNAUT_SESSION_REWARDS = {
  TIERS: [
    { minUsd: 0, maxUsd: 4.99, wealth: 1000, xp: 200, crate: null },
    { minUsd: 5, maxUsd: 14.99, wealth: 3000, xp: 500, crate: CRATE_TIERS.COMMON },
    { minUsd: 15, maxUsd: 29.99, wealth: 7500, xp: 1000, crate: CRATE_TIERS.UNCOMMON },
    { minUsd: 30, maxUsd: 49.99, wealth: 15000, xp: 2000, crate: CRATE_TIERS.RARE },
    { minUsd: 50, maxUsd: Infinity, wealth: 30000, xp: 4000, crate: CRATE_TIERS.LEGENDARY },
  ],
}

// =============================================================================
// MONETIZATION REWARDS
// =============================================================================

export const MONETIZATION_REWARDS = {
  // Kick
  KICK_SUB_T1: { wealth: 500, xp: 100, usd: 4.99 },
  KICK_SUB_T2: { wealth: 750, xp: 150, usd: 9.99 },
  KICK_SUB_T3: { wealth: 1000, xp: 200, usd: 24.99 },
  KICK_GIFT_SUB: { wealth: 500, xp: 100, usd: 5.00 },  // Per sub gifted
  KICK_KICK: { wealth: 1, xp: 0, usd: 0.01 },          // Per kick

  // Twitch
  TWITCH_SUB_T1: { wealth: 500, xp: 100, usd: 4.99 },
  TWITCH_SUB_T2: { wealth: 750, xp: 150, usd: 9.99 },
  TWITCH_SUB_T3: { wealth: 1000, xp: 200, usd: 24.99 },
  TWITCH_GIFT_SUB: { wealth: 500, xp: 100, usd: 5.00 },
  TWITCH_BITS_PER_100: { wealth: 100, xp: 0, usd: 1.00 },
  TWITCH_RAID_PER_VIEWER: { wealth: 10, xp: 2, usd: 0.10 },

  // Stripe/Direct donations
  DONATION_PER_DOLLAR: { wealth: 100, xp: 0, usd: 1.00 },
}

// USD values for Juicernaut contribution tracking
export const CONTRIBUTION_USD_VALUES = {
  // Kick
  KICK_SUB_T1: 5.00,
  KICK_SUB_T2: 10.00,
  KICK_SUB_T3: 25.00,
  KICK_GIFT_SUB: 5.00,    // Per sub
  KICK_KICK: 0.01,        // Per kick

  // Twitch
  TWITCH_SUB_T1: 5.00,
  TWITCH_SUB_T2: 10.00,
  TWITCH_SUB_T3: 25.00,
  TWITCH_GIFT_SUB: 5.00,
  TWITCH_BITS: 0.01,      // Per bit
  TWITCH_RAID: 0.10,      // Per viewer

  // Stripe
  STRIPE_DONATION: 1.00,  // Per dollar (face value)
} as const

// Monetization event types
export const MONETIZATION_EVENT_TYPES = {
  SUBSCRIPTION: 'subscription',
  GIFT_SUB: 'gift_sub',
  BITS: 'bits',
  KICK: 'kick',
  RAID: 'raid',
  DONATION: 'donation',
} as const

export type MonetizationEventType = typeof MONETIZATION_EVENT_TYPES[keyof typeof MONETIZATION_EVENT_TYPES]

// Platforms
export const MONETIZATION_PLATFORMS = {
  KICK: 'kick',
  TWITCH: 'twitch',
  STRIPE: 'stripe',
} as const

export type MonetizationPlatform = typeof MONETIZATION_PLATFORMS[keyof typeof MONETIZATION_PLATFORMS]

// =============================================================================
// ESCROW
// =============================================================================

export const ESCROW_CONFIG = {
  DURATION_HOURS: 24,           // Items/crates expire after 24h if unclaimed
}

// =============================================================================
// HEIST ALERTS
// =============================================================================

export const HEIST_EVENT_TYPES = {
  QUICK_GRAB: 'quick_grab',
  CODE_CRACK: 'code_crack',
  TRIVIA: 'trivia',
  WORD_SCRAMBLE: 'word_scramble',
  RIDDLE: 'riddle',
  MATH_HACK: 'math_hack',
} as const

export type HeistEventType = typeof HEIST_EVENT_TYPES[keyof typeof HEIST_EVENT_TYPES]

export const HEIST_DIFFICULTIES = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
} as const

export type HeistDifficulty = typeof HEIST_DIFFICULTIES[keyof typeof HEIST_DIFFICULTIES]

export const HEIST_CONFIG = {
  MIN_DELAY_MINUTES: 60,
  MAX_DELAY_MINUTES: 120,
  MIN_AFTER_SESSION_START: 15,
  RECENT_EVENTS_TRACK: 10, // Track last 10 to prevent repeats
  EVENT_TYPES: {
    [HEIST_EVENT_TYPES.QUICK_GRAB]: { difficulty: HEIST_DIFFICULTIES.EASY, time: 45, weight: 0.25 },
    [HEIST_EVENT_TYPES.CODE_CRACK]: { difficulty: HEIST_DIFFICULTIES.EASY, time: 45, weight: 0.25 },
    [HEIST_EVENT_TYPES.TRIVIA]: { difficulty: HEIST_DIFFICULTIES.MEDIUM, time: 90, weight: 0.175 },
    [HEIST_EVENT_TYPES.WORD_SCRAMBLE]: { difficulty: HEIST_DIFFICULTIES.MEDIUM, time: 90, weight: 0.175 },
    [HEIST_EVENT_TYPES.RIDDLE]: { difficulty: HEIST_DIFFICULTIES.HARD, time: 120, weight: 0.075 },
    [HEIST_EVENT_TYPES.MATH_HACK]: { difficulty: HEIST_DIFFICULTIES.HARD, time: 120, weight: 0.075 },
  },
  CRATE_CHANCES_BY_DIFFICULTY: {
    [HEIST_DIFFICULTIES.EASY]: { common: 0.70, uncommon: 0.25, rare: 0.05, legendary: 0 },
    [HEIST_DIFFICULTIES.MEDIUM]: { common: 0.50, uncommon: 0.35, rare: 0.13, legendary: 0.02 },
    [HEIST_DIFFICULTIES.HARD]: { common: 0.30, uncommon: 0.40, rare: 0.25, legendary: 0.05 },
  },
}

// Quick Grab phrases (30 total) - player types "!grab PHRASE"
export const HEIST_QUICK_GRAB_PHRASES = [
  'NEON', 'CHROME', 'STATIC', 'GHOST', 'CIPHER', 'VOLTAGE',
  'SHADOW', 'BREACH', 'CIRCUIT', 'LAZARUS', 'SYNDICATE', 'PROTOCOL',
  'MATRIX', 'OVERRIDE', 'ACCESS', 'DECRYPT', 'EXECUTE', 'FIREWALL',
  'QUANTUM', 'NEURAL', 'CORTEX', 'DARKNET', 'CYPHER', 'GRIDLOCK',
  'TERMINUS', 'APEX', 'VECTOR', 'OMEGA', 'PRIME', 'ZENITH',
] as const

// Code Crack patterns for generating codes
export const HEIST_CODE_PATTERNS = [
  { pattern: 'XXX-000', description: '3 letters, dash, 3 numbers' },
  { pattern: '00-XXX-00', description: '2 numbers, 3 letters, 2 numbers' },
  { pattern: 'X0X0X', description: 'Alternating letter-number' },
  { pattern: '000-XX', description: '3 numbers, dash, 2 letters' },
  { pattern: 'XX-0000', description: '2 letters, dash, 4 numbers' },
] as const

// Word Scrambles (25 total)
export const HEIST_WORD_SCRAMBLES = [
  { scrambled: 'OVKOVL RAVTAB', answer: 'VOLKOV BRATVA' },
  { scrambled: 'DAED TIRICUC', answer: 'DEAD CIRCUIT' },
  { scrambled: 'SLSEKRE PUROG', answer: 'KESSLER GROUP' },
  { scrambled: 'AZSALRU TYIC', answer: 'LAZARUS CITY' },
  { scrambled: 'NEOIGJUKRA', answer: 'JUICERNAUT' },
  { scrambled: 'TERIRTOYR', answer: 'TERRITORY' },
  { scrambled: 'VEECHITNEAM', answer: 'ACHIEVEMENT' },
  { scrambled: 'CALDKB TKEAMR', answer: 'BLACK MARKET' },
  { scrambled: 'GIKNPNI', answer: 'KINGPIN' },
  { scrambled: 'DEURBONSS', answer: 'UNDERBOSS' },
  { scrambled: 'ATCNIPA', answer: 'CAPTAIN' },
  { scrambled: 'RSDOELI', answer: 'SOLDIER' },
  { scrambled: 'KEROOI', answer: 'ROOKIE' },
  { scrambled: 'TCAOAESIS', answer: 'ASSOCIATE' },
  { scrambled: 'RYPBERO', answer: 'ROBBERY' },
  { scrambled: 'OENWPA', answer: 'WEAPON' },
  { scrambled: 'RMROA', answer: 'ARMOR' },
  { scrambled: 'NSUSIBES', answer: 'BUSINESS' },
  { scrambled: 'LAIB', answer: 'BAIL' },
  { scrambled: 'LJIA', answer: 'JAIL' },
  { scrambled: 'ETARC', answer: 'CRATE' },
  { scrambled: 'ARDENLYGE', answer: 'LEGENDARY' },
  { scrambled: 'FCNOITA', answer: 'FACTION' },
  { scrambled: 'KICENHC', answer: 'CHECKIN' },
  { scrambled: 'NSIOMIS', answer: 'MISSIONS' },
] as const

// Riddles (25 total)
export const HEIST_RIDDLES = [
  { riddle: 'I have cities, but no houses. Mountains, but no trees. Water, but no fish. What am I?', answer: 'map' },
  { riddle: 'The more you take, the more you leave behind. What am I?', answer: 'footsteps' },
  { riddle: 'I speak without a mouth and hear without ears. I have no body, but come alive with the wind. What am I?', answer: 'echo' },
  { riddle: 'What can travel around the world while staying in a corner?', answer: 'stamp' },
  { riddle: 'I have keys but no locks. Space but no room. You can enter but can\'t go inside. What am I?', answer: 'keyboard' },
  { riddle: 'What has hands but can\'t clap?', answer: 'clock' },
  { riddle: 'What has a head and a tail but no body?', answer: 'coin' },
  { riddle: 'The more you have of it, the less you see. What is it?', answer: 'darkness' },
  { riddle: 'What can you catch but not throw?', answer: 'cold' },
  { riddle: 'What has many teeth but cannot bite?', answer: 'comb' },
  { riddle: 'What runs but never walks, has a mouth but never talks?', answer: 'river' },
  { riddle: 'What can fill a room but takes up no space?', answer: 'light' },
  { riddle: 'What gets wetter the more it dries?', answer: 'towel' },
  { riddle: 'What has one eye but cannot see?', answer: 'needle' },
  { riddle: 'What goes up but never comes down?', answer: 'age' },
  { riddle: 'What can be broken without being held?', answer: 'promise' },
  { riddle: 'What has words but never speaks?', answer: 'book' },
  { riddle: 'What belongs to you but others use it more than you do?', answer: 'name' },
  { riddle: 'What has a bottom at the top?', answer: 'leg' },
  { riddle: 'What building has the most stories?', answer: 'library' },
  { riddle: 'What can you keep after giving to someone?', answer: 'word' },
  { riddle: 'What invention lets you look right through a wall?', answer: 'window' },
  { riddle: 'What is always in front of you but can\'t be seen?', answer: 'future' },
  { riddle: 'What has legs but doesn\'t walk?', answer: 'table' },
  { riddle: 'What can run but never walks, has a bed but never sleeps?', answer: 'river' },
] as const

// Math Hack operation types for generating problems
export const HEIST_MATH_OPERATIONS = {
  MULTIPLY: 'multiply',
  ADD: 'add',
  DIVIDE: 'divide',
  COMPOUND: 'compound',
} as const

// =============================================================================
// NOTIFICATIONS
// =============================================================================

export const NOTIFICATION_TYPES = {
  CHECKIN: 'checkin',
  CHECKIN_MILESTONE: 'checkin_milestone',
  LEVEL_UP: 'level_up',
  TIER_PROMOTION: 'tier_promotion',
  ROBBED: 'robbed',
  ROB_DEFENDED: 'rob_defended',
  ITEM_STOLEN: 'item_stolen',
  ITEM_BROKE: 'item_broke',
  CRATE_RECEIVED: 'crate_received',
  CRATE_ESCROW: 'crate_escrow',
  CRATE_EXPIRED: 'crate_expired',
  ACHIEVEMENT: 'achievement',
  TITLE_UNLOCKED: 'title_unlocked',
  MISSION_COMPLETE: 'mission_complete',
  MISSION_EXPIRED: 'mission_expired',
  FACTION_JOINED: 'faction_joined',
  TERRITORY_CAPTURED: 'territory_captured',
  TERRITORY_LOST: 'territory_lost',
  FACTION_REWARD: 'faction_reward',
  JUICERNAUT_CROWN: 'juicernaut_crown',
  JUICERNAUT_DETHRONED: 'juicernaut_dethroned',
  JUICERNAUT_REWARD: 'juicernaut_reward',
  MONETIZATION: 'monetization',
  HEIST_WON: 'heist_won',
  BLACK_MARKET_ROTATION: 'black_market_rotation',
} as const

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES]

export const NOTIFICATION_CONFIG = {
  MAX_PER_USER: 25,
  RETENTION_DAYS: 30,
  BATCH_WINDOW_MS: 60000,       // 60 seconds for batching similar events
  POLL_INTERVAL_MS: 30000,      // 30 seconds for UI polling
}

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  [NOTIFICATION_TYPES.CHECKIN]: '✅',
  [NOTIFICATION_TYPES.CHECKIN_MILESTONE]: '🔥',
  [NOTIFICATION_TYPES.LEVEL_UP]: '🎉',
  [NOTIFICATION_TYPES.TIER_PROMOTION]: '🎖️',
  [NOTIFICATION_TYPES.ROBBED]: '💸',
  [NOTIFICATION_TYPES.ROB_DEFENDED]: '🛡️',
  [NOTIFICATION_TYPES.ITEM_STOLEN]: '🔥',
  [NOTIFICATION_TYPES.ITEM_BROKE]: '💥',
  [NOTIFICATION_TYPES.CRATE_RECEIVED]: '📦',
  [NOTIFICATION_TYPES.CRATE_ESCROW]: '⚠️',
  [NOTIFICATION_TYPES.CRATE_EXPIRED]: '❌',
  [NOTIFICATION_TYPES.ACHIEVEMENT]: '🏅',
  [NOTIFICATION_TYPES.TITLE_UNLOCKED]: '🏷️',
  [NOTIFICATION_TYPES.MISSION_COMPLETE]: '🎯',
  [NOTIFICATION_TYPES.MISSION_EXPIRED]: '⏰',
  [NOTIFICATION_TYPES.FACTION_JOINED]: '⚔️',
  [NOTIFICATION_TYPES.TERRITORY_CAPTURED]: '🏴',
  [NOTIFICATION_TYPES.TERRITORY_LOST]: '💔',
  [NOTIFICATION_TYPES.FACTION_REWARD]: '🎁',
  [NOTIFICATION_TYPES.JUICERNAUT_CROWN]: '👑',
  [NOTIFICATION_TYPES.JUICERNAUT_DETHRONED]: '😢',
  [NOTIFICATION_TYPES.JUICERNAUT_REWARD]: '🏆',
  [NOTIFICATION_TYPES.MONETIZATION]: '💜',
  [NOTIFICATION_TYPES.HEIST_WON]: '🚨',
  [NOTIFICATION_TYPES.BLACK_MARKET_ROTATION]: '🏪',
}

// Notification titles for each type
export const NOTIFICATION_TITLES: Record<NotificationType, string> = {
  [NOTIFICATION_TYPES.CHECKIN]: 'Check-in recorded!',
  [NOTIFICATION_TYPES.CHECKIN_MILESTONE]: 'Streak milestone!',
  [NOTIFICATION_TYPES.LEVEL_UP]: 'Level up!',
  [NOTIFICATION_TYPES.TIER_PROMOTION]: 'Tier promotion!',
  [NOTIFICATION_TYPES.ROBBED]: 'You were robbed!',
  [NOTIFICATION_TYPES.ROB_DEFENDED]: 'Robbery blocked!',
  [NOTIFICATION_TYPES.ITEM_STOLEN]: 'Item stolen!',
  [NOTIFICATION_TYPES.ITEM_BROKE]: 'Item destroyed!',
  [NOTIFICATION_TYPES.CRATE_RECEIVED]: 'Crate received!',
  [NOTIFICATION_TYPES.CRATE_ESCROW]: 'Crate in escrow!',
  [NOTIFICATION_TYPES.CRATE_EXPIRED]: 'Crate expired!',
  [NOTIFICATION_TYPES.ACHIEVEMENT]: 'Achievement unlocked!',
  [NOTIFICATION_TYPES.TITLE_UNLOCKED]: 'Title unlocked!',
  [NOTIFICATION_TYPES.MISSION_COMPLETE]: 'Missions complete!',
  [NOTIFICATION_TYPES.MISSION_EXPIRED]: 'Missions expired!',
  [NOTIFICATION_TYPES.FACTION_JOINED]: 'Faction joined!',
  [NOTIFICATION_TYPES.TERRITORY_CAPTURED]: 'Territory captured!',
  [NOTIFICATION_TYPES.TERRITORY_LOST]: 'Territory lost!',
  [NOTIFICATION_TYPES.FACTION_REWARD]: 'Faction reward!',
  [NOTIFICATION_TYPES.JUICERNAUT_CROWN]: "You're the Juicernaut!",
  [NOTIFICATION_TYPES.JUICERNAUT_DETHRONED]: 'Crown lost!',
  [NOTIFICATION_TYPES.JUICERNAUT_REWARD]: 'Session reward!',
  [NOTIFICATION_TYPES.MONETIZATION]: 'Thank you!',
  [NOTIFICATION_TYPES.HEIST_WON]: 'Heist won!',
  [NOTIFICATION_TYPES.BLACK_MARKET_ROTATION]: 'Black Market updated!',
}

// Link types for notification navigation
export const NOTIFICATION_LINK_TYPES = {
  PROFILE: 'profile',
  INVENTORY: 'inventory',
  CRATES: 'crates',
  ACHIEVEMENTS: 'achievements',
  MISSIONS: 'missions',
  FACTION: 'faction',
  LEADERBOARDS: 'leaderboards',
  MARKET: 'market',
  EVENTS: 'events',
} as const

export type NotificationLinkType = typeof NOTIFICATION_LINK_TYPES[keyof typeof NOTIFICATION_LINK_TYPES]

// =============================================================================
// DISCORD FEED
// =============================================================================

export const DISCORD_FEED_CONFIG = {
  // Events that post to #kingpin-feed (major events only)
  TIER_PROMOTION_MIN_TIER: TIERS.CAPTAIN,  // Captain+ only
  ACHIEVEMENT_MIN_TIER: 'platinum' as const,  // Platinum+ only (matches ACHIEVEMENT_TIERS.PLATINUM)
  CRATE_DROP_MIN_TIER: CRATE_TIERS.RARE,  // Rare+ only
  COLORS: {
    PURPLE: 0x9146FF,      // Monetization/Juicernaut
    GOLD: 0xFFD700,        // Achievements/Legendary
    GREEN: 0x00FF00,       // Success
    RED: 0xFF0000,         // Territory lost
    BLUE: 0x0099FF,        // Faction
    ORANGE: 0xFF9900,      // Heist
  },
}

// =============================================================================
// LUMIA STREAM
// =============================================================================

export const LUMIA_CONFIG = {
  LEADERBOARD_INTERVAL_MINUTES: 30,  // Post every 30 min during active session
}

// =============================================================================
// ACHIEVEMENT CATEGORIES
// =============================================================================

export const ACHIEVEMENT_CATEGORIES = {
  WEALTH: 'wealth',
  EXPERIENCE: 'experience',
  CRIME: 'crime',
  SOCIAL: 'social',
  COLLECTION: 'collection',
  DEDICATION: 'dedication',
  SPECIAL: 'special',
  SEASONAL: 'seasonal',
  SECRET: 'secret',
} as const

export const ACHIEVEMENT_TIERS = {
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
  PLATINUM: 'platinum',
  LEGENDARY: 'legendary',
} as const

export type AchievementTier = typeof ACHIEVEMENT_TIERS[keyof typeof ACHIEVEMENT_TIERS]

export type AchievementCategory = typeof ACHIEVEMENT_CATEGORIES[keyof typeof ACHIEVEMENT_CATEGORIES]

// =============================================================================
// MISSION SYSTEM
// =============================================================================

export const MISSION_TYPES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
} as const

export type MissionType = typeof MISSION_TYPES[keyof typeof MISSION_TYPES]

export const MISSION_DIFFICULTIES = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
} as const

export type MissionDifficulty = typeof MISSION_DIFFICULTIES[keyof typeof MISSION_DIFFICULTIES]

export const MISSION_CATEGORIES = {
  CHAT: 'chat',
  ECONOMY: 'economy',
  COMBAT: 'combat',
  LOYALTY: 'loyalty',
  EXPLORATION: 'exploration',
  SOCIAL: 'social',
} as const

export type MissionCategory = typeof MISSION_CATEGORIES[keyof typeof MISSION_CATEGORIES]

export const MISSION_OBJECTIVE_TYPES = {
  PLAY_COUNT: 'play_count',
  ROB_ATTEMPTS: 'rob_attempts',
  ROB_SUCCESSES: 'rob_successes',
  ROB_DEFENSES: 'rob_defenses',
  CHECKIN_TODAY: 'checkin_today',
  CHECKIN_STREAK: 'checkin_streak',
  CHECKIN_WEEK: 'checkin_week',
  PROFILE_VIEWED: 'profile_viewed',
  LEADERBOARD_VIEWED: 'leaderboard_viewed',
  BLACK_MARKET_VIEWED: 'black_market_viewed',
  ITEM_PURCHASED: 'item_purchased',
  WEALTH_EARNED: 'wealth_earned',
  MESSAGES_SENT: 'messages_sent',
} as const

export type MissionObjectiveType = typeof MISSION_OBJECTIVE_TYPES[keyof typeof MISSION_OBJECTIVE_TYPES]

// Difficulty distribution for random assignment
export const MISSION_DIFFICULTY_WEIGHTS = {
  [MISSION_TYPES.DAILY]: {
    [MISSION_DIFFICULTIES.EASY]: 0.50,
    [MISSION_DIFFICULTIES.MEDIUM]: 0.35,
    [MISSION_DIFFICULTIES.HARD]: 0.15,
  },
  [MISSION_TYPES.WEEKLY]: {
    [MISSION_DIFFICULTIES.EASY]: 0.40,
    [MISSION_DIFFICULTIES.MEDIUM]: 0.40,
    [MISSION_DIFFICULTIES.HARD]: 0.20,
  },
}

// Base rewards by difficulty (Rookie baseline, scales with tier)
export const MISSION_REWARDS = {
  [MISSION_TYPES.DAILY]: {
    [MISSION_DIFFICULTIES.EASY]: { wealth: 500, xp: 50 },
    [MISSION_DIFFICULTIES.MEDIUM]: { wealth: 1000, xp: 100 },
    [MISSION_DIFFICULTIES.HARD]: { wealth: 2000, xp: 200 },
  },
  [MISSION_TYPES.WEEKLY]: {
    [MISSION_DIFFICULTIES.EASY]: { wealth: 3000, xp: 300 },
    [MISSION_DIFFICULTIES.MEDIUM]: { wealth: 6000, xp: 600 },
    [MISSION_DIFFICULTIES.HARD]: { wealth: 12000, xp: 1200 },
  },
}

// Bonus for completing ALL missions of a type
export const MISSION_COMPLETION_BONUS = {
  [MISSION_TYPES.DAILY]: { wealth: 500, xp: 50, crate: null },
  [MISSION_TYPES.WEEKLY]: { wealth: 2000, xp: 200, crate: CRATE_TIERS.COMMON },
}

// =============================================================================
// ACHIEVEMENT REQUIREMENT TYPES
// =============================================================================

export const ACHIEVEMENT_REQUIREMENT_TYPES = {
  TOTAL_WEALTH_EARNED: 'total_wealth_earned',
  ROB_WINS: 'rob_wins',
  ROB_DEFENSES: 'rob_defenses',
  ROB_WIN_STREAK: 'rob_win_streak',
  CHECKIN_STREAK: 'checkin_streak',
  LEVEL: 'level',
  PLAY_COUNT: 'play_count',
  BUSINESS_COLLECTIONS: 'business_collections',
  MESSAGES_SENT: 'messages_sent',
  FACTION_JOINED: 'faction_joined',
  FACTION_DAYS: 'faction_days',
  TERRITORY_CAPTURES: 'territory_captures',
  JUICERNAUT_WINS: 'juicernaut_wins',
  JUICERNAUT_CONTRIBUTION: 'juicernaut_contribution',
  BUST_COUNT: 'bust_count',
  BAIL_COUNT: 'bail_count',
  LEGENDARY_CRATE_ITEM: 'legendary_crate_item',
  UNIQUE_ITEMS_OWNED: 'unique_items_owned',
  EARLY_ADOPTER: 'early_adopter',
  // Gambling (Phase 11)
  GAMBLING_WINS: 'gambling_wins',
  GAMBLING_TOTAL_WON: 'gambling_total_won',
  SLOTS_JACKPOT: 'slots_jackpot',
  BLACKJACK_WINS: 'blackjack_wins',
  COINFLIP_WINS: 'coinflip_wins',
  LOTTERY_WINS: 'lottery_wins',
  GAMBLING_WIN_STREAK: 'gambling_win_streak',
  HIGH_ROLLER_WAGER: 'high_roller_wager',
} as const

export type AchievementRequirementType = typeof ACHIEVEMENT_REQUIREMENT_TYPES[keyof typeof ACHIEVEMENT_REQUIREMENT_TYPES]

// =============================================================================
// GAMBLING & CASINO (Phase 11)
// =============================================================================

export const GAMBLING_TYPES = {
  SLOTS: 'slots',
  BLACKJACK: 'blackjack',
  COINFLIP: 'coinflip',
  LOTTERY: 'lottery',
} as const

export type GamblingType = typeof GAMBLING_TYPES[keyof typeof GAMBLING_TYPES]

export const GAMBLING_CONFIG = {
  // Betting limits
  MIN_BET: 100,
  MAX_BET_BASE: 10000,

  // Cooldowns (ms)
  SLOTS_COOLDOWN: 5000,
  BLACKJACK_COOLDOWN: 10000,
  COINFLIP_COOLDOWN: 30000,

  // Coinflip
  COINFLIP_EXPIRY_MINUTES: 10,
  COINFLIP_MIN_BET: 500,

  // Lottery
  LOTTERY_TICKET_COST: 1000,
  LOTTERY_NUMBERS_COUNT: 3,
  LOTTERY_NUMBER_MAX: 20,
  LOTTERY_MAX_TICKETS_PER_DRAW: 5,
  LOTTERY_HOUSE_CUT: 0.10,

  // Jackpot
  JACKPOT_BASE_POOL: 10000,
  JACKPOT_CONTRIBUTION_RATE: 0.02,
  JACKPOT_TRIGGER_CHANCE: 0.001,
} as const

export const SLOTS_CONFIG = {
  REELS: 3,
  SYMBOLS: ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '🎰'] as const,

  // Symbol weights (higher = more common)
  SYMBOL_WEIGHTS: {
    '🍒': 30,
    '🍋': 25,
    '🍊': 20,
    '🍇': 15,
    '💎': 7,
    '7️⃣': 2,
    '🎰': 1,
  } as const,

  // Payout multipliers (3 matching)
  PAYOUTS: {
    '🍒': 2,
    '🍋': 3,
    '🍊': 4,
    '🍇': 6,
    '💎': 15,
    '7️⃣': 50,
    '🎰': 0, // Jackpot - special handling
  } as const,

  // Partial matches (2 matching)
  PARTIAL_PAYOUTS: {
    '🍒': 0.5,
    '🍋': 0.5,
    '🍊': 1,
    '🍇': 1.5,
    '💎': 3,
    '7️⃣': 5,
    '🎰': 2,
  } as const,
} as const

export const BLACKJACK_CONFIG = {
  DEALER_STAND: 17,
  BLACKJACK_PAYOUT: 2.5,
  INSURANCE_PAYOUT: 2,
  DOUBLE_DOWN_ALLOWED: true,
  SPLIT_ALLOWED: true,
  MAX_SPLITS: 2,
} as const

// Tier-based max bet scaling
export const GAMBLING_MAX_BET_BY_TIER: Record<string, number> = {
  [TIERS.ROOKIE]: 10000,
  [TIERS.ASSOCIATE]: 20000,
  [TIERS.SOLDIER]: 35000,
  [TIERS.CAPTAIN]: 50000,
  [TIERS.UNDERBOSS]: 75000,
  [TIERS.KINGPIN]: 100000,
}

// Tier-based luck bonus (added to base odds)
export const GAMBLING_LUCK_BY_TIER: Record<string, number> = {
  [TIERS.ROOKIE]: 0,
  [TIERS.ASSOCIATE]: 0.01,
  [TIERS.SOLDIER]: 0.02,
  [TIERS.CAPTAIN]: 0.03,
  [TIERS.UNDERBOSS]: 0.04,
  [TIERS.KINGPIN]: 0.05,
}

// Gambling notification types
export const GAMBLING_NOTIFICATION_TYPES = {
  BIG_WIN: 'gambling_big_win',
  JACKPOT: 'gambling_jackpot',
  COINFLIP_CHALLENGE: 'coinflip_challenge',
  COINFLIP_RESULT: 'coinflip_result',
  LOTTERY_WIN: 'lottery_win',
  LOTTERY_DRAWING: 'lottery_drawing',
} as const

export type GamblingNotificationType = typeof GAMBLING_NOTIFICATION_TYPES[keyof typeof GAMBLING_NOTIFICATION_TYPES]
