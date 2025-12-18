import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Get the username or ID from command line args
  const input = process.argv[2];

  if (!input) {
    // List all users if no username provided
    console.log('\nAvailable users:');
    console.log('================');
    const users = await prisma.users.findMany({
      select: { id: true, username: true, created_at: true },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    for (const user of users) {
      const isAdmin = await prisma.admin_users.findUnique({
        where: { user_id: user.id },
      });
      console.log(`  ID: ${user.id} | ${user.username}${isAdmin ? ' [ADMIN]' : ''}`);
    }

    console.log('\nUsage: npx tsx scripts/grant-admin.ts <username or id:NUMBER>');
    return;
  }

  // Find user by ID or username
  let user;
  if (input.startsWith('id:')) {
    const userId = parseInt(input.slice(3));
    user = await prisma.users.findUnique({ where: { id: userId } });
  } else {
    user = await prisma.users.findFirst({
      where: { username: { equals: input, mode: 'insensitive' } },
    });
  }

  if (!user) {
    console.error(`User "${input}" not found`);
    return;
  }

  // Check if already admin
  const existing = await prisma.admin_users.findUnique({
    where: { user_id: user.id },
  });

  if (existing) {
    console.log(`User "${user.username}" (ID: ${user.id}) is already an admin with role: ${existing.role}`);
    return;
  }

  // Grant admin access
  await prisma.admin_users.create({
    data: {
      user_id: user.id,
      role: 'owner',
      notes: 'Granted via script',
    },
  });

  console.log(`\n✓ Granted OWNER access to "${user.username}" (ID: ${user.id})`);
  console.log(`  They can now access /admin`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
