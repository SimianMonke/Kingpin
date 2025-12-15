import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...')

  // ==========================================================================
  // SEED FACTIONS
  // ==========================================================================
  console.log('Seeding factions...')

  const factions = await Promise.all([
    prisma.faction.upsert({
      where: { factionName: 'The Volkov Bratva' },
      update: {},
      create: {
        factionName: 'The Volkov Bratva',
        description: 'Russian organized crime that expanded aggressively when western corps pulled out of Lazarus. Ruthless, hierarchical, and utterly pragmatic.',
        colorHex: '#DC143C',
        motto: 'Кровь за кровь (Blood for blood)',
      },
    }),
    prisma.faction.upsert({
      where: { factionName: 'Dead Circuit' },
      update: {},
      create: {
        factionName: 'Dead Circuit',
        description: 'Started as hackers, smugglers, and outcasts who built their own infrastructure beneath the city. Part resistance, part criminal enterprise.',
        colorHex: '#00FFFF',
        motto: 'We are the signal in the static.',
      },
    }),
    prisma.faction.upsert({
      where: { factionName: 'Kessler Group' },
      update: {},
      create: {
        factionName: 'Kessler Group',
        description: 'Founded by a decorated special forces commander. Recruited the best operators from collapsing militaries worldwide. They don\'t care who\'s right—they care who\'s paying.',
        colorHex: '#808000',
        motto: 'Payment on delivery.',
      },
    }),
  ])

  console.log(`Created ${factions.length} factions`)

  // ==========================================================================
  // SEED TERRITORIES
  // ==========================================================================
  console.log('Seeding territories...')

  const volkovFaction = factions.find(f => f.factionName === 'The Volkov Bratva')!
  const circuitFaction = factions.find(f => f.factionName === 'Dead Circuit')!
  const kesslerFaction = factions.find(f => f.factionName === 'Kessler Group')!

  const territories = await Promise.all([
    // Standard Territories (9)
    prisma.territory.upsert({
      where: { territoryName: 'Chrome Heights' },
      update: {},
      create: {
        territoryName: 'Chrome Heights',
        description: 'Elite towers. The wealthy hiding above the rot.',
        buffType: 'xp',
        buffValue: 5,
        isContested: false,
      },
    }),
    prisma.territory.upsert({
      where: { territoryName: 'Neon Mile' },
      update: {},
      create: {
        territoryName: 'Neon Mile',
        description: 'Entertainment district. Clubs, casinos, braindance dens.',
        buffType: 'business_revenue',
        buffValue: 10,
        isContested: false,
      },
    }),
    prisma.territory.upsert({
      where: { territoryName: 'The Ports' },
      update: {},
      create: {
        territoryName: 'The Ports',
        description: 'Shipping and smuggling. Bodies disappear here.',
        buffType: 'rob_success',
        buffValue: 5,
        isContested: false,
        controllingFactionId: volkovFaction.id, // Volkov starting territory
        startingFactionId: volkovFaction.id,
      },
    }),
    prisma.territory.upsert({
      where: { territoryName: 'Silicon Sprawl' },
      update: {},
      create: {
        territoryName: 'Silicon Sprawl',
        description: 'Tech hub. Data centers, hacker dens, research labs.',
        buffType: 'crate_drop',
        buffValue: 10,
        isContested: false,
      },
    }),
    prisma.territory.upsert({
      where: { territoryName: 'Black Bazaar' },
      update: {},
      create: {
        territoryName: 'Black Bazaar',
        description: 'Largest open market. Everything for sale.',
        buffType: 'shop_discount',
        buffValue: 5,
        isContested: false,
      },
    }),
    prisma.territory.upsert({
      where: { territoryName: 'The Hollows' },
      update: {},
      create: {
        territoryName: 'The Hollows',
        description: 'Underground slums. Those who fell through the cracks.',
        buffType: 'defense',
        buffValue: 5,
        isContested: false,
        controllingFactionId: circuitFaction.id, // Dead Circuit starting territory
        startingFactionId: circuitFaction.id,
      },
    }),
    prisma.territory.upsert({
      where: { territoryName: 'Midtown' },
      update: {},
      create: {
        territoryName: 'Midtown',
        description: 'Buffer zone. Office drones by day, predators by night.',
        buffType: 'xp',
        buffValue: 5,
        isContested: false,
        controllingFactionId: kesslerFaction.id, // Kessler starting territory
        startingFactionId: kesslerFaction.id,
      },
    }),
    prisma.territory.upsert({
      where: { territoryName: 'Rustlands' },
      update: {},
      create: {
        territoryName: 'Rustlands',
        description: 'Industrial wastes. Toxic air, desperate workers.',
        buffType: 'business_revenue',
        buffValue: 10,
        isContested: false,
      },
    }),
    prisma.territory.upsert({
      where: { territoryName: 'Memorial District' },
      update: {},
      create: {
        territoryName: 'Memorial District',
        description: 'Old city ruins. Crumbling monuments, ghosts of before.',
        buffType: 'wealth',
        buffValue: 5,
        isContested: false,
      },
    }),
    // Contested Territories (3)
    prisma.territory.upsert({
      where: { territoryName: 'Ashfall' },
      update: {},
      create: {
        territoryName: 'Ashfall',
        description: 'Bombed-out sector. Scavengers and worse.',
        buffType: 'xp',
        buffValue: 10,
        isContested: true,
      },
    }),
    prisma.territory.upsert({
      where: { territoryName: 'Deadzone' },
      update: {},
      create: {
        territoryName: 'Deadzone',
        description: 'Lawless. No rules. Survival only.',
        buffType: 'rob_success',
        buffValue: 10,
        isContested: true,
      },
    }),
    prisma.territory.upsert({
      where: { territoryName: 'Freeport' },
      update: {},
      create: {
        territoryName: 'Freeport',
        description: 'Neutral ground. Betrayal here marks you for death.',
        buffType: 'all_rewards',
        buffValue: 15,
        isContested: true,
      },
    }),
  ])

  console.log(`Created ${territories.length} territories`)

  // ==========================================================================
  // SEED ITEMS
  // ==========================================================================
  console.log('Seeding items...')

  const items = await Promise.all([
    // WEAPONS - Common
    prisma.item.upsert({
      where: { itemName: 'Rusty Knife' },
      update: {},
      create: {
        itemName: 'Rusty Knife',
        itemType: 'weapon',
        tier: 'common',
        robBonus: 3,
        purchasePrice: 500,
        sellPrice: 250,
        description: 'A corroded blade. Better than nothing.',
        flavorText: 'Found in a dumpster behind Neon Mile.',
      },
    }),
    prisma.item.upsert({
      where: { itemName: 'Brass Knuckles' },
      update: {},
      create: {
        itemName: 'Brass Knuckles',
        itemType: 'weapon',
        tier: 'common',
        robBonus: 4,
        purchasePrice: 750,
        sellPrice: 375,
        description: 'Classic street enforcement tool.',
        flavorText: 'Leaves a memorable impression.',
      },
    }),
    prisma.item.upsert({
      where: { itemName: 'Combat Knife' },
      update: {},
      create: {
        itemName: 'Combat Knife',
        itemType: 'weapon',
        tier: 'common',
        robBonus: 5,
        purchasePrice: 1000,
        sellPrice: 500,
        description: 'Military surplus. Still sharp.',
        flavorText: 'Standard issue for Kessler recruits.',
      },
    }),
    // WEAPONS - Uncommon
    prisma.item.upsert({
      where: { itemName: 'Stun Baton' },
      update: {},
      create: {
        itemName: 'Stun Baton',
        itemType: 'weapon',
        tier: 'uncommon',
        robBonus: 7,
        purchasePrice: 2500,
        sellPrice: 1250,
        description: 'High-voltage persuasion device.',
        flavorText: 'Preferred by security forces.',
      },
    }),
    prisma.item.upsert({
      where: { itemName: 'Switchblade' },
      update: {},
      create: {
        itemName: 'Switchblade',
        itemType: 'weapon',
        tier: 'uncommon',
        robBonus: 8,
        purchasePrice: 3000,
        sellPrice: 1500,
        description: 'Spring-loaded and concealable.',
        flavorText: 'Dead Circuit special.',
      },
    }),
    // WEAPONS - Rare
    prisma.item.upsert({
      where: { itemName: 'Plasma Cutter' },
      update: {},
      create: {
        itemName: 'Plasma Cutter',
        itemType: 'weapon',
        tier: 'rare',
        robBonus: 10,
        purchasePrice: 7500,
        sellPrice: 3750,
        description: 'Industrial tool repurposed for violence.',
        flavorText: 'Cuts through safes and people alike.',
      },
    }),
    prisma.item.upsert({
      where: { itemName: 'Mono-Wire Garrote' },
      update: {},
      create: {
        itemName: 'Mono-Wire Garrote',
        itemType: 'weapon',
        tier: 'rare',
        robBonus: 12,
        purchasePrice: 10000,
        sellPrice: 5000,
        description: 'Monomolecular wire. Silent. Deadly.',
        flavorText: 'Volkov assassination tool.',
      },
    }),
    // WEAPONS - Legendary
    prisma.item.upsert({
      where: { itemName: 'Mantis Blades' },
      update: {},
      create: {
        itemName: 'Mantis Blades',
        itemType: 'weapon',
        tier: 'legendary',
        robBonus: 15,
        purchasePrice: 50000,
        sellPrice: 25000,
        description: 'Forearm-mounted retractable blades.',
        flavorText: 'The apex predator\'s choice.',
      },
    }),

    // ARMOR - Common
    prisma.item.upsert({
      where: { itemName: 'Leather Jacket' },
      update: {},
      create: {
        itemName: 'Leather Jacket',
        itemType: 'armor',
        tier: 'common',
        defenseBonus: 3,
        purchasePrice: 500,
        sellPrice: 250,
        description: 'Basic protection. Looks cool.',
        flavorText: 'Street fashion meets minimal safety.',
      },
    }),
    prisma.item.upsert({
      where: { itemName: 'Padded Vest' },
      update: {},
      create: {
        itemName: 'Padded Vest',
        itemType: 'armor',
        tier: 'common',
        defenseBonus: 4,
        purchasePrice: 750,
        sellPrice: 375,
        description: 'Layered fabric reduces impact.',
        flavorText: 'Won\'t stop a bullet, but helps with bats.',
      },
    }),
    // ARMOR - Uncommon
    prisma.item.upsert({
      where: { itemName: 'Kevlar Vest' },
      update: {},
      create: {
        itemName: 'Kevlar Vest',
        itemType: 'armor',
        tier: 'uncommon',
        defenseBonus: 8,
        purchasePrice: 3000,
        sellPrice: 1500,
        description: 'Ballistic fiber protection.',
        flavorText: 'Standard police issue. Liberated.',
      },
    }),
    // ARMOR - Rare
    prisma.item.upsert({
      where: { itemName: 'Neural Hacker' },
      update: {},
      create: {
        itemName: 'Neural Hacker',
        itemType: 'armor',
        tier: 'rare',
        defenseBonus: 10,
        purchasePrice: 8000,
        sellPrice: 4000,
        description: 'Scrambles targeting systems.',
        flavorText: 'Dead Circuit tech. Makes you hard to hit.',
      },
    }),
    // ARMOR - Legendary
    prisma.item.upsert({
      where: { itemName: 'Subdermal Armor' },
      update: {},
      create: {
        itemName: 'Subdermal Armor',
        itemType: 'armor',
        tier: 'legendary',
        defenseBonus: 15,
        purchasePrice: 50000,
        sellPrice: 25000,
        description: 'Carbon nanotube mesh under the skin.',
        flavorText: 'Walking around in a tank.',
      },
    }),

    // BUSINESSES - Common
    prisma.item.upsert({
      where: { itemName: 'Food Cart' },
      update: {},
      create: {
        itemName: 'Food Cart',
        itemType: 'business',
        tier: 'common',
        revenueMin: 100,
        revenueMax: 300,
        purchasePrice: 1000,
        sellPrice: 500,
        description: 'Street food operation.',
        flavorText: 'The noodles are a front.',
      },
    }),
    // BUSINESSES - Uncommon
    prisma.item.upsert({
      where: { itemName: 'Pawn Shop' },
      update: {},
      create: {
        itemName: 'Pawn Shop',
        itemType: 'business',
        tier: 'uncommon',
        revenueMin: 300,
        revenueMax: 700,
        purchasePrice: 5000,
        sellPrice: 2500,
        description: 'Buy low, sell high. No questions.',
        flavorText: 'Everything has a price tag.',
      },
    }),
    // BUSINESSES - Rare
    prisma.item.upsert({
      where: { itemName: 'Neon Nightclub' },
      update: {},
      create: {
        itemName: 'Neon Nightclub',
        itemType: 'business',
        tier: 'rare',
        revenueMin: 1000,
        revenueMax: 2000,
        purchasePrice: 15000,
        sellPrice: 7500,
        description: 'Dancing, drinking, dealing.',
        flavorText: 'The real business happens in the back.',
      },
    }),
    // BUSINESSES - Legendary
    prisma.item.upsert({
      where: { itemName: 'Underground Casino' },
      update: {},
      create: {
        itemName: 'Underground Casino',
        itemType: 'business',
        tier: 'legendary',
        revenueMin: 3000,
        revenueMax: 6000,
        purchasePrice: 75000,
        sellPrice: 37500,
        description: 'High stakes. Higher profits.',
        flavorText: 'The house always wins.',
      },
    }),

    // HOUSING - Common
    prisma.item.upsert({
      where: { itemName: 'Coffin Motel' },
      update: {},
      create: {
        itemName: 'Coffin Motel',
        itemType: 'housing',
        tier: 'common',
        insurancePercent: 10,
        purchasePrice: 500,
        sellPrice: 250,
        description: 'A pod. A bed. Privacy optional.',
        flavorText: 'Better than the streets.',
      },
    }),
    // HOUSING - Uncommon
    prisma.item.upsert({
      where: { itemName: 'Studio Apartment' },
      update: {},
      create: {
        itemName: 'Studio Apartment',
        itemType: 'housing',
        tier: 'uncommon',
        insurancePercent: 20,
        purchasePrice: 3000,
        sellPrice: 1500,
        description: 'Four walls and a lock.',
        flavorText: 'Living the dream. Sort of.',
      },
    }),
    // HOUSING - Rare
    prisma.item.upsert({
      where: { itemName: 'Downtown Loft' },
      update: {},
      create: {
        itemName: 'Downtown Loft',
        itemType: 'housing',
        tier: 'rare',
        insurancePercent: 35,
        purchasePrice: 12000,
        sellPrice: 6000,
        description: 'Open floor plan. Security system.',
        flavorText: 'Views of the chrome spires.',
      },
    }),
    // HOUSING - Legendary
    prisma.item.upsert({
      where: { itemName: 'Penthouse Suite' },
      update: {},
      create: {
        itemName: 'Penthouse Suite',
        itemType: 'housing',
        tier: 'legendary',
        insurancePercent: 50,
        purchasePrice: 100000,
        sellPrice: 50000,
        description: 'The top floor. The top of the world.',
        flavorText: 'Kings live here.',
      },
    }),
  ])

  console.log(`Created ${items.length} items`)

  // ==========================================================================
  // SEED CRATE TITLES
  // ==========================================================================
  console.log('Seeding crate titles...')

  const crateTitles = await Promise.all([
    // Common titles (10)
    prisma.crateTitle.upsert({ where: { titleName: 'Street Rat' }, update: {}, create: { titleName: 'Street Rat', crateTier: 'common', duplicateValue: 500 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Rookie' }, update: {}, create: { titleName: 'Rookie', crateTier: 'common', duplicateValue: 500 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Nobody' }, update: {}, create: { titleName: 'Nobody', crateTier: 'common', duplicateValue: 500 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Wannabe' }, update: {}, create: { titleName: 'Wannabe', crateTier: 'common', duplicateValue: 500 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Fresh Meat' }, update: {}, create: { titleName: 'Fresh Meat', crateTier: 'common', duplicateValue: 500 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Small Timer' }, update: {}, create: { titleName: 'Small Timer', crateTier: 'common', duplicateValue: 500 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Bottom Feeder' }, update: {}, create: { titleName: 'Bottom Feeder', crateTier: 'common', duplicateValue: 500 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Low Life' }, update: {}, create: { titleName: 'Low Life', crateTier: 'common', duplicateValue: 500 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Gutter Runner' }, update: {}, create: { titleName: 'Gutter Runner', crateTier: 'common', duplicateValue: 500 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Petty Criminal' }, update: {}, create: { titleName: 'Petty Criminal', crateTier: 'common', duplicateValue: 500 } }),

    // Uncommon titles (10)
    prisma.crateTitle.upsert({ where: { titleName: 'Street Hustler' }, update: {}, create: { titleName: 'Street Hustler', crateTier: 'uncommon', duplicateValue: 1500 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Up-and-Comer' }, update: {}, create: { titleName: 'Up-and-Comer', crateTier: 'uncommon', duplicateValue: 1500 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Made Player' }, update: {}, create: { titleName: 'Made Player', crateTier: 'uncommon', duplicateValue: 1500 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Corner Boss' }, update: {}, create: { titleName: 'Corner Boss', crateTier: 'uncommon', duplicateValue: 1500 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Enforcer' }, update: {}, create: { titleName: 'Enforcer', crateTier: 'uncommon', duplicateValue: 1500 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Collector' }, update: {}, create: { titleName: 'Collector', crateTier: 'uncommon', duplicateValue: 1500 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Operator' }, update: {}, create: { titleName: 'Operator', crateTier: 'uncommon', duplicateValue: 1500 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Runner' }, update: {}, create: { titleName: 'Runner', crateTier: 'uncommon', duplicateValue: 1500 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Fixer' }, update: {}, create: { titleName: 'Fixer', crateTier: 'uncommon', duplicateValue: 1500 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Ghost' }, update: {}, create: { titleName: 'Ghost', crateTier: 'uncommon', duplicateValue: 1500 } }),

    // Rare titles (10)
    prisma.crateTitle.upsert({ where: { titleName: 'Crime Lord' }, update: {}, create: { titleName: 'Crime Lord', crateTier: 'rare', duplicateValue: 5000 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Syndicate Boss' }, update: {}, create: { titleName: 'Syndicate Boss', crateTier: 'rare', duplicateValue: 5000 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Shadow Broker' }, update: {}, create: { titleName: 'Shadow Broker', crateTier: 'rare', duplicateValue: 5000 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Master Thief' }, update: {}, create: { titleName: 'Master Thief', crateTier: 'rare', duplicateValue: 5000 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Cyber Phantom' }, update: {}, create: { titleName: 'Cyber Phantom', crateTier: 'rare', duplicateValue: 5000 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Neon Demon' }, update: {}, create: { titleName: 'Neon Demon', crateTier: 'rare', duplicateValue: 5000 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Data Pirate' }, update: {}, create: { titleName: 'Data Pirate', crateTier: 'rare', duplicateValue: 5000 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Chrome Wolf' }, update: {}, create: { titleName: 'Chrome Wolf', crateTier: 'rare', duplicateValue: 5000 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Night City Legend' }, update: {}, create: { titleName: 'Night City Legend', crateTier: 'rare', duplicateValue: 5000 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Apex Predator' }, update: {}, create: { titleName: 'Apex Predator', crateTier: 'rare', duplicateValue: 5000 } }),

    // Legendary titles (10)
    prisma.crateTitle.upsert({ where: { titleName: 'The One Who Knocks' }, update: {}, create: { titleName: 'The One Who Knocks', crateTier: 'legendary', duplicateValue: 15000 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Ghost of Lazarus' }, update: {}, create: { titleName: 'Ghost of Lazarus', crateTier: 'legendary', duplicateValue: 15000 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Neon God' }, update: {}, create: { titleName: 'Neon God', crateTier: 'legendary', duplicateValue: 15000 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Chrome Emperor' }, update: {}, create: { titleName: 'Chrome Emperor', crateTier: 'legendary', duplicateValue: 15000 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Digital Overlord' }, update: {}, create: { titleName: 'Digital Overlord', crateTier: 'legendary', duplicateValue: 15000 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Lazarus Risen' }, update: {}, create: { titleName: 'Lazarus Risen', crateTier: 'legendary', duplicateValue: 15000 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Night City Nightmare' }, update: {}, create: { titleName: 'Night City Nightmare', crateTier: 'legendary', duplicateValue: 15000 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'The Untouchable' }, update: {}, create: { titleName: 'The Untouchable', crateTier: 'legendary', duplicateValue: 15000 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'Architect of Chaos' }, update: {}, create: { titleName: 'Architect of Chaos', crateTier: 'legendary', duplicateValue: 15000 } }),
    prisma.crateTitle.upsert({ where: { titleName: 'The Final Boss' }, update: {}, create: { titleName: 'The Final Boss', crateTier: 'legendary', duplicateValue: 15000 } }),
  ])

  console.log(`Created ${crateTitles.length} crate titles`)

  // ==========================================================================
  // SEED REWARD CONFIG
  // ==========================================================================
  console.log('Seeding reward config...')

  const rewardConfigs = await Promise.all([
    // Kick rewards
    prisma.rewardConfig.upsert({
      where: { platform_eventType: { platform: 'kick', eventType: 'subscription' } },
      update: { wealthPerUnit: 500, xpPerUnit: 100, tierMultiplier: { "1": 1.0, "2": 1.5, "3": 2.0 } },
      create: { platform: 'kick', eventType: 'subscription', wealthPerUnit: 500, xpPerUnit: 100, tierMultiplier: { "1": 1.0, "2": 1.5, "3": 2.0 }, description: 'Per subscription (tier multiplied)' },
    }),
    prisma.rewardConfig.upsert({
      where: { platform_eventType: { platform: 'kick', eventType: 'gift_sub' } },
      update: { wealthPerUnit: 500, xpPerUnit: 100 },
      create: { platform: 'kick', eventType: 'gift_sub', wealthPerUnit: 500, xpPerUnit: 100, description: 'Per gifted sub' },
    }),
    prisma.rewardConfig.upsert({
      where: { platform_eventType: { platform: 'kick', eventType: 'kick' } },
      update: { wealthPerUnit: 1, xpPerUnit: 0 },
      create: { platform: 'kick', eventType: 'kick', wealthPerUnit: 1, xpPerUnit: 0, description: 'Per Kick (currency)' },
    }),
    // Twitch rewards
    prisma.rewardConfig.upsert({
      where: { platform_eventType: { platform: 'twitch', eventType: 'subscription' } },
      update: { wealthPerUnit: 500, xpPerUnit: 100, tierMultiplier: { "1": 1.0, "2": 1.5, "3": 2.0 } },
      create: { platform: 'twitch', eventType: 'subscription', wealthPerUnit: 500, xpPerUnit: 100, tierMultiplier: { "1": 1.0, "2": 1.5, "3": 2.0 }, description: 'Per subscription (tier multiplied)' },
    }),
    prisma.rewardConfig.upsert({
      where: { platform_eventType: { platform: 'twitch', eventType: 'gift_sub' } },
      update: { wealthPerUnit: 500, xpPerUnit: 100 },
      create: { platform: 'twitch', eventType: 'gift_sub', wealthPerUnit: 500, xpPerUnit: 100, description: 'Per gifted sub' },
    }),
    prisma.rewardConfig.upsert({
      where: { platform_eventType: { platform: 'twitch', eventType: 'bits' } },
      update: { wealthPerUnit: 1, xpPerUnit: 0 },
      create: { platform: 'twitch', eventType: 'bits', wealthPerUnit: 1, xpPerUnit: 0, description: 'Per bit ($100 per 100 bits)' },
    }),
    prisma.rewardConfig.upsert({
      where: { platform_eventType: { platform: 'twitch', eventType: 'raid' } },
      update: { wealthPerUnit: 10, xpPerUnit: 2 },
      create: { platform: 'twitch', eventType: 'raid', wealthPerUnit: 10, xpPerUnit: 2, description: 'Per viewer in raid' },
    }),
    // Stripe/direct donations
    prisma.rewardConfig.upsert({
      where: { platform_eventType: { platform: 'stripe', eventType: 'donation' } },
      update: { wealthPerUnit: 100, xpPerUnit: 0 },
      create: { platform: 'stripe', eventType: 'donation', wealthPerUnit: 100, xpPerUnit: 0, description: 'Per dollar donated' },
    }),
  ])

  console.log(`Created ${rewardConfigs.length} reward configs`)

  // ==========================================================================
  // SEED HEIST TRIVIA
  // ==========================================================================
  console.log('Seeding heist trivia pool...')

  const triviaQuestions = await Promise.all([
    // Game Mechanics (20)
    prisma.heistTriviaPool.upsert({
      where: { id: 1 },
      update: {},
      create: { category: 'game', question: 'What tier do you need to reach to join a faction?', answer: 'Associate' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 2 },
      update: {},
      create: { category: 'game', question: 'How many territories are in Lazarus City?', answer: '12' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 3 },
      update: {},
      create: { category: 'game', question: 'What is the name of the Russian faction?', answer: 'Volkov Bratva' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 4 },
      update: {},
      create: { category: 'game', question: 'How long is the jail sentence when you get busted?', answer: '1 hour' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 5 },
      update: {},
      create: { category: 'game', question: 'What percentage of wealth does bail cost?', answer: '10' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 6 },
      update: {},
      create: { category: 'game', question: 'What buff does the Juicernaut get for crate drops?', answer: '3x' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 7 },
      update: {},
      create: { category: 'game', question: 'Which territory is Dead Circuit\'s home base?', answer: 'The Hollows' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 8 },
      update: {},
      create: { category: 'game', question: 'What is the maximum check-in streak bonus crate tier?', answer: 'Legendary' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 9 },
      update: {},
      create: { category: 'game', question: 'How many daily missions do you get?', answer: '3' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 10 },
      update: {},
      create: { category: 'game', question: 'What is the rob cooldown per target?', answer: '24 hours' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 11 },
      update: {},
      create: { category: 'game', question: 'How many weekly missions do you get?', answer: '2' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 12 },
      update: {},
      create: { category: 'game', question: 'What level unlocks the Associate tier?', answer: '20' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 13 },
      update: {},
      create: { category: 'game', question: 'What level unlocks the Kingpin tier?', answer: '100' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 14 },
      update: {},
      create: { category: 'game', question: 'What is the base rob success rate?', answer: '60' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 15 },
      update: {},
      create: { category: 'game', question: 'How many hours is the Black Market rotation?', answer: '6' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 16 },
      update: {},
      create: { category: 'game', question: 'What percentage chance to steal an equipped item during robbery?', answer: '5' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 17 },
      update: {},
      create: { category: 'game', question: 'How many crates can you hold in inventory?', answer: '10' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 18 },
      update: {},
      create: { category: 'game', question: 'How many crates can be in escrow?', answer: '3' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 19 },
      update: {},
      create: { category: 'game', question: 'What is the bust chance when using !play?', answer: '5' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 20 },
      update: {},
      create: { category: 'game', question: 'How many days cooldown after leaving a faction?', answer: '7' },
    }),
    // Factions & Territories (15)
    prisma.heistTriviaPool.upsert({
      where: { id: 21 },
      update: {},
      create: { category: 'faction', question: 'Which faction started as hackers and smugglers?', answer: 'Dead Circuit' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 22 },
      update: {},
      create: { category: 'faction', question: 'What is the Kessler Group\'s motto?', answer: 'Payment on delivery' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 23 },
      update: {},
      create: { category: 'faction', question: 'Which territory is known as the entertainment district?', answer: 'Neon Mile' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 24 },
      update: {},
      create: { category: 'faction', question: 'Which territory gives an XP buff and is bombed-out?', answer: 'Ashfall' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 25 },
      update: {},
      create: { category: 'faction', question: 'Which territory is described as lawless with no rules?', answer: 'Deadzone' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 26 },
      update: {},
      create: { category: 'faction', question: 'Which territory is neutral ground?', answer: 'Freeport' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 27 },
      update: {},
      create: { category: 'faction', question: 'Which territory is the Volkov Bratva\'s home base?', answer: 'The Ports' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 28 },
      update: {},
      create: { category: 'faction', question: 'Which territory is the Kessler Group\'s home base?', answer: 'Midtown' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 29 },
      update: {},
      create: { category: 'faction', question: 'Which territory has data centers and hacker dens?', answer: 'Silicon Sprawl' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 30 },
      update: {},
      create: { category: 'faction', question: 'Which territory is described as elite towers for the wealthy?', answer: 'Chrome Heights' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 31 },
      update: {},
      create: { category: 'faction', question: 'What is the Volkov Bratva\'s color?', answer: 'Red' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 32 },
      update: {},
      create: { category: 'faction', question: 'What is Dead Circuit\'s color?', answer: 'Cyan' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 33 },
      update: {},
      create: { category: 'faction', question: 'How many contested territories are there?', answer: '3' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 34 },
      update: {},
      create: { category: 'faction', question: 'Which territory has crumbling monuments?', answer: 'Memorial District' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 35 },
      update: {},
      create: { category: 'faction', question: 'Which territory has toxic air and desperate workers?', answer: 'Rustlands' },
    }),
    // Items & Equipment (10)
    prisma.heistTriviaPool.upsert({
      where: { id: 36 },
      update: {},
      create: { category: 'items', question: 'What is the legendary weapon with forearm-mounted blades?', answer: 'Mantis Blades' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 37 },
      update: {},
      create: { category: 'items', question: 'What legendary armor is implanted under the skin?', answer: 'Subdermal Armor' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 38 },
      update: {},
      create: { category: 'items', question: 'What is the legendary business with high stakes?', answer: 'Underground Casino' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 39 },
      update: {},
      create: { category: 'items', question: 'What is the cheapest housing option?', answer: 'Coffin Motel' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 40 },
      update: {},
      create: { category: 'items', question: 'What weapon is described as a Volkov assassination tool?', answer: 'Mono-Wire Garrote' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 41 },
      update: {},
      create: { category: 'items', question: 'How many item slots can a player equip?', answer: '4' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 42 },
      update: {},
      create: { category: 'items', question: 'What percentage of purchase price do you get when selling items?', answer: '50' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 43 },
      update: {},
      create: { category: 'items', question: 'What is the maximum inventory size for items?', answer: '10' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 44 },
      update: {},
      create: { category: 'items', question: 'How much durability does the attacker\'s weapon lose in robbery?', answer: '3' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 45 },
      update: {},
      create: { category: 'items', question: 'How much durability does the defender\'s armor lose in robbery?', answer: '2' },
    }),
    // Juicernaut & Monetization (5)
    prisma.heistTriviaPool.upsert({
      where: { id: 46 },
      update: {},
      create: { category: 'juicernaut', question: 'What XP multiplier does the Juicernaut get?', answer: '2x' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 47 },
      update: {},
      create: { category: 'juicernaut', question: 'Can the Juicernaut be robbed?', answer: 'No' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 48 },
      update: {},
      create: { category: 'juicernaut', question: 'What wealth multiplier does the Juicernaut get from play?', answer: '1.25x' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 49 },
      update: {},
      create: { category: 'juicernaut', question: 'What business revenue bonus does the Juicernaut get?', answer: '50' },
    }),
    prisma.heistTriviaPool.upsert({
      where: { id: 50 },
      update: {},
      create: { category: 'juicernaut', question: 'How many Juicernaut buffs are there in total?', answer: '5' },
    }),
  ])

  console.log(`Created ${triviaQuestions.length} trivia questions`)

  // ==========================================================================
  // SEED MISSION TEMPLATES
  // ==========================================================================
  console.log('Seeding mission templates...')

  const missionTemplates = await Promise.all([
    // Daily Missions - Chat
    prisma.missionTemplate.upsert({
      where: { id: 'D-CHAT-01' },
      update: {},
      create: {
        id: 'D-CHAT-01',
        missionType: 'daily',
        category: 'chat',
        difficulty: 'easy',
        name: 'Word on the Street',
        description: 'Send messages in chat to spread your reputation.',
        objectiveType: 'messages_sent',
        objectiveBaseValue: 15,
        rewardWealth: 500,
        rewardXp: 50,
      },
    }),
    prisma.missionTemplate.upsert({
      where: { id: 'D-CHAT-02' },
      update: {},
      create: {
        id: 'D-CHAT-02',
        missionType: 'daily',
        category: 'chat',
        difficulty: 'medium',
        name: 'Chatty',
        description: 'Keep the conversation flowing in chat.',
        objectiveType: 'messages_sent',
        objectiveBaseValue: 30,
        rewardWealth: 1000,
        rewardXp: 100,
      },
    }),
    prisma.missionTemplate.upsert({
      where: { id: 'D-CHAT-03' },
      update: {},
      create: {
        id: 'D-CHAT-03',
        missionType: 'daily',
        category: 'chat',
        difficulty: 'hard',
        name: 'Motormouth',
        description: 'Dominate the chat with your presence.',
        objectiveType: 'messages_sent',
        objectiveBaseValue: 50,
        rewardWealth: 2000,
        rewardXp: 200,
      },
    }),
    // Daily Missions - Economy
    prisma.missionTemplate.upsert({
      where: { id: 'D-ECON-01' },
      update: {},
      create: {
        id: 'D-ECON-01',
        missionType: 'daily',
        category: 'economy',
        difficulty: 'easy',
        name: 'Hustle',
        description: 'Get out there and make some moves.',
        objectiveType: 'play_count',
        objectiveBaseValue: 5,
        rewardWealth: 500,
        rewardXp: 50,
      },
    }),
    prisma.missionTemplate.upsert({
      where: { id: 'D-ECON-02' },
      update: {},
      create: {
        id: 'D-ECON-02',
        missionType: 'daily',
        category: 'economy',
        difficulty: 'medium',
        name: 'Grinder',
        description: 'Put in the work. Stack that paper.',
        objectiveType: 'play_count',
        objectiveBaseValue: 15,
        rewardWealth: 1000,
        rewardXp: 100,
      },
    }),
    prisma.missionTemplate.upsert({
      where: { id: 'D-ECON-03' },
      update: {},
      create: {
        id: 'D-ECON-03',
        missionType: 'daily',
        category: 'economy',
        difficulty: 'hard',
        name: 'No Rest',
        description: 'Sleep is for the weak. Keep hustling.',
        objectiveType: 'play_count',
        objectiveBaseValue: 25,
        rewardWealth: 2000,
        rewardXp: 200,
      },
    }),
    // Daily Missions - Combat
    prisma.missionTemplate.upsert({
      where: { id: 'D-COMB-01' },
      update: {},
      create: {
        id: 'D-COMB-01',
        missionType: 'daily',
        category: 'combat',
        difficulty: 'easy',
        name: 'Opportunist',
        description: 'Take what you can from others.',
        objectiveType: 'rob_attempts',
        objectiveBaseValue: 1,
        rewardWealth: 500,
        rewardXp: 50,
      },
    }),
    prisma.missionTemplate.upsert({
      where: { id: 'D-COMB-02' },
      update: {},
      create: {
        id: 'D-COMB-02',
        missionType: 'daily',
        category: 'combat',
        difficulty: 'medium',
        name: 'Aggressive',
        description: 'Make your presence known on the streets.',
        objectiveType: 'rob_attempts',
        objectiveBaseValue: 3,
        rewardWealth: 1000,
        rewardXp: 100,
      },
    }),
    prisma.missionTemplate.upsert({
      where: { id: 'D-COMB-03' },
      update: {},
      create: {
        id: 'D-COMB-03',
        missionType: 'daily',
        category: 'combat',
        difficulty: 'hard',
        name: 'Relentless',
        description: 'Successfully take down multiple targets.',
        objectiveType: 'rob_successes',
        objectiveBaseValue: 3,
        isLuckBased: true,
        rewardWealth: 2000,
        rewardXp: 200,
      },
    }),
    // Daily Missions - Loyalty
    prisma.missionTemplate.upsert({
      where: { id: 'D-LOYA-01' },
      update: {},
      create: {
        id: 'D-LOYA-01',
        missionType: 'daily',
        category: 'loyalty',
        difficulty: 'easy',
        name: 'Present',
        description: 'Check in to show your dedication.',
        objectiveType: 'checkin_today',
        objectiveBaseValue: 1,
        rewardWealth: 500,
        rewardXp: 50,
      },
    }),
    // Daily Missions - Exploration
    prisma.missionTemplate.upsert({
      where: { id: 'D-EXPL-01' },
      update: {},
      create: {
        id: 'D-EXPL-01',
        missionType: 'daily',
        category: 'exploration',
        difficulty: 'easy',
        name: 'Self-Reflection',
        description: 'Check your profile and stats.',
        objectiveType: 'profile_viewed',
        objectiveBaseValue: 1,
        rewardWealth: 500,
        rewardXp: 50,
      },
    }),
    prisma.missionTemplate.upsert({
      where: { id: 'D-EXPL-02' },
      update: {},
      create: {
        id: 'D-EXPL-02',
        missionType: 'daily',
        category: 'exploration',
        difficulty: 'easy',
        name: 'Scout',
        description: 'Check out the competition on the leaderboard.',
        objectiveType: 'leaderboard_viewed',
        objectiveBaseValue: 1,
        rewardWealth: 500,
        rewardXp: 50,
      },
    }),
    prisma.missionTemplate.upsert({
      where: { id: 'D-EXPL-03' },
      update: {},
      create: {
        id: 'D-EXPL-03',
        missionType: 'daily',
        category: 'exploration',
        difficulty: 'easy',
        name: 'Window Shopping',
        description: 'Browse the Black Market for deals.',
        objectiveType: 'black_market_viewed',
        objectiveBaseValue: 1,
        rewardWealth: 500,
        rewardXp: 50,
      },
    }),

    // Weekly Missions - Chat
    prisma.missionTemplate.upsert({
      where: { id: 'W-CHAT-01' },
      update: {},
      create: {
        id: 'W-CHAT-01',
        missionType: 'weekly',
        category: 'chat',
        difficulty: 'easy',
        name: 'Regular',
        description: 'Be a consistent presence in chat this week.',
        objectiveType: 'messages_sent',
        objectiveBaseValue: 100,
        rewardWealth: 3000,
        rewardXp: 300,
      },
    }),
    prisma.missionTemplate.upsert({
      where: { id: 'W-CHAT-02' },
      update: {},
      create: {
        id: 'W-CHAT-02',
        missionType: 'weekly',
        category: 'chat',
        difficulty: 'medium',
        name: 'Active',
        description: 'Make your voice heard throughout the week.',
        objectiveType: 'messages_sent',
        objectiveBaseValue: 200,
        rewardWealth: 6000,
        rewardXp: 600,
      },
    }),
    prisma.missionTemplate.upsert({
      where: { id: 'W-CHAT-03' },
      update: {},
      create: {
        id: 'W-CHAT-03',
        missionType: 'weekly',
        category: 'chat',
        difficulty: 'hard',
        name: 'Voice of Lazarus',
        description: 'Become a legend in the chat this week.',
        objectiveType: 'messages_sent',
        objectiveBaseValue: 400,
        rewardWealth: 12000,
        rewardXp: 1200,
      },
    }),
    // Weekly Missions - Economy
    prisma.missionTemplate.upsert({
      where: { id: 'W-ECON-01' },
      update: {},
      create: {
        id: 'W-ECON-01',
        missionType: 'weekly',
        category: 'economy',
        difficulty: 'easy',
        name: 'Worker',
        description: 'Put in consistent work throughout the week.',
        objectiveType: 'play_count',
        objectiveBaseValue: 25,
        rewardWealth: 3000,
        rewardXp: 300,
      },
    }),
    prisma.missionTemplate.upsert({
      where: { id: 'W-ECON-02' },
      update: {},
      create: {
        id: 'W-ECON-02',
        missionType: 'weekly',
        category: 'economy',
        difficulty: 'medium',
        name: 'Dedicated',
        description: 'Show your commitment to the grind.',
        objectiveType: 'play_count',
        objectiveBaseValue: 50,
        rewardWealth: 6000,
        rewardXp: 600,
      },
    }),
    // Weekly Missions - Combat
    prisma.missionTemplate.upsert({
      where: { id: 'W-COMB-01' },
      update: {},
      create: {
        id: 'W-COMB-01',
        missionType: 'weekly',
        category: 'combat',
        difficulty: 'easy',
        name: 'Hunter',
        description: 'Seek out targets throughout the week.',
        objectiveType: 'rob_attempts',
        objectiveBaseValue: 5,
        rewardWealth: 3000,
        rewardXp: 300,
      },
    }),
    prisma.missionTemplate.upsert({
      where: { id: 'W-COMB-02' },
      update: {},
      create: {
        id: 'W-COMB-02',
        missionType: 'weekly',
        category: 'combat',
        difficulty: 'medium',
        name: 'Predator',
        description: 'Successfully hunt down your prey.',
        objectiveType: 'rob_successes',
        objectiveBaseValue: 5,
        isLuckBased: true,
        rewardWealth: 6000,
        rewardXp: 600,
      },
    }),
    // Weekly Missions - Loyalty
    prisma.missionTemplate.upsert({
      where: { id: 'W-LOYA-01' },
      update: {},
      create: {
        id: 'W-LOYA-01',
        missionType: 'weekly',
        category: 'loyalty',
        difficulty: 'hard',
        name: 'Devoted',
        description: 'Check in every single day this week.',
        objectiveType: 'checkin_week',
        objectiveBaseValue: 7,
        rewardWealth: 12000,
        rewardXp: 1200,
      },
    }),
  ])

  console.log(`Created ${missionTemplates.length} mission templates`)

  // ==========================================================================
  // SEED ACHIEVEMENTS
  // ==========================================================================
  console.log('Seeding achievements...')

  const achievements = await Promise.all([
    // WEALTH ACHIEVEMENTS
    prisma.achievement.upsert({
      where: { achievementKey: 'wealth_first_score' },
      update: {},
      create: {
        achievementName: 'First Score',
        achievementKey: 'wealth_first_score',
        description: 'Earn $1,000 total wealth.',
        category: 'wealth',
        tier: 'bronze',
        requirementType: 'total_wealth_earned',
        requirementValue: 1000,
        rewardWealth: 500,
        rewardXp: 50,
        displayOrder: 1,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'wealth_getting_started' },
      update: {},
      create: {
        achievementName: 'Getting Started',
        achievementKey: 'wealth_getting_started',
        description: 'Earn $10,000 total wealth.',
        category: 'wealth',
        tier: 'bronze',
        requirementType: 'total_wealth_earned',
        requirementValue: 10000,
        rewardWealth: 1000,
        rewardXp: 100,
        displayOrder: 2,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'wealth_money_maker' },
      update: {},
      create: {
        achievementName: 'Money Maker',
        achievementKey: 'wealth_money_maker',
        description: 'Earn $100,000 total wealth.',
        category: 'wealth',
        tier: 'silver',
        requirementType: 'total_wealth_earned',
        requirementValue: 100000,
        rewardWealth: 5000,
        rewardXp: 300,
        displayOrder: 3,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'wealth_six_figures' },
      update: {},
      create: {
        achievementName: 'Six Figures',
        achievementKey: 'wealth_six_figures',
        description: 'Earn $500,000 total wealth.',
        category: 'wealth',
        tier: 'silver',
        requirementType: 'total_wealth_earned',
        requirementValue: 500000,
        rewardWealth: 10000,
        rewardXp: 500,
        displayOrder: 4,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'wealth_millionaire' },
      update: {},
      create: {
        achievementName: 'Millionaire',
        achievementKey: 'wealth_millionaire',
        description: 'Earn $1,000,000 total wealth.',
        category: 'wealth',
        tier: 'gold',
        requirementType: 'total_wealth_earned',
        requirementValue: 1000000,
        rewardWealth: 25000,
        rewardXp: 1000,
        displayOrder: 5,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'wealth_multi_millionaire' },
      update: {},
      create: {
        achievementName: 'Multi-Millionaire',
        achievementKey: 'wealth_multi_millionaire',
        description: 'Earn $5,000,000 total wealth.',
        category: 'wealth',
        tier: 'gold',
        requirementType: 'total_wealth_earned',
        requirementValue: 5000000,
        rewardWealth: 50000,
        rewardXp: 2000,
        displayOrder: 6,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'wealth_tycoon' },
      update: {},
      create: {
        achievementName: 'Tycoon',
        achievementKey: 'wealth_tycoon',
        description: 'Earn $10,000,000 total wealth.',
        category: 'wealth',
        tier: 'platinum',
        requirementType: 'total_wealth_earned',
        requirementValue: 10000000,
        rewardWealth: 100000,
        rewardXp: 5000,
        rewardTitle: 'Tycoon',
        displayOrder: 7,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'wealth_lazarus_legend' },
      update: {},
      create: {
        achievementName: 'Lazarus Legend',
        achievementKey: 'wealth_lazarus_legend',
        description: 'Earn $50,000,000 total wealth.',
        category: 'wealth',
        tier: 'legendary',
        requirementType: 'total_wealth_earned',
        requirementValue: 50000000,
        rewardWealth: 500000,
        rewardXp: 20000,
        rewardTitle: 'Lazarus Legend',
        displayOrder: 8,
      },
    }),

    // COMBAT ACHIEVEMENTS
    prisma.achievement.upsert({
      where: { achievementKey: 'combat_first_blood' },
      update: {},
      create: {
        achievementName: 'First Blood',
        achievementKey: 'combat_first_blood',
        description: 'Win your first robbery.',
        category: 'combat',
        tier: 'bronze',
        requirementType: 'rob_wins',
        requirementValue: 1,
        rewardWealth: 500,
        rewardXp: 50,
        displayOrder: 1,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'combat_street_fighter' },
      update: {},
      create: {
        achievementName: 'Street Fighter',
        achievementKey: 'combat_street_fighter',
        description: 'Win 10 robberies.',
        category: 'combat',
        tier: 'bronze',
        requirementType: 'rob_wins',
        requirementValue: 10,
        rewardWealth: 2000,
        rewardXp: 150,
        displayOrder: 2,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'combat_enforcer' },
      update: {},
      create: {
        achievementName: 'Enforcer',
        achievementKey: 'combat_enforcer',
        description: 'Win 50 robberies.',
        category: 'combat',
        tier: 'silver',
        requirementType: 'rob_wins',
        requirementValue: 50,
        rewardWealth: 10000,
        rewardXp: 500,
        displayOrder: 3,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'combat_crime_lord' },
      update: {},
      create: {
        achievementName: 'Crime Lord',
        achievementKey: 'combat_crime_lord',
        description: 'Win 100 robberies.',
        category: 'combat',
        tier: 'gold',
        requirementType: 'rob_wins',
        requirementValue: 100,
        rewardWealth: 25000,
        rewardXp: 1000,
        displayOrder: 4,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'combat_master_thief' },
      update: {},
      create: {
        achievementName: 'Master Thief',
        achievementKey: 'combat_master_thief',
        description: 'Win 500 robberies.',
        category: 'combat',
        tier: 'platinum',
        requirementType: 'rob_wins',
        requirementValue: 500,
        rewardWealth: 100000,
        rewardXp: 5000,
        rewardTitle: 'Master Thief',
        displayOrder: 5,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'combat_untouchable' },
      update: {},
      create: {
        achievementName: 'Untouchable',
        achievementKey: 'combat_untouchable',
        description: 'Successfully defend against 50 robbery attempts.',
        category: 'combat',
        tier: 'gold',
        requirementType: 'rob_defenses',
        requirementValue: 50,
        rewardWealth: 25000,
        rewardXp: 1000,
        displayOrder: 6,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'combat_fortress' },
      update: {},
      create: {
        achievementName: 'Fortress',
        achievementKey: 'combat_fortress',
        description: 'Successfully defend against 200 robbery attempts.',
        category: 'combat',
        tier: 'platinum',
        requirementType: 'rob_defenses',
        requirementValue: 200,
        rewardWealth: 75000,
        rewardXp: 3000,
        rewardTitle: 'Fortress',
        displayOrder: 7,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'combat_win_streak_5' },
      update: {},
      create: {
        achievementName: 'Win Streak 5',
        achievementKey: 'combat_win_streak_5',
        description: 'Win 5 robberies in a row.',
        category: 'combat',
        tier: 'silver',
        requirementType: 'rob_win_streak',
        requirementValue: 5,
        rewardWealth: 5000,
        rewardXp: 300,
        displayOrder: 8,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'combat_win_streak_10' },
      update: {},
      create: {
        achievementName: 'Win Streak 10',
        achievementKey: 'combat_win_streak_10',
        description: 'Win 10 robberies in a row.',
        category: 'combat',
        tier: 'gold',
        requirementType: 'rob_win_streak',
        requirementValue: 10,
        rewardWealth: 20000,
        rewardXp: 1000,
        displayOrder: 9,
      },
    }),

    // LOYALTY ACHIEVEMENTS
    prisma.achievement.upsert({
      where: { achievementKey: 'loyalty_regular' },
      update: {},
      create: {
        achievementName: 'Regular',
        achievementKey: 'loyalty_regular',
        description: 'Maintain a 7-day check-in streak.',
        category: 'loyalty',
        tier: 'bronze',
        requirementType: 'checkin_streak',
        requirementValue: 7,
        rewardWealth: 1000,
        rewardXp: 100,
        displayOrder: 1,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'loyalty_dedicated' },
      update: {},
      create: {
        achievementName: 'Dedicated',
        achievementKey: 'loyalty_dedicated',
        description: 'Maintain a 14-day check-in streak.',
        category: 'loyalty',
        tier: 'silver',
        requirementType: 'checkin_streak',
        requirementValue: 14,
        rewardWealth: 3000,
        rewardXp: 300,
        displayOrder: 2,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'loyalty_committed' },
      update: {},
      create: {
        achievementName: 'Committed',
        achievementKey: 'loyalty_committed',
        description: 'Maintain a 30-day check-in streak.',
        category: 'loyalty',
        tier: 'silver',
        requirementType: 'checkin_streak',
        requirementValue: 30,
        rewardWealth: 10000,
        rewardXp: 500,
        displayOrder: 3,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'loyalty_devoted' },
      update: {},
      create: {
        achievementName: 'Devoted',
        achievementKey: 'loyalty_devoted',
        description: 'Maintain a 60-day check-in streak.',
        category: 'loyalty',
        tier: 'gold',
        requirementType: 'checkin_streak',
        requirementValue: 60,
        rewardWealth: 25000,
        rewardXp: 1500,
        displayOrder: 4,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'loyalty_fanatic' },
      update: {},
      create: {
        achievementName: 'Fanatic',
        achievementKey: 'loyalty_fanatic',
        description: 'Maintain a 100-day check-in streak.',
        category: 'loyalty',
        tier: 'platinum',
        requirementType: 'checkin_streak',
        requirementValue: 100,
        rewardWealth: 75000,
        rewardXp: 5000,
        rewardTitle: 'Devoted',
        displayOrder: 5,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'loyalty_immortal' },
      update: {},
      create: {
        achievementName: 'Immortal',
        achievementKey: 'loyalty_immortal',
        description: 'Maintain a 365-day check-in streak.',
        category: 'loyalty',
        tier: 'legendary',
        requirementType: 'checkin_streak',
        requirementValue: 365,
        rewardWealth: 500000,
        rewardXp: 25000,
        rewardTitle: 'Immortal',
        displayOrder: 6,
      },
    }),

    // PROGRESSION ACHIEVEMENTS
    prisma.achievement.upsert({
      where: { achievementKey: 'progression_rookie_no_more' },
      update: {},
      create: {
        achievementName: 'Rookie No More',
        achievementKey: 'progression_rookie_no_more',
        description: 'Reach Level 10.',
        category: 'progression',
        tier: 'bronze',
        requirementType: 'level',
        requirementValue: 10,
        rewardWealth: 1000,
        rewardXp: 100,
        displayOrder: 1,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'progression_rising_star' },
      update: {},
      create: {
        achievementName: 'Rising Star',
        achievementKey: 'progression_rising_star',
        description: 'Reach Level 20 (Associate tier).',
        category: 'progression',
        tier: 'silver',
        requirementType: 'level',
        requirementValue: 20,
        rewardWealth: 5000,
        rewardXp: 500,
        displayOrder: 2,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'progression_soldier_up' },
      update: {},
      create: {
        achievementName: 'Soldier Up',
        achievementKey: 'progression_soldier_up',
        description: 'Reach Level 40 (Soldier tier).',
        category: 'progression',
        tier: 'silver',
        requirementType: 'level',
        requirementValue: 40,
        rewardWealth: 15000,
        rewardXp: 1000,
        displayOrder: 3,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'progression_captains_rank' },
      update: {},
      create: {
        achievementName: "Captain's Rank",
        achievementKey: 'progression_captains_rank',
        description: 'Reach Level 60 (Captain tier).',
        category: 'progression',
        tier: 'gold',
        requirementType: 'level',
        requirementValue: 60,
        rewardWealth: 30000,
        rewardXp: 2000,
        displayOrder: 4,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'progression_right_hand' },
      update: {},
      create: {
        achievementName: 'Right Hand',
        achievementKey: 'progression_right_hand',
        description: 'Reach Level 80 (Underboss tier).',
        category: 'progression',
        tier: 'gold',
        requirementType: 'level',
        requirementValue: 80,
        rewardWealth: 50000,
        rewardXp: 3000,
        displayOrder: 5,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'progression_the_kingpin' },
      update: {},
      create: {
        achievementName: 'The Kingpin',
        achievementKey: 'progression_the_kingpin',
        description: 'Reach Level 100 (Kingpin tier).',
        category: 'progression',
        tier: 'legendary',
        requirementType: 'level',
        requirementValue: 100,
        rewardWealth: 250000,
        rewardXp: 15000,
        rewardTitle: 'The Kingpin',
        displayOrder: 6,
      },
    }),

    // ACTIVITY ACHIEVEMENTS
    prisma.achievement.upsert({
      where: { achievementKey: 'activity_getting_active' },
      update: {},
      create: {
        achievementName: 'Getting Active',
        achievementKey: 'activity_getting_active',
        description: 'Use !play 50 times.',
        category: 'activity',
        tier: 'bronze',
        requirementType: 'play_count',
        requirementValue: 50,
        rewardWealth: 500,
        rewardXp: 50,
        displayOrder: 1,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'activity_busy_bee' },
      update: {},
      create: {
        achievementName: 'Busy Bee',
        achievementKey: 'activity_busy_bee',
        description: 'Use !play 250 times.',
        category: 'activity',
        tier: 'bronze',
        requirementType: 'play_count',
        requirementValue: 250,
        rewardWealth: 2000,
        rewardXp: 200,
        displayOrder: 2,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'activity_workaholic' },
      update: {},
      create: {
        achievementName: 'Workaholic',
        achievementKey: 'activity_workaholic',
        description: 'Use !play 1,000 times.',
        category: 'activity',
        tier: 'silver',
        requirementType: 'play_count',
        requirementValue: 1000,
        rewardWealth: 10000,
        rewardXp: 750,
        displayOrder: 3,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'activity_no_rest' },
      update: {},
      create: {
        achievementName: 'No Rest',
        achievementKey: 'activity_no_rest',
        description: 'Use !play 5,000 times.',
        category: 'activity',
        tier: 'gold',
        requirementType: 'play_count',
        requirementValue: 5000,
        rewardWealth: 50000,
        rewardXp: 3000,
        displayOrder: 4,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'activity_machine' },
      update: {},
      create: {
        achievementName: 'Machine',
        achievementKey: 'activity_machine',
        description: 'Use !play 10,000 times.',
        category: 'activity',
        tier: 'platinum',
        requirementType: 'play_count',
        requirementValue: 10000,
        rewardWealth: 150000,
        rewardXp: 10000,
        rewardTitle: 'Machine',
        displayOrder: 5,
      },
    }),

    // SOCIAL ACHIEVEMENTS
    prisma.achievement.upsert({
      where: { achievementKey: 'social_chatterbox' },
      update: {},
      create: {
        achievementName: 'Chatterbox',
        achievementKey: 'social_chatterbox',
        description: 'Send 1,000 messages.',
        category: 'social',
        tier: 'bronze',
        requirementType: 'messages_sent',
        requirementValue: 1000,
        rewardWealth: 1000,
        rewardXp: 100,
        displayOrder: 1,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'social_butterfly' },
      update: {},
      create: {
        achievementName: 'Social Butterfly',
        achievementKey: 'social_butterfly',
        description: 'Send 10,000 messages.',
        category: 'social',
        tier: 'silver',
        requirementType: 'messages_sent',
        requirementValue: 10000,
        rewardWealth: 5000,
        rewardXp: 500,
        displayOrder: 2,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'social_voice_of_lazarus' },
      update: {},
      create: {
        achievementName: 'Voice of Lazarus',
        achievementKey: 'social_voice_of_lazarus',
        description: 'Send 50,000 messages.',
        category: 'social',
        tier: 'gold',
        requirementType: 'messages_sent',
        requirementValue: 50000,
        rewardWealth: 25000,
        rewardXp: 2000,
        displayOrder: 3,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'social_legend' },
      update: {},
      create: {
        achievementName: 'Legend',
        achievementKey: 'social_legend',
        description: 'Send 100,000 messages.',
        category: 'social',
        tier: 'platinum',
        requirementType: 'messages_sent',
        requirementValue: 100000,
        rewardWealth: 100000,
        rewardXp: 10000,
        rewardTitle: 'Legend',
        displayOrder: 4,
      },
    }),

    // SPECIAL/HIDDEN ACHIEVEMENTS
    prisma.achievement.upsert({
      where: { achievementKey: 'special_jailbird' },
      update: {},
      create: {
        achievementName: 'Jailbird',
        achievementKey: 'special_jailbird',
        description: 'Get busted 10 times.',
        category: 'special',
        tier: 'bronze',
        requirementType: 'bust_count',
        requirementValue: 10,
        rewardWealth: 1000,
        rewardXp: 100,
        isHidden: true,
        displayOrder: 1,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'special_career_criminal' },
      update: {},
      create: {
        achievementName: 'Career Criminal',
        achievementKey: 'special_career_criminal',
        description: 'Get busted and bail out 50 times.',
        category: 'special',
        tier: 'silver',
        requirementType: 'bail_count',
        requirementValue: 50,
        rewardWealth: 10000,
        rewardXp: 500,
        isHidden: true,
        displayOrder: 2,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'special_lucky_find' },
      update: {},
      create: {
        achievementName: 'Lucky Find',
        achievementKey: 'special_lucky_find',
        description: 'Get a Legendary item from a crate.',
        category: 'special',
        tier: 'silver',
        requirementType: 'legendary_crate_item',
        requirementValue: 1,
        rewardWealth: 15000,
        rewardXp: 750,
        isHidden: true,
        displayOrder: 3,
      },
    }),

    // JUICERNAUT ACHIEVEMENTS
    prisma.achievement.upsert({
      where: { achievementKey: 'juicernaut_first_crown' },
      update: {},
      create: {
        achievementName: 'First Crown',
        achievementKey: 'juicernaut_first_crown',
        description: 'Win your first Juicernaut session.',
        category: 'juicernaut',
        tier: 'silver',
        requirementType: 'juicernaut_wins',
        requirementValue: 1,
        rewardWealth: 10000,
        rewardXp: 500,
        displayOrder: 1,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'juicernaut_crown_collector' },
      update: {},
      create: {
        achievementName: 'Crown Collector',
        achievementKey: 'juicernaut_crown_collector',
        description: 'Win 5 Juicernaut sessions.',
        category: 'juicernaut',
        tier: 'gold',
        requirementType: 'juicernaut_wins',
        requirementValue: 5,
        rewardWealth: 50000,
        rewardXp: 2500,
        displayOrder: 2,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'juicernaut_juice_lord' },
      update: {},
      create: {
        achievementName: 'Juice Lord',
        achievementKey: 'juicernaut_juice_lord',
        description: 'Win 25 Juicernaut sessions.',
        category: 'juicernaut',
        tier: 'platinum',
        requirementType: 'juicernaut_wins',
        requirementValue: 25,
        rewardWealth: 200000,
        rewardXp: 10000,
        rewardTitle: 'Juice Lord',
        displayOrder: 3,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'juicernaut_unstoppable' },
      update: {},
      create: {
        achievementName: 'Unstoppable',
        achievementKey: 'juicernaut_unstoppable',
        description: 'Win 50 Juicernaut sessions.',
        category: 'juicernaut',
        tier: 'legendary',
        requirementType: 'juicernaut_wins',
        requirementValue: 50,
        rewardWealth: 500000,
        rewardXp: 25000,
        rewardTitle: 'Unstoppable',
        displayOrder: 4,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'juicernaut_big_spender' },
      update: {},
      create: {
        achievementName: 'Big Spender',
        achievementKey: 'juicernaut_big_spender',
        description: 'Contribute $100 in a single Juicernaut session.',
        category: 'juicernaut',
        tier: 'silver',
        requirementType: 'juicernaut_contribution',
        requirementValue: 100,
        rewardWealth: 10000,
        rewardXp: 500,
        displayOrder: 5,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'juicernaut_whale' },
      update: {},
      create: {
        achievementName: 'Whale',
        achievementKey: 'juicernaut_whale',
        description: 'Contribute $500 in a single Juicernaut session.',
        category: 'juicernaut',
        tier: 'gold',
        requirementType: 'juicernaut_contribution',
        requirementValue: 500,
        rewardWealth: 50000,
        rewardXp: 2500,
        displayOrder: 6,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'juicernaut_leviathan' },
      update: {},
      create: {
        achievementName: 'Leviathan',
        achievementKey: 'juicernaut_leviathan',
        description: 'Contribute $1,000 in a single Juicernaut session.',
        category: 'juicernaut',
        tier: 'legendary',
        requirementType: 'juicernaut_contribution',
        requirementValue: 1000,
        rewardWealth: 200000,
        rewardXp: 10000,
        rewardTitle: 'Leviathan',
        displayOrder: 7,
      },
    }),

    // GAMBLING ACHIEVEMENTS (Phase 11)
    prisma.achievement.upsert({
      where: { achievementKey: 'gambling_first_timer' },
      update: {},
      create: {
        achievementName: 'First Timer',
        achievementKey: 'gambling_first_timer',
        description: 'Win your first gambling game.',
        category: 'gambling',
        tier: 'bronze',
        requirementType: 'gambling_wins',
        requirementValue: 1,
        rewardWealth: 500,
        rewardXp: 50,
        displayOrder: 1,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'gambling_winner' },
      update: {},
      create: {
        achievementName: 'Winner',
        achievementKey: 'gambling_winner',
        description: 'Win 25 gambling games.',
        category: 'gambling',
        tier: 'bronze',
        requirementType: 'gambling_wins',
        requirementValue: 25,
        rewardWealth: 2500,
        rewardXp: 150,
        displayOrder: 2,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'gambling_high_roller' },
      update: {},
      create: {
        achievementName: 'High Roller',
        achievementKey: 'gambling_high_roller',
        description: 'Wager $100,000 total.',
        category: 'gambling',
        tier: 'silver',
        requirementType: 'high_roller_wager',
        requirementValue: 100000,
        rewardWealth: 5000,
        rewardXp: 200,
        displayOrder: 3,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'gambling_lucky_streak' },
      update: {},
      create: {
        achievementName: 'Lucky Streak',
        achievementKey: 'gambling_lucky_streak',
        description: 'Win 5 gambling games in a row.',
        category: 'gambling',
        tier: 'silver',
        requirementType: 'gambling_win_streak',
        requirementValue: 5,
        rewardWealth: 5000,
        rewardXp: 250,
        displayOrder: 4,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'gambling_on_fire' },
      update: {},
      create: {
        achievementName: 'On Fire',
        achievementKey: 'gambling_on_fire',
        description: 'Win 10 gambling games in a row.',
        category: 'gambling',
        tier: 'gold',
        requirementType: 'gambling_win_streak',
        requirementValue: 10,
        rewardWealth: 15000,
        rewardXp: 750,
        displayOrder: 5,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'gambling_jackpot' },
      update: {},
      create: {
        achievementName: 'JACKPOT!',
        achievementKey: 'gambling_jackpot',
        description: 'Hit a slots jackpot.',
        category: 'gambling',
        tier: 'gold',
        requirementType: 'slots_jackpot',
        requirementValue: 1,
        rewardWealth: 10000,
        rewardXp: 500,
        displayOrder: 6,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'gambling_card_shark' },
      update: {},
      create: {
        achievementName: 'Card Shark',
        achievementKey: 'gambling_card_shark',
        description: 'Win 50 blackjack hands.',
        category: 'gambling',
        tier: 'gold',
        requirementType: 'blackjack_wins',
        requirementValue: 50,
        rewardWealth: 7500,
        rewardXp: 300,
        displayOrder: 7,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'gambling_flip_master' },
      update: {},
      create: {
        achievementName: 'Flip Master',
        achievementKey: 'gambling_flip_master',
        description: 'Win 25 coinflips.',
        category: 'gambling',
        tier: 'silver',
        requirementType: 'coinflip_wins',
        requirementValue: 25,
        rewardWealth: 5000,
        rewardXp: 200,
        displayOrder: 8,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'gambling_lucky_numbers' },
      update: {},
      create: {
        achievementName: 'Lucky Numbers',
        achievementKey: 'gambling_lucky_numbers',
        description: 'Win the lottery jackpot.',
        category: 'gambling',
        tier: 'platinum',
        requirementType: 'lottery_wins',
        requirementValue: 1,
        rewardWealth: 25000,
        rewardXp: 1000,
        rewardTitle: 'Lucky',
        displayOrder: 9,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'gambling_house_breaker' },
      update: {},
      create: {
        achievementName: 'House Breaker',
        achievementKey: 'gambling_house_breaker',
        description: 'Win $1,000,000 total from gambling.',
        category: 'gambling',
        tier: 'platinum',
        requirementType: 'gambling_total_won',
        requirementValue: 1000000,
        rewardWealth: 50000,
        rewardXp: 2000,
        rewardTitle: 'House Breaker',
        displayOrder: 10,
      },
    }),
    prisma.achievement.upsert({
      where: { achievementKey: 'gambling_casino_king' },
      update: {},
      create: {
        achievementName: 'Casino King',
        achievementKey: 'gambling_casino_king',
        description: 'Win $10,000,000 total from gambling.',
        category: 'gambling',
        tier: 'legendary',
        requirementType: 'gambling_total_won',
        requirementValue: 10000000,
        rewardWealth: 500000,
        rewardXp: 25000,
        rewardTitle: 'Casino King',
        displayOrder: 11,
      },
    }),
  ])

  console.log(`Created ${achievements.length} achievements`)

  // ==========================================================================
  // SEED SLOT JACKPOT (Phase 11)
  // ==========================================================================
  console.log('Seeding slot jackpot...')

  const jackpot = await prisma.slotJackpot.upsert({
    where: { id: 1 },
    update: {},
    create: {
      currentPool: BigInt(10000), // Start with $10,000 jackpot
      contributionRate: 0.02,     // 2% of bets go to jackpot
    },
  })

  console.log(`Slot jackpot initialized: $${jackpot.currentPool.toLocaleString()}`)

  console.log('Database seed completed!')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
