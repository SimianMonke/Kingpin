import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config()

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const adapter = new PrismaNeon({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding consumable types...')

  const consumableTypes = [
    // XP Boosters
    {
      id: 'xp_25',
      name: 'XP Chip',
      category: 'xp',
      cost: 25000,
      is_duration_buff: true,
      duration_hours: 24,
      buff_key: 'xp_multiplier',
      buff_value: 1.25,
      description: '+25% XP gains for 24 hours',
      flavor_text: 'A neural implant that accelerates learning pathways.',
      icon: 'chip',
      sort_order: 1,
    },
    {
      id: 'xp_50',
      name: 'Neural Enhancer',
      category: 'xp',
      cost: 50000,
      is_duration_buff: true,
      duration_hours: 24,
      buff_key: 'xp_multiplier',
      buff_value: 1.50,
      description: '+50% XP gains for 24 hours',
      flavor_text: 'Military-grade cognitive enhancement.',
      icon: 'brain',
      sort_order: 2,
    },
    {
      id: 'xp_100',
      name: 'Cognitive Overclock',
      category: 'xp',
      cost: 100000,
      is_duration_buff: true,
      duration_hours: 24,
      buff_key: 'xp_multiplier',
      buff_value: 2.00,
      description: '+100% XP gains for 24 hours',
      flavor_text: 'Experimental tech. Your brain will hate you tomorrow.',
      icon: 'zap',
      sort_order: 3,
    },

    // Combat Enhancers
    {
      id: 'rob_atk_5',
      name: 'Targeting Module',
      category: 'combat',
      cost: 35000,
      is_duration_buff: true,
      duration_hours: 24,
      buff_key: 'rob_attack',
      buff_value: 1.05,
      description: '+5% rob success rate',
      flavor_text: 'Smart optics that highlight vulnerabilities.',
      icon: 'target',
      sort_order: 10,
    },
    {
      id: 'rob_atk_10',
      name: 'Combat Stims',
      category: 'combat',
      cost: 60000,
      is_duration_buff: true,
      duration_hours: 24,
      buff_key: 'rob_attack',
      buff_value: 1.10,
      description: '+10% rob success rate',
      flavor_text: 'Adrenaline cocktail. Makes you faster, meaner, better.',
      icon: 'syringe',
      sort_order: 11,
    },
    {
      id: 'rob_def_5',
      name: 'Reflex Amplifier',
      category: 'combat',
      cost: 40000,
      is_duration_buff: true,
      duration_hours: 24,
      buff_key: 'rob_defense',
      buff_value: 1.05,
      description: '+5% defense rating',
      flavor_text: 'Heightened awareness. You see attacks coming.',
      icon: 'shield',
      sort_order: 12,
    },
    {
      id: 'rob_def_10',
      name: 'Nano-Weave Boost',
      category: 'combat',
      cost: 75000,
      is_duration_buff: true,
      duration_hours: 24,
      buff_key: 'rob_defense',
      buff_value: 1.10,
      description: '+10% defense rating',
      flavor_text: 'Microscopic armor that hardens on impact.',
      icon: 'shield-check',
      sort_order: 13,
    },

    // Economy Boosters
    {
      id: 'biz_25',
      name: 'Business License',
      category: 'economy',
      cost: 30000,
      is_duration_buff: true,
      duration_hours: 24,
      buff_key: 'business_revenue',
      buff_value: 1.25,
      description: '+25% business revenue',
      flavor_text: 'Legitimate paperwork opens doors. And wallets.',
      icon: 'file-text',
      sort_order: 20,
    },
    {
      id: 'biz_50',
      name: 'Corporate Contracts',
      category: 'economy',
      cost: 65000,
      is_duration_buff: true,
      duration_hours: 24,
      buff_key: 'business_revenue',
      buff_value: 1.50,
      description: '+50% business revenue',
      flavor_text: "Exclusive deals with the megacorps. Don't ask how.",
      icon: 'briefcase',
      sort_order: 21,
    },
    {
      id: 'crate_3',
      name: 'Lucky Coin',
      category: 'economy',
      cost: 35000,
      is_duration_buff: true,
      duration_hours: 24,
      buff_key: 'crate_drop',
      buff_value: 1.03,
      description: '+3% crate drop rate',
      flavor_text: "Found in a dead gambler's pocket. Seems to work.",
      icon: 'coins',
      sort_order: 22,
    },
    {
      id: 'crate_5',
      name: "Fortune's Favor",
      category: 'economy',
      cost: 80000,
      is_duration_buff: true,
      duration_hours: 24,
      buff_key: 'crate_drop',
      buff_value: 1.05,
      description: '+5% crate drop rate',
      flavor_text: 'Lady Luck owes you one. Time to collect.',
      icon: 'clover',
      sort_order: 23,
    },
    {
      id: 'wealth_10',
      name: 'Street Smarts',
      category: 'economy',
      cost: 40000,
      is_duration_buff: true,
      duration_hours: 24,
      buff_key: 'wealth_gain',
      buff_value: 1.10,
      description: '+10% wealth from !play',
      flavor_text: 'Know the right people. Know the right prices.',
      icon: 'trending-up',
      sort_order: 24,
    },
    {
      id: 'wealth_20',
      name: "Kingpin's Touch",
      category: 'economy',
      cost: 90000,
      is_duration_buff: true,
      duration_hours: 24,
      buff_key: 'wealth_gain',
      buff_value: 1.20,
      description: '+20% wealth from !play',
      flavor_text: 'Everything you touch turns to gold. Metaphorically.',
      icon: 'crown',
      sort_order: 25,
    },

    // Single-Use Utility Items
    {
      id: 'bail_bond',
      name: 'Bail Bond',
      category: 'utility',
      cost: 15000,
      is_duration_buff: false,
      is_single_use: true,
      max_owned: 5,
      description: 'Skip the 10% bail cost once',
      flavor_text: 'A favor from a friend in the system.',
      icon: 'key',
      sort_order: 30,
    },
    {
      id: 'reroll_token',
      name: 'Reroll Token',
      category: 'utility',
      cost: 10000,
      is_duration_buff: false,
      is_single_use: true,
      max_owned: 10,
      description: 'Free equipment shop reroll',
      flavor_text: 'The dealer owes you a new hand.',
      icon: 'refresh-cw',
      sort_order: 31,
    },
    {
      id: 'crate_magnet',
      name: 'Crate Magnet',
      category: 'utility',
      cost: 75000,
      is_duration_buff: false,
      is_single_use: true,
      max_owned: 3,
      description: 'Sets crate drop rate to 50% on next !play',
      flavor_text: 'Attracts loot like moths to a flame.',
      icon: 'magnet',
      sort_order: 32,
    },
  ]

  for (const consumable of consumableTypes) {
    await prisma.consumable_types.upsert({
      where: { id: consumable.id },
      update: {
        name: consumable.name,
        category: consumable.category,
        cost: consumable.cost,
        is_duration_buff: consumable.is_duration_buff,
        duration_hours: consumable.duration_hours,
        buff_key: consumable.buff_key,
        buff_value: consumable.buff_value,
        description: consumable.description,
        flavor_text: consumable.flavor_text,
        icon: consumable.icon,
        sort_order: consumable.sort_order,
        is_single_use: consumable.is_single_use ?? false,
        max_owned: consumable.max_owned ?? null,
      },
      create: consumable,
    })
  }

  console.log(`Seeded ${consumableTypes.length} consumable types`)
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
