/**
 * Seed script for Stream Action Types
 * Run with: npx tsx prisma/seed-stream-actions.ts
 */

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

const STREAM_ACTIONS = [
  // Lights & Ambiance
  {
    id: 'color_shift',
    name: 'Color Shift',
    category: 'lights',
    cost: 10000,
    cooldown_seconds: 120,
    limit_per_stream: null,
    lumia_command_id: 'color_shift',
    queue_behavior: 'overwrite',
    max_characters: null,
    description: 'Change stream light color',
    sort_order: 1,
  },
  {
    id: 'flash_pulse',
    name: 'Flash Pulse',
    category: 'lights',
    cost: 15000,
    cooldown_seconds: 180,
    limit_per_stream: null,
    lumia_command_id: 'flash_pulse',
    queue_behavior: 'overwrite',
    max_characters: null,
    description: 'Quick light flash effect',
    sort_order: 2,
  },
  {
    id: 'rainbow_cycle',
    name: 'Rainbow Cycle',
    category: 'lights',
    cost: 25000,
    cooldown_seconds: 600,
    limit_per_stream: 10,
    lumia_command_id: 'rainbow',
    queue_behavior: 'overwrite',
    max_characters: null,
    description: '10-second rainbow lights',
    sort_order: 3,
  },
  {
    id: 'blackout',
    name: 'Blackout',
    category: 'lights',
    cost: 50000,
    cooldown_seconds: 1800,
    limit_per_stream: 3,
    lumia_command_id: 'blackout',
    queue_behavior: 'overwrite',
    max_characters: null,
    description: 'Lights off for 5 seconds',
    sort_order: 4,
  },

  // Fog & Effects
  {
    id: 'fog_burst',
    name: 'Fog Burst',
    category: 'fog',
    cost: 25000,
    cooldown_seconds: 300,
    limit_per_stream: null,
    lumia_command_id: 'fog_burst',
    queue_behavior: 'overwrite',
    max_characters: null,
    description: 'Single fog machine burst',
    sort_order: 10,
  },
  {
    id: 'fog_wave',
    name: 'Fog Wave',
    category: 'fog',
    cost: 75000,
    cooldown_seconds: 900,
    limit_per_stream: 5,
    lumia_command_id: 'fog_wave',
    queue_behavior: 'overwrite',
    max_characters: null,
    description: '10-second continuous fog',
    sort_order: 11,
  },
  {
    id: 'atmosphere',
    name: 'The Atmosphere',
    category: 'fog',
    cost: 150000,
    cooldown_seconds: 3600,
    limit_per_stream: 2,
    lumia_command_id: 'atmosphere',
    queue_behavior: 'overwrite',
    max_characters: null,
    description: 'Fog + dim lights combo',
    sort_order: 12,
  },

  // Sound & Voice
  {
    id: 'sound_alert',
    name: 'Sound Alert',
    category: 'sound',
    cost: 20000,
    cooldown_seconds: 180,
    limit_per_stream: null,
    lumia_command_id: 'sound_alert',
    queue_behavior: 'queue',
    max_characters: null,
    description: 'Play sound from approved list',
    sort_order: 20,
  },
  {
    id: 'tts_short',
    name: 'TTS Short',
    category: 'tts',
    cost: 35000,
    cooldown_seconds: 300,
    limit_per_stream: null,
    lumia_command_id: 'tts',
    queue_behavior: 'queue',
    max_characters: 50,
    description: 'Text-to-speech (50 chars)',
    sort_order: 21,
  },
  {
    id: 'tts_long',
    name: 'TTS Long',
    category: 'tts',
    cost: 60000,
    cooldown_seconds: 300,
    limit_per_stream: null,
    lumia_command_id: 'tts',
    queue_behavior: 'queue',
    max_characters: 100,
    description: 'Text-to-speech (100 chars)',
    sort_order: 22,
  },
  {
    id: 'tts_premium',
    name: 'TTS Premium',
    category: 'tts',
    cost: 100000,
    cooldown_seconds: 600,
    limit_per_stream: 10,
    lumia_command_id: 'tts',
    queue_behavior: 'queue',
    max_characters: 200,
    description: 'Text-to-speech (200 chars)',
    sort_order: 23,
  },
]

async function main() {
  console.log('Seeding stream action types...')

  for (const action of STREAM_ACTIONS) {
    await prisma.stream_action_types.upsert({
      where: { id: action.id },
      update: {
        name: action.name,
        category: action.category,
        cost: action.cost,
        cooldown_seconds: action.cooldown_seconds,
        limit_per_stream: action.limit_per_stream,
        lumia_command_id: action.lumia_command_id,
        queue_behavior: action.queue_behavior,
        max_characters: action.max_characters,
        description: action.description,
        sort_order: action.sort_order,
      },
      create: action,
    })
    console.log(`  - ${action.id}: ${action.name}`)
  }

  console.log(`\nSeeded ${STREAM_ACTIONS.length} stream action types`)
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
