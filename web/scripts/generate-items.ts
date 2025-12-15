/**
 * Item Generation Script for Kingpin
 * Design Drift Remediation - Generate 419 items
 *
 * Run with: npx ts-node scripts/generate-items.ts
 */

// Item naming templates based on DESIGN_DRIFT_AUDIT.md
const WEAPON_NAMES = {
  common: {
    prefixes: ['Rusty', 'Bent', 'Cracked', 'Worn', 'Old', 'Dented', 'Chipped', 'Scratched', 'Faded', 'Tattered'],
    bases: ['Knife', 'Pipe', 'Bat', 'Crowbar', 'Shiv', 'Club', 'Hammer', 'Wrench', 'Chain', 'Bottle', 'Brick', 'Rod', 'Plank', 'Stick', 'Rock']
  },
  uncommon: {
    prefixes: ['Steel', 'Chrome', 'Iron', 'Brass', 'Copper', 'Alloy', 'Reinforced', 'Sharpened', 'Balanced', 'Custom'],
    bases: ['Switchblade', 'Revolver', 'Pistol', 'Machete', 'Baton', 'Knuckles', 'Taser', 'Blade', 'Cleaver', 'Hatchet', 'Dagger', 'Sap', 'Cane']
  },
  rare: {
    prefixes: ['Yakuza', 'Cartel', 'Bratva', 'Triad', 'Syndicate', 'Elite', 'Military', 'Tactical', 'Custom'],
    bases: ['Katana', 'SMG', 'Shotgun', 'Rifle', 'Carbine', 'Tanto', 'Wakizashi', 'Combat Knife', 'Compact Pistol']
  },
  legendary: {
    names: [
      'The Widowmaker', 'Kingpin\'s Verdict', 'Soul Reaper', 'Neon Death', 'The Silencer',
      'Chrome Fury', 'Shadow Strike', 'The Executioner', 'Lazarus Edge', 'Final Word'
    ]
  }
}

const ARMOR_NAMES = {
  common: {
    prefixes: ['Tattered', 'Scuffed', 'Worn', 'Patched', 'Faded', 'Old', 'Stained', 'Torn', 'Frayed', 'Used'],
    bases: ['Jacket', 'Hoodie', 'Jeans', 'Boots', 'Vest', 'Coat', 'Gloves', 'Cap', 'Bandana', 'Shirt', 'Pants', 'Beanie', 'Sneakers']
  },
  uncommon: {
    prefixes: ['Leather', 'Denim', 'Canvas', 'Reinforced', 'Steel-toe', 'Padded', 'Lined', 'Armored', 'Plated'],
    bases: ['Vest', 'Boots', 'Jacket', 'Gloves', 'Coat', 'Helmet', 'Pants', 'Gauntlets', 'Shin Guards', 'Arm Guards']
  },
  rare: {
    prefixes: ['Kevlar', 'Ballistic', 'Tactical', 'Combat', 'Military', 'SWAT', 'Riot', 'Assault'],
    bases: ['Vest', 'Coat', 'Suit', 'Armor', 'Helmet', 'Shield', 'Plate Carrier', 'Body Armor']
  },
  legendary: {
    names: [
      'Shadow\'s Embrace', 'The Untouchable', 'Iron Will', 'Neon Guardian', 'The Fortress',
      'Phantom Shroud', 'Kingpin\'s Aegis', 'Immortal Plating', 'Lazarus Shell', 'The Bulwark'
    ]
  }
}

const BUSINESS_NAMES = {
  common: {
    prefixes: ['Corner', 'Small', 'Local', 'Neighborhood', 'Street', 'Back Alley', 'Downtown', 'Westside', 'Eastside'],
    bases: ['Store', 'Stand', 'Cart', 'Kiosk', 'Shop', 'Stall', 'Booth', 'Vendor', 'Market', 'Newsstand', 'Food Truck', 'Repair Shop']
  },
  uncommon: {
    prefixes: ['Midtown', 'Central', 'Popular', 'Busy', 'Well-Known', 'Established', 'Growing'],
    bases: ['Auto Shop', 'Bar', 'Grill', 'Laundromat', 'Pawn Shop', 'Garage', 'Diner', 'Tattoo Parlor', 'Gym', 'Barbershop', 'Deli', 'Pharmacy']
  },
  rare: {
    prefixes: ['Upscale', 'Premium', 'High-End', 'Exclusive', 'VIP', 'Elite', 'Luxury'],
    bases: ['Nightclub', 'Casino', 'Import/Export', 'Strip Club', 'Lounge', 'Restaurant', 'Hotel', 'Warehouse', 'Distribution Center']
  },
  legendary: {
    names: [
      'Casino Empire', 'The Syndicate Hub', 'Neon Paradise', 'The Golden Mile', 'Shadow Holdings',
      'Kingpin Industries', 'Lazarus Corporation', 'Chrome Tower', 'The Underground', 'Apex Enterprises'
    ]
  }
}

const HOUSING_NAMES = {
  common: {
    prefixes: ['Cramped', 'Small', 'Basic', 'Simple', 'Modest', 'Cheap', 'Rundown', 'Budget'],
    bases: ['Studio', 'Apartment', 'Room', 'Flat', 'Unit', 'Dwelling', 'Bedsit', 'Basement', 'Attic', 'Garage Loft']
  },
  uncommon: {
    prefixes: ['Downtown', 'Suburban', 'Modern', 'Renovated', 'Spacious', 'Updated', 'Nice'],
    bases: ['Loft', 'Condo', 'House', 'Townhouse', 'Duplex', 'Bungalow', 'Cottage', 'Suite', 'Penthouse Studio']
  },
  rare: {
    prefixes: ['Harbor', 'Gated', 'Luxury', 'Premium', 'Executive', 'Upscale', 'Designer'],
    bases: ['Penthouse', 'Mansion', 'Villa', 'Estate', 'Manor', 'Retreat', 'Compound', 'Tower Suite']
  },
  legendary: {
    names: [
      'Private Island', 'Fortress Compound', 'Sky Palace', 'The Citadel', 'Neon Spire',
      'Kingpin\'s Manor', 'Shadow Estate', 'Chrome Heights Tower', 'The Sanctuary', 'Lazarus Keep'
    ]
  }
}

// Stat ranges by tier (from DESIGN_DRIFT_AUDIT.md)
const STAT_RANGES = {
  weapon: {
    common: { robBonusMin: 5, robBonusMax: 10, priceMin: 500, priceMax: 2000 },
    uncommon: { robBonusMin: 12, robBonusMax: 18, priceMin: 3000, priceMax: 8000 },
    rare: { robBonusMin: 20, robBonusMax: 28, priceMin: 12000, priceMax: 30000 },
    legendary: { robBonusMin: 30, robBonusMax: 40, priceMin: 50000, priceMax: 150000 }
  },
  armor: {
    common: { defenseBonusMin: 5, defenseBonusMax: 10, priceMin: 500, priceMax: 2000 },
    uncommon: { defenseBonusMin: 12, defenseBonusMax: 18, priceMin: 3000, priceMax: 8000 },
    rare: { defenseBonusMin: 20, defenseBonusMax: 28, priceMin: 12000, priceMax: 30000 },
    legendary: { defenseBonusMin: 30, defenseBonusMax: 40, priceMin: 50000, priceMax: 150000 }
  },
  business: {
    common: { revenueMin: 500, revenueMax: 800, dailyRevenue: { min: 2000, max: 5000 }, priceMin: 5000, priceMax: 15000 },
    uncommon: { revenueMin: 1200, revenueMax: 2500, dailyRevenue: { min: 6000, max: 15000 }, priceMin: 25000, priceMax: 60000 },
    rare: { revenueMin: 3500, revenueMax: 6000, dailyRevenue: { min: 18000, max: 35000 }, priceMin: 100000, priceMax: 250000 },
    legendary: { revenueMin: 8000, revenueMax: 15000, dailyRevenue: { min: 40000, max: 80000 }, priceMin: 400000, priceMax: 1000000 }
  },
  housing: {
    common: { insuranceMin: 5, insuranceMax: 10, upkeepCost: 100, priceMin: 2000, priceMax: 8000 },
    uncommon: { insuranceMin: 12, insuranceMax: 18, upkeepCost: 300, priceMin: 15000, priceMax: 40000 },
    rare: { insuranceMin: 20, insuranceMax: 28, upkeepCost: 800, priceMin: 75000, priceMax: 200000 },
    legendary: { insuranceMin: 30, insuranceMax: 40, upkeepCost: 2000, priceMin: 350000, priceMax: 800000 }
  }
}

// Helper to generate random number in range
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Helper to generate random decimal in range
function randDecimal(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

// Generate unique weapon names
function generateWeaponNames(tier: string, count: number, existingNames: Set<string>): string[] {
  const names: string[] = []
  const config = WEAPON_NAMES[tier as keyof typeof WEAPON_NAMES]

  if (tier === 'legendary') {
    const legendaryNames = (config as { names: string[] }).names
    for (const name of legendaryNames) {
      if (!existingNames.has(name) && names.length < count) {
        names.push(name)
        existingNames.add(name)
      }
    }
  } else {
    const { prefixes, bases } = config as { prefixes: string[], bases: string[] }
    for (const prefix of prefixes) {
      for (const base of bases) {
        const name = `${prefix} ${base}`
        if (!existingNames.has(name) && names.length < count) {
          names.push(name)
          existingNames.add(name)
        }
      }
    }
  }
  return names
}

// Generate unique armor names
function generateArmorNames(tier: string, count: number, existingNames: Set<string>): string[] {
  const names: string[] = []
  const config = ARMOR_NAMES[tier as keyof typeof ARMOR_NAMES]

  if (tier === 'legendary') {
    const legendaryNames = (config as { names: string[] }).names
    for (const name of legendaryNames) {
      if (!existingNames.has(name) && names.length < count) {
        names.push(name)
        existingNames.add(name)
      }
    }
  } else {
    const { prefixes, bases } = config as { prefixes: string[], bases: string[] }
    for (const prefix of prefixes) {
      for (const base of bases) {
        const name = `${prefix} ${base}`
        if (!existingNames.has(name) && names.length < count) {
          names.push(name)
          existingNames.add(name)
        }
      }
    }
  }
  return names
}

// Generate unique business names
function generateBusinessNames(tier: string, count: number, existingNames: Set<string>): string[] {
  const names: string[] = []
  const config = BUSINESS_NAMES[tier as keyof typeof BUSINESS_NAMES]

  if (tier === 'legendary') {
    const legendaryNames = (config as { names: string[] }).names
    for (const name of legendaryNames) {
      if (!existingNames.has(name) && names.length < count) {
        names.push(name)
        existingNames.add(name)
      }
    }
  } else {
    const { prefixes, bases } = config as { prefixes: string[], bases: string[] }
    for (const prefix of prefixes) {
      for (const base of bases) {
        const name = `${prefix} ${base}`
        if (!existingNames.has(name) && names.length < count) {
          names.push(name)
          existingNames.add(name)
        }
      }
    }
  }
  return names
}

// Generate unique housing names
function generateHousingNames(tier: string, count: number, existingNames: Set<string>): string[] {
  const names: string[] = []
  const config = HOUSING_NAMES[tier as keyof typeof HOUSING_NAMES]

  if (tier === 'legendary') {
    const legendaryNames = (config as { names: string[] }).names
    for (const name of legendaryNames) {
      if (!existingNames.has(name) && names.length < count) {
        names.push(name)
        existingNames.add(name)
      }
    }
  } else {
    const { prefixes, bases } = config as { prefixes: string[], bases: string[] }
    for (const prefix of prefixes) {
      for (const base of bases) {
        const name = `${prefix} ${base}`
        if (!existingNames.has(name) && names.length < count) {
          names.push(name)
          existingNames.add(name)
        }
      }
    }
  }
  return names
}

interface ItemData {
  name: string
  type: string
  tier: string
  base_durability: number
  rob_bonus: number | null
  defense_bonus: number | null
  revenue_min: number | null
  revenue_max: number | null
  insurance_percent: number | null
  daily_revenue_potential: number | null
  upkeep_cost: number | null
  operating_cost: number | null
  purchase_price: number
  sell_price: number
  description: string
  flavor_text: string
}

// Generate all items
export function generateItems(existingNames: Set<string>): ItemData[] {
  const items: ItemData[] = []

  // Target counts per tier (subtracting existing 2 per tier)
  const targets = {
    common: 38,    // Need 38 more to reach 40
    uncommon: 38,  // Need 38 more to reach 40
    rare: 18,      // Need 18 more to reach 20
    legendary: 8   // Need 8 more to reach 10
  }

  // Generate weapons
  for (const [tier, count] of Object.entries(targets)) {
    const stats = STAT_RANGES.weapon[tier as keyof typeof STAT_RANGES.weapon]
    const names = generateWeaponNames(tier, count, existingNames)

    for (const name of names) {
      const price = rand(stats.priceMin, stats.priceMax)
      items.push({
        name,
        type: 'weapon',
        tier,
        base_durability: 100,
        rob_bonus: randDecimal(stats.robBonusMin, stats.robBonusMax),
        defense_bonus: null,
        revenue_min: null,
        revenue_max: null,
        insurance_percent: null,
        daily_revenue_potential: null,
        upkeep_cost: null,
        operating_cost: null,
        purchase_price: price,
        sell_price: Math.floor(price * 0.5),
        description: `A ${tier} tier weapon for aspiring criminals.`,
        flavor_text: `"In Lazarus City, the right weapon opens doors... and skulls."`
      })
    }
  }

  // Generate armor
  for (const [tier, count] of Object.entries(targets)) {
    const stats = STAT_RANGES.armor[tier as keyof typeof STAT_RANGES.armor]
    const names = generateArmorNames(tier, count, existingNames)

    for (const name of names) {
      const price = rand(stats.priceMin, stats.priceMax)
      items.push({
        name,
        type: 'armor',
        tier,
        base_durability: 100,
        rob_bonus: null,
        defense_bonus: randDecimal(stats.defenseBonusMin, stats.defenseBonusMax),
        revenue_min: null,
        revenue_max: null,
        insurance_percent: null,
        daily_revenue_potential: null,
        upkeep_cost: null,
        operating_cost: null,
        purchase_price: price,
        sell_price: Math.floor(price * 0.5),
        description: `${tier.charAt(0).toUpperCase() + tier.slice(1)} tier protection for street operations.`,
        flavor_text: `"Protection is an investment in your future... if you have one."`
      })
    }
  }

  // Generate businesses
  for (const [tier, count] of Object.entries(targets)) {
    const stats = STAT_RANGES.business[tier as keyof typeof STAT_RANGES.business]
    const names = generateBusinessNames(tier, count, existingNames)

    for (const name of names) {
      const price = rand(stats.priceMin, stats.priceMax)
      const dailyRevenue = rand(stats.dailyRevenue.min, stats.dailyRevenue.max)
      const operatingCost = Math.floor(dailyRevenue * 0.1) // 10% operating cost

      items.push({
        name,
        type: 'business',
        tier,
        base_durability: 100,
        rob_bonus: null,
        defense_bonus: null,
        revenue_min: stats.revenueMin,
        revenue_max: stats.revenueMax,
        insurance_percent: null,
        daily_revenue_potential: dailyRevenue,
        upkeep_cost: null,
        operating_cost: operatingCost,
        purchase_price: price,
        sell_price: Math.floor(price * 0.5),
        description: `A ${tier} tier business generating steady income.`,
        flavor_text: `"Money never sleeps in Lazarus City."`
      })
    }
  }

  // Generate housing
  for (const [tier, count] of Object.entries(targets)) {
    const stats = STAT_RANGES.housing[tier as keyof typeof STAT_RANGES.housing]
    const names = generateHousingNames(tier, count, existingNames)

    for (const name of names) {
      const price = rand(stats.priceMin, stats.priceMax)
      items.push({
        name,
        type: 'housing',
        tier,
        base_durability: 100,
        rob_bonus: null,
        defense_bonus: null,
        revenue_min: null,
        revenue_max: null,
        insurance_percent: randDecimal(stats.insuranceMin, stats.insuranceMax),
        daily_revenue_potential: null,
        upkeep_cost: stats.upkeepCost,
        operating_cost: null,
        purchase_price: price,
        sell_price: Math.floor(price * 0.5),
        description: `${tier.charAt(0).toUpperCase() + tier.slice(1)} tier housing with ${stats.insuranceMin}-${stats.insuranceMax}% insurance coverage.`,
        flavor_text: `"Everyone needs a place to lay low."`
      })
    }
  }

  return items
}

// Generate SQL INSERT statements
export function generateSQL(items: ItemData[]): string {
  const values = items.map(item => {
    const robBonus = item.rob_bonus !== null ? item.rob_bonus : 'NULL'
    const defenseBonus = item.defense_bonus !== null ? item.defense_bonus : 'NULL'
    const revenueMin = item.revenue_min !== null ? item.revenue_min : 'NULL'
    const revenueMax = item.revenue_max !== null ? item.revenue_max : 'NULL'
    const insurancePercent = item.insurance_percent !== null ? item.insurance_percent : 'NULL'
    const dailyRevenuePotential = item.daily_revenue_potential !== null ? item.daily_revenue_potential : 'NULL'
    const upkeepCost = item.upkeep_cost !== null ? item.upkeep_cost : 'NULL'
    const operatingCost = item.operating_cost !== null ? item.operating_cost : 'NULL'

    return `('${item.name.replace(/'/g, "''")}', '${item.type}', '${item.tier}', ${item.base_durability}, ${robBonus}, ${defenseBonus}, ${revenueMin}, ${revenueMax}, ${insurancePercent}, ${dailyRevenuePotential}, ${upkeepCost}, ${operatingCost}, ${item.purchase_price}, ${item.sell_price}, '${item.description.replace(/'/g, "''")}', '${item.flavor_text.replace(/'/g, "''")}')`
  })

  return `INSERT INTO items (name, type, tier, base_durability, rob_bonus, defense_bonus, revenue_min, revenue_max, insurance_percent, daily_revenue_potential, upkeep_cost, operating_cost, purchase_price, sell_price, description, flavor_text) VALUES
${values.join(',\n')};`
}

// Main execution
const existingNames = new Set<string>()
const items = generateItems(existingNames)

console.log(`Generated ${items.length} items:`)
console.log(`- Weapons: ${items.filter(i => i.type === 'weapon').length}`)
console.log(`- Armor: ${items.filter(i => i.type === 'armor').length}`)
console.log(`- Businesses: ${items.filter(i => i.type === 'business').length}`)
console.log(`- Housing: ${items.filter(i => i.type === 'housing').length}`)

console.log('\n--- SQL INSERT STATEMENT ---\n')
console.log(generateSQL(items))
