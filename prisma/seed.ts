import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱  Seeding database…')

  await prisma.user.upsert({
    where:  { email: 'admin@chinaexpress.tm' },
    update: { passwordHash: bcrypt.hashSync('admin123', 10) },
    create: {
      name:         'Admin',
      email:        'admin@chinaexpress.tm',
      passwordHash: bcrypt.hashSync('admin123', 10),
      role:         'ADMIN',
      avatar:       '👨‍💼',
    },
  })
  console.log('  ✓ Admin user')

  await prisma.storeSettings.upsert({
    where:  { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  })
  console.log('  ✓ Store settings')

  console.log('\n✅  Seed complete!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())