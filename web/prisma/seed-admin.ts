import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

console.log('Connecting to database...');
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

interface AdminSetting {
  key: string;
  value: unknown;
  value_type: string;
  category: string;
  label: string;
  description: string;
  constraints?: { min?: number; max?: number; options?: string[] };
  is_sensitive: boolean;
}

const INITIAL_SETTINGS: AdminSetting[] = [
  // =============================================================================
  // FEATURE FLAGS
  // =============================================================================
  {
    key: 'feature_maintenance_mode',
    value: false,
    value_type: 'boolean',
    category: 'features',
    label: 'Maintenance Mode',
    description: 'Disable all gameplay. Only admins can access the site.',
    is_sensitive: false,
  },
  {
    key: 'feature_gambling_enabled',
    value: true,
    value_type: 'boolean',
    category: 'features',
    label: 'Gambling Enabled',
    description: 'Enable/disable all gambling features (slots, blackjack, coinflip, lottery).',
    is_sensitive: false,
  },
  {
    key: 'feature_robbery_enabled',
    value: true,
    value_type: 'boolean',
    category: 'features',
    label: 'Robbery Enabled',
    description: 'Enable/disable the rob command.',
    is_sensitive: false,
  },
  {
    key: 'feature_heists_enabled',
    value: true,
    value_type: 'boolean',
    category: 'features',
    label: 'Heists Enabled',
    description: 'Enable/disable stream heist events.',
    is_sensitive: false,
  },
  {
    key: 'feature_missions_enabled',
    value: true,
    value_type: 'boolean',
    category: 'features',
    label: 'Missions Enabled',
    description: 'Enable/disable daily and weekly missions.',
    is_sensitive: false,
  },
  {
    key: 'feature_registration_enabled',
    value: true,
    value_type: 'boolean',
    category: 'features',
    label: 'New Registration',
    description: 'Allow new users to register.',
    is_sensitive: false,
  },
  {
    key: 'feature_shop_enabled',
    value: true,
    value_type: 'boolean',
    category: 'features',
    label: 'Shop Enabled',
    description: 'Enable/disable the player shop and black market.',
    is_sensitive: false,
  },
  {
    key: 'feature_factions_enabled',
    value: true,
    value_type: 'boolean',
    category: 'features',
    label: 'Factions Enabled',
    description: 'Enable/disable faction system.',
    is_sensitive: false,
  },
  {
    key: 'feature_stream_actions_enabled',
    value: true,
    value_type: 'boolean',
    category: 'features',
    label: 'Stream Actions Enabled',
    description: 'Enable/disable stream action purchases (Lumia integration).',
    is_sensitive: false,
  },

  // =============================================================================
  // ECONOMY SETTINGS
  // =============================================================================
  {
    key: 'economy_wealth_multiplier',
    value: 1.0,
    value_type: 'number',
    category: 'economy',
    label: 'Global Wealth Multiplier',
    description: 'Multiplier applied to all wealth gains. Use for events (1.0 = normal).',
    constraints: { min: 0.1, max: 10.0 },
    is_sensitive: false,
  },
  {
    key: 'economy_xp_multiplier',
    value: 1.0,
    value_type: 'number',
    category: 'economy',
    label: 'Global XP Multiplier',
    description: 'Multiplier applied to all XP gains. Use for events (1.0 = normal).',
    constraints: { min: 0.1, max: 10.0 },
    is_sensitive: false,
  },
  {
    key: 'economy_rob_success_modifier',
    value: 0,
    value_type: 'number',
    category: 'economy',
    label: 'Rob Success Modifier (%)',
    description: 'Added to base rob success rate. Positive = easier, negative = harder.',
    constraints: { min: -30, max: 30 },
    is_sensitive: false,
  },
  {
    key: 'economy_crate_drop_multiplier',
    value: 1.0,
    value_type: 'number',
    category: 'economy',
    label: 'Crate Drop Multiplier',
    description: 'Multiplier for crate drop chances from play events.',
    constraints: { min: 0.0, max: 5.0 },
    is_sensitive: false,
  },

  // =============================================================================
  // DISPLAY SETTINGS
  // =============================================================================
  {
    key: 'display_motd',
    value: '',
    value_type: 'string',
    category: 'display',
    label: 'Message of the Day',
    description: 'Shown on dashboard. Leave empty to hide.',
    is_sensitive: false,
  },
  {
    key: 'display_announcement',
    value: null,
    value_type: 'json',
    category: 'display',
    label: 'Site Announcement',
    description: 'Banner announcement. JSON format: { "text": "...", "type": "info|warning|error", "link": "optional url" }',
    is_sensitive: false,
  },
  {
    key: 'display_event_name',
    value: '',
    value_type: 'string',
    category: 'display',
    label: 'Active Event Name',
    description: 'Name of current special event (shown in UI). Empty = no event.',
    is_sensitive: false,
  },

  // =============================================================================
  // GAMEPLAY SETTINGS
  // =============================================================================
  {
    key: 'gameplay_play_cooldown_seconds',
    value: 30,
    value_type: 'number',
    category: 'gameplay',
    label: 'Play Cooldown (seconds)',
    description: 'Cooldown between !play commands.',
    constraints: { min: 10, max: 300 },
    is_sensitive: false,
  },
  {
    key: 'gameplay_rob_cooldown_seconds',
    value: 300,
    value_type: 'number',
    category: 'gameplay',
    label: 'Rob Cooldown (seconds)',
    description: 'Cooldown between rob attempts.',
    constraints: { min: 60, max: 3600 },
    is_sensitive: false,
  },
  {
    key: 'gameplay_jail_duration_seconds',
    value: 300,
    value_type: 'number',
    category: 'gameplay',
    label: 'Jail Duration (seconds)',
    description: 'Default jail time when caught.',
    constraints: { min: 60, max: 1800 },
    is_sensitive: false,
  },
];

async function seedAdminSettings() {
  console.log('Seeding admin settings...');

  let created = 0;
  let skipped = 0;

  for (const setting of INITIAL_SETTINGS) {
    const existing = await prisma.admin_settings.findUnique({
      where: { key: setting.key },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.admin_settings.create({
      data: {
        key: setting.key,
        value: setting.value as any,
        value_type: setting.value_type,
        category: setting.category,
        label: setting.label,
        description: setting.description,
        constraints: setting.constraints || null,
        is_sensitive: setting.is_sensitive,
      },
    });
    created++;
  }

  console.log(`Admin settings: ${created} created, ${skipped} already existed`);
}

async function main() {
  try {
    await seedAdminSettings();
    console.log('Admin seed completed successfully!');
  } catch (error) {
    console.error('Error seeding admin data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
