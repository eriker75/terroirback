/**
 * Crea (o restablece) un usuario administrador usando EXACTAMENTE el mismo
 * stack que la app: Prisma (misma DATABASE_URL del backend) + bcrypt (mismo
 * algoritmo/rounds que el login). Esto evita los dos problemas del SQL con
 * pgcrypto: (1) que el hash no sea compatible y (2) que el script corra contra
 * otra base de datos distinta a la que usa el backend.
 *
 * Uso (dentro del contenedor):
 *   npm run seed:admin                         → eriadmin@gmail.com / Admin123?
 *   npm run seed:admin -- correo@x.com Clave1?  → email y contraseña a medida
 * Desde el host:  make create-admin
 *
 * El email se guarda en minúsculas; al iniciar sesión escríbelo en minúsculas.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

async function main() {
  const [, , argEmail, argPassword] = process.argv;
  const email = (argEmail ?? process.env.ADMIN_EMAIL ?? 'eriadmin@gmail.com').toLowerCase().trim();
  const password = argPassword ?? process.env.ADMIN_PASSWORD ?? 'Admin123?';
  const firstName = process.env.ADMIN_FIRST_NAME ?? 'Eri';
  const lastName = process.env.ADMIN_LAST_NAME ?? 'Admin';

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL no está definido en el entorno del contenedor.');
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Mismo hash que el registro de la app (bcrypt, 10 rounds).
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
      where: { email },
      // Si ya existe (p.ej. creado por social sin contraseña), le fijamos la
      // contraseña y lo promovemos a admin activo.
      update: {
        password: hashedPassword,
        role: 'admin',
        status: 'active',
      },
      create: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone: '0000000000',
        address: 'N/A',
        city: 'N/A',
        state: 'N/A',
        zip: '0000',
        country: 'Venezuela',
        role: 'admin',
        status: 'active',
      },
      select: { id: true, email: true, role: true, status: true },
    });

    console.log('✓ Admin listo. Inicia sesión con email + contraseña:');
    console.log(`  email:    ${user.email}`);
    console.log(`  password: ${password}`);
    console.log(`  role:     ${user.role} | status: ${user.status} | id: ${user.id}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('✗ No se pudo crear el admin:', err);
  process.exit(1);
});
