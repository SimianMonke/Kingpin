import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

// Create Prisma client with Neon adapter
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const adapter = new PrismaNeon({ connectionString })
const prisma = new PrismaClient({ adapter })

interface AchievementData {
  name: string
  key: string
  description: string
  category: string
  tier: string
  requirement_type: string
  requirement_value: bigint
  reward_wealth: number
  reward_xp: number
  reward_title?: string
  is_hidden?: boolean
  display_order: number
}

const achievements: AchievementData[] = [
  // ==========================================================================
  // WEALTH ACHIEVEMENTS
  // ==========================================================================
  {
    name: 'First Score',
    key: 'wealth_first_score',
    description: 'Earn $1,000 total wealth.',
    category: 'wealth',
    tier: 'bronze',
    requirement_type: 'total_wealth_earned',
    requirement_value: BigInt(1000),
    reward_wealth: 500,
    reward_xp: 50,
    display_order: 1,
  },
  {
    name: 'Getting Started',
    key: 'wealth_getting_started',
    description: 'Earn $10,000 total wealth.',
    category: 'wealth',
    tier: 'bronze',
    requirement_type: 'total_wealth_earned',
    requirement_value: BigInt(10000),
    reward_wealth: 1000,
    reward_xp: 100,
    display_order: 2,
  },
  {
    name: 'Money Maker',
    key: 'wealth_money_maker',
    description: 'Earn $100,000 total wealth.',
    category: 'wealth',
    tier: 'silver',
    requirement_type: 'total_wealth_earned',
    requirement_value: BigInt(100000),
    reward_wealth: 5000,
    reward_xp: 300,
    display_order: 3,
  },
  {
    name: 'Six Figures',
    key: 'wealth_six_figures',
    description: 'Earn $1,000,000 total wealth.',
    category: 'wealth',
    tier: 'gold',
    requirement_type: 'total_wealth_earned',
    requirement_value: BigInt(1000000),
    reward_wealth: 25000,
    reward_xp: 1000,
    reward_title: 'Millionaire',
    display_order: 4,
  },
  {
    name: 'Made It',
    key: 'wealth_made_it',
    description: 'Earn $10,000,000 total wealth.',
    category: 'wealth',
    tier: 'platinum',
    requirement_type: 'total_wealth_earned',
    requirement_value: BigInt(10000000),
    reward_wealth: 100000,
    reward_xp: 5000,
    reward_title: 'Tycoon',
    display_order: 5,
  },
  {
    name: 'Kingpin Fortune',
    key: 'wealth_kingpin_fortune',
    description: 'Earn $100,000,000 total wealth.',
    category: 'wealth',
    tier: 'legendary',
    requirement_type: 'total_wealth_earned',
    requirement_value: BigInt(100000000),
    reward_wealth: 500000,
    reward_xp: 25000,
    reward_title: 'Kingpin',
    display_order: 6,
  },

  // ==========================================================================
  // EXPERIENCE / LEVEL ACHIEVEMENTS
  // ==========================================================================
  {
    name: 'Rookie',
    key: 'experience_rookie',
    description: 'Reach level 5.',
    category: 'experience',
    tier: 'bronze',
    requirement_type: 'level',
    requirement_value: BigInt(5),
    reward_wealth: 500,
    reward_xp: 100,
    display_order: 1,
  },
  {
    name: 'Rising Star',
    key: 'experience_rising_star',
    description: 'Reach level 10.',
    category: 'experience',
    tier: 'bronze',
    requirement_type: 'level',
    requirement_value: BigInt(10),
    reward_wealth: 1000,
    reward_xp: 250,
    display_order: 2,
  },
  {
    name: 'Veteran',
    key: 'experience_veteran',
    description: 'Reach level 25.',
    category: 'experience',
    tier: 'silver',
    requirement_type: 'level',
    requirement_value: BigInt(25),
    reward_wealth: 5000,
    reward_xp: 500,
    display_order: 3,
  },
  {
    name: 'Elite',
    key: 'experience_elite',
    description: 'Reach level 50.',
    category: 'experience',
    tier: 'gold',
    requirement_type: 'level',
    requirement_value: BigInt(50),
    reward_wealth: 15000,
    reward_xp: 1000,
    reward_title: 'Elite',
    display_order: 4,
  },
  {
    name: 'Master',
    key: 'experience_master',
    description: 'Reach level 75.',
    category: 'experience',
    tier: 'platinum',
    requirement_type: 'level',
    requirement_value: BigInt(75),
    reward_wealth: 50000,
    reward_xp: 2500,
    reward_title: 'Master',
    display_order: 5,
  },
  {
    name: 'Legend',
    key: 'experience_legend',
    description: 'Reach level 100.',
    category: 'experience',
    tier: 'legendary',
    requirement_type: 'level',
    requirement_value: BigInt(100),
    reward_wealth: 250000,
    reward_xp: 10000,
    reward_title: 'Legend',
    display_order: 6,
  },

  // ==========================================================================
  // CRIME / ROBBERY ACHIEVEMENTS
  // ==========================================================================
  {
    name: 'Petty Theft',
    key: 'crime_petty_theft',
    description: 'Win 5 robberies.',
    category: 'crime',
    tier: 'bronze',
    requirement_type: 'rob_wins',
    requirement_value: BigInt(5),
    reward_wealth: 500,
    reward_xp: 100,
    display_order: 1,
  },
  {
    name: 'Career Criminal',
    key: 'crime_career_criminal',
    description: 'Win 25 robberies.',
    category: 'crime',
    tier: 'silver',
    requirement_type: 'rob_wins',
    requirement_value: BigInt(25),
    reward_wealth: 2500,
    reward_xp: 400,
    display_order: 2,
  },
  {
    name: 'Master Thief',
    key: 'crime_master_thief',
    description: 'Win 100 robberies.',
    category: 'crime',
    tier: 'gold',
    requirement_type: 'rob_wins',
    requirement_value: BigInt(100),
    reward_wealth: 10000,
    reward_xp: 1000,
    reward_title: 'Master Thief',
    display_order: 3,
  },
  {
    name: 'Crime Lord',
    key: 'crime_lord',
    description: 'Win 500 robberies.',
    category: 'crime',
    tier: 'platinum',
    requirement_type: 'rob_wins',
    requirement_value: BigInt(500),
    reward_wealth: 50000,
    reward_xp: 5000,
    reward_title: 'Crime Lord',
    display_order: 4,
  },
  {
    name: 'Iron Defense',
    key: 'crime_iron_defense',
    description: 'Successfully defend against 50 robberies.',
    category: 'crime',
    tier: 'gold',
    requirement_type: 'rob_defenses',
    requirement_value: BigInt(50),
    reward_wealth: 10000,
    reward_xp: 800,
    reward_title: 'Untouchable',
    display_order: 5,
  },
  {
    name: 'Hot Streak',
    key: 'crime_hot_streak',
    description: 'Win 10 robberies in a row.',
    category: 'crime',
    tier: 'gold',
    requirement_type: 'rob_win_streak',
    requirement_value: BigInt(10),
    reward_wealth: 15000,
    reward_xp: 1000,
    display_order: 6,
  },

  // ==========================================================================
  // DEDICATION / LOYALTY ACHIEVEMENTS
  // ==========================================================================
  {
    name: 'Showing Up',
    key: 'dedication_showing_up',
    description: 'Maintain a 7-day check-in streak.',
    category: 'dedication',
    tier: 'bronze',
    requirement_type: 'checkin_streak',
    requirement_value: BigInt(7),
    reward_wealth: 1000,
    reward_xp: 150,
    display_order: 1,
  },
  {
    name: 'Consistent',
    key: 'dedication_consistent',
    description: 'Maintain a 14-day check-in streak.',
    category: 'dedication',
    tier: 'bronze',
    requirement_type: 'checkin_streak',
    requirement_value: BigInt(14),
    reward_wealth: 2500,
    reward_xp: 300,
    display_order: 2,
  },
  {
    name: 'Loyal Soldier',
    key: 'dedication_loyal_soldier',
    description: 'Maintain a 30-day check-in streak.',
    category: 'dedication',
    tier: 'silver',
    requirement_type: 'checkin_streak',
    requirement_value: BigInt(30),
    reward_wealth: 7500,
    reward_xp: 600,
    display_order: 3,
  },
  {
    name: 'Devoted',
    key: 'dedication_devoted',
    description: 'Maintain a 60-day check-in streak.',
    category: 'dedication',
    tier: 'gold',
    requirement_type: 'checkin_streak',
    requirement_value: BigInt(60),
    reward_wealth: 20000,
    reward_xp: 1500,
    reward_title: 'Devoted',
    display_order: 4,
  },
  {
    name: 'Legendary Loyalty',
    key: 'dedication_legendary_loyalty',
    description: 'Maintain a 365-day check-in streak.',
    category: 'dedication',
    tier: 'legendary',
    requirement_type: 'checkin_streak',
    requirement_value: BigInt(365),
    reward_wealth: 500000,
    reward_xp: 25000,
    reward_title: 'Immortal',
    display_order: 5,
  },

  // ==========================================================================
  // SOCIAL ACHIEVEMENTS
  // ==========================================================================
  {
    name: 'Chatty',
    key: 'social_chatty',
    description: 'Send 100 messages.',
    category: 'social',
    tier: 'bronze',
    requirement_type: 'messages_sent',
    requirement_value: BigInt(100),
    reward_wealth: 500,
    reward_xp: 100,
    display_order: 1,
  },
  {
    name: 'Social Butterfly',
    key: 'social_butterfly',
    description: 'Send 1,000 messages.',
    category: 'social',
    tier: 'silver',
    requirement_type: 'messages_sent',
    requirement_value: BigInt(1000),
    reward_wealth: 2500,
    reward_xp: 400,
    display_order: 2,
  },
  {
    name: 'Community Pillar',
    key: 'social_community_pillar',
    description: 'Send 10,000 messages.',
    category: 'social',
    tier: 'gold',
    requirement_type: 'messages_sent',
    requirement_value: BigInt(10000),
    reward_wealth: 10000,
    reward_xp: 1000,
    reward_title: 'Chatterbox',
    display_order: 3,
  },

  // ==========================================================================
  // COLLECTION ACHIEVEMENTS
  // ==========================================================================
  {
    name: 'Collector',
    key: 'collection_collector',
    description: 'Own 10 unique items.',
    category: 'collection',
    tier: 'bronze',
    requirement_type: 'unique_items_owned',
    requirement_value: BigInt(10),
    reward_wealth: 1000,
    reward_xp: 150,
    display_order: 1,
  },
  {
    name: 'Hoarder',
    key: 'collection_hoarder',
    description: 'Own 50 unique items.',
    category: 'collection',
    tier: 'silver',
    requirement_type: 'unique_items_owned',
    requirement_value: BigInt(50),
    reward_wealth: 5000,
    reward_xp: 500,
    display_order: 2,
  },
  {
    name: 'Treasure Hunter',
    key: 'collection_treasure_hunter',
    description: 'Own 100 unique items.',
    category: 'collection',
    tier: 'gold',
    requirement_type: 'unique_items_owned',
    requirement_value: BigInt(100),
    reward_wealth: 20000,
    reward_xp: 1500,
    reward_title: 'Collector',
    display_order: 3,
  },
  {
    name: 'Jackpot!',
    key: 'collection_jackpot',
    description: 'Open a legendary item from a crate.',
    category: 'collection',
    tier: 'platinum',
    requirement_type: 'legendary_crate_item',
    requirement_value: BigInt(1),
    reward_wealth: 25000,
    reward_xp: 2000,
    display_order: 4,
  },

  // ==========================================================================
  // GAMBLING ACHIEVEMENTS
  // ==========================================================================
  {
    name: 'Beginner\'s Luck',
    key: 'gambling_beginners_luck',
    description: 'Win 10 gambling games.',
    category: 'special',
    tier: 'bronze',
    requirement_type: 'gambling_wins',
    requirement_value: BigInt(10),
    reward_wealth: 500,
    reward_xp: 100,
    display_order: 1,
  },
  {
    name: 'High Roller',
    key: 'gambling_high_roller',
    description: 'Win 100 gambling games.',
    category: 'special',
    tier: 'silver',
    requirement_type: 'gambling_wins',
    requirement_value: BigInt(100),
    reward_wealth: 5000,
    reward_xp: 500,
    display_order: 2,
  },
  {
    name: 'Casino King',
    key: 'gambling_casino_king',
    description: 'Win 1,000 gambling games.',
    category: 'special',
    tier: 'gold',
    requirement_type: 'gambling_wins',
    requirement_value: BigInt(1000),
    reward_wealth: 25000,
    reward_xp: 2000,
    reward_title: 'High Roller',
    display_order: 3,
  },
  {
    name: 'Slots Jackpot',
    key: 'gambling_slots_jackpot',
    description: 'Hit the slots jackpot.',
    category: 'special',
    tier: 'legendary',
    requirement_type: 'slots_jackpot',
    requirement_value: BigInt(1),
    reward_wealth: 100000,
    reward_xp: 5000,
    reward_title: 'Lucky',
    display_order: 4,
  },
  {
    name: 'Blackjack Master',
    key: 'gambling_blackjack_master',
    description: 'Win 100 blackjack games.',
    category: 'special',
    tier: 'gold',
    requirement_type: 'blackjack_wins',
    requirement_value: BigInt(100),
    reward_wealth: 15000,
    reward_xp: 1000,
    display_order: 5,
  },
  {
    name: 'Hot Hand',
    key: 'gambling_hot_hand',
    description: 'Win 5 gambling games in a row.',
    category: 'special',
    tier: 'silver',
    requirement_type: 'gambling_win_streak',
    requirement_value: BigInt(5),
    reward_wealth: 5000,
    reward_xp: 500,
    display_order: 6,
  },

  // ==========================================================================
  // FACTION ACHIEVEMENTS
  // ==========================================================================
  {
    name: 'Joined Up',
    key: 'faction_joined_up',
    description: 'Join a faction.',
    category: 'faction',
    tier: 'bronze',
    requirement_type: 'faction_joined',
    requirement_value: BigInt(1),
    reward_wealth: 1000,
    reward_xp: 100,
    display_order: 1,
  },
  {
    name: 'Loyal Member',
    key: 'faction_loyal_member',
    description: 'Stay in a faction for 30 days.',
    category: 'faction',
    tier: 'silver',
    requirement_type: 'faction_days',
    requirement_value: BigInt(30),
    reward_wealth: 5000,
    reward_xp: 500,
    display_order: 2,
  },
  {
    name: 'Turf War',
    key: 'faction_turf_war',
    description: 'Capture 10 territories.',
    category: 'faction',
    tier: 'gold',
    requirement_type: 'territory_captures',
    requirement_value: BigInt(10),
    reward_wealth: 15000,
    reward_xp: 1000,
    display_order: 3,
  },

  // ==========================================================================
  // JUICERNAUT ACHIEVEMENTS
  // ==========================================================================
  {
    name: 'Juicernaut Victor',
    key: 'juicernaut_victor',
    description: 'Win a Juicernaut event.',
    category: 'juicernaut',
    tier: 'gold',
    requirement_type: 'juicernaut_wins',
    requirement_value: BigInt(1),
    reward_wealth: 10000,
    reward_xp: 1000,
    display_order: 1,
  },
  {
    name: 'Juicernaut Champion',
    key: 'juicernaut_champion',
    description: 'Win 10 Juicernaut events.',
    category: 'juicernaut',
    tier: 'platinum',
    requirement_type: 'juicernaut_wins',
    requirement_value: BigInt(10),
    reward_wealth: 50000,
    reward_xp: 5000,
    reward_title: 'Champion',
    display_order: 2,
  },
  {
    name: 'Big Contributor',
    key: 'juicernaut_big_contributor',
    description: 'Contribute $100,000 total to Juicernaut events.',
    category: 'juicernaut',
    tier: 'gold',
    requirement_type: 'juicernaut_contribution',
    requirement_value: BigInt(100000),
    reward_wealth: 20000,
    reward_xp: 1500,
    display_order: 3,
  },

  // ==========================================================================
  // SECRET ACHIEVEMENTS
  // ==========================================================================
  {
    name: 'Early Adopter',
    key: 'secret_early_adopter',
    description: 'Join during the beta period.',
    category: 'secret',
    tier: 'platinum',
    requirement_type: 'early_adopter',
    requirement_value: BigInt(1),
    reward_wealth: 50000,
    reward_xp: 5000,
    reward_title: 'OG',
    is_hidden: true,
    display_order: 1,
  },
]

async function main() {
  console.log('Clearing existing achievements...')

  // Delete user progress first (foreign key constraint)
  await prisma.user_achievements.deleteMany({})
  console.log('  ✓ Cleared user achievement progress')

  // Delete achievements
  await prisma.achievements.deleteMany({})
  console.log('  ✓ Cleared achievements')

  console.log('\nSeeding achievements...')

  for (const achievement of achievements) {
    await prisma.achievements.upsert({
      where: { key: achievement.key },
      update: {
        name: achievement.name,
        description: achievement.description,
        category: achievement.category,
        tier: achievement.tier,
        requirement_type: achievement.requirement_type,
        requirement_value: achievement.requirement_value,
        reward_wealth: achievement.reward_wealth,
        reward_xp: achievement.reward_xp,
        reward_title: achievement.reward_title ?? null,
        is_hidden: achievement.is_hidden ?? false,
        display_order: achievement.display_order,
      },
      create: {
        name: achievement.name,
        key: achievement.key,
        description: achievement.description,
        category: achievement.category,
        tier: achievement.tier,
        requirement_type: achievement.requirement_type,
        requirement_value: achievement.requirement_value,
        reward_wealth: achievement.reward_wealth,
        reward_xp: achievement.reward_xp,
        reward_title: achievement.reward_title ?? null,
        is_hidden: achievement.is_hidden ?? false,
        display_order: achievement.display_order,
      },
    })
    console.log(`  ✓ ${achievement.name}`)
  }

  console.log(`\nSeeded ${achievements.length} achievements`)
}

main()
  .catch((e) => {
    console.error('Error seeding achievements:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
