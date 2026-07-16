const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // Seed admin user
  const adminExists = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin', 10);
    await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        role: 'admin',
        company_name: 'PT. Admin',
      }
    });
    console.log('Seeded admin user');
  }

  // Seed normal user
  const userExists = await prisma.user.findUnique({ where: { username: 'user' } });
  if (!userExists) {
    const hashedPassword = await bcrypt.hash('user', 10);
    await prisma.user.create({
      data: {
        username: 'user',
        password: hashedPassword,
        role: 'user',
        company_name: 'PT. Klien Trafo',
        phone: '08123456789'
      }
    });
    console.log('Seeded user "user"');
  }

  // Seed transformers
  const transformersCount = await prisma.transformer.count();
  if (transformersCount === 0) {
    await prisma.transformer.createMany({
      data: [
        { name: '1800004519 (Trafo Mech)', status: 'Offline', power_capacity: '1000kVA', type: 'DyN', username: 'user', company_name: 'PT. Klien Trafo' },
        { name: '1202482 (Trafo Testing)', status: 'Online', power_capacity: '1000kVA', type: 'DyN', username: 'user', company_name: 'PT. Klien Trafo' },
        { name: '1800003781 (Trafo PTR)', status: 'Online', power_capacity: '2000kVA', type: 'DyN', username: 'user', company_name: 'PT. Klien Trafo' },
      ]
    });
    console.log('Seeded initial transformers untuk user');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Seed completed successfully.');
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
