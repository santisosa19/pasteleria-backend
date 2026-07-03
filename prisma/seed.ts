import bcrypt from 'bcrypt';
import { MeasurementKind, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const permissions = [
  ['users:create', 'Crear usuarios internos'],
  ['users:read', 'Listar y ver usuarios internos'],
  ['users:update', 'Actualizar usuarios internos'],
  ['users:disable', 'Desactivar usuarios internos'],
  ['roles:read', 'Listar roles'],
  ['permissions:read', 'Listar permisos'],
  ['measurement-units:manage', 'Gestionar unidades de medida'],
  ['suppliers:manage', 'Gestionar proveedores'],
  ['raw-materials:manage', 'Gestionar materias primas'],
  ['recipes:manage', 'Gestionar recetas'],
  ['products:manage', 'Gestionar productos'],
  ['purchases:manage', 'Gestionar compras'],
  ['inventory:manage', 'Gestionar inventario'],
  ['sales:manage', 'Gestionar ventas'],
  ['reports:read', 'Ver reportes'],
  ['customers:manage', 'Gestionar clientes'],
  ['orders:manage', 'Gestionar pedidos'],
  ['payments:manage', 'Gestionar pagos'],
] as const;

const rolePermissions = {
  admin: permissions.map(([code]) => code),
  operator: [
    'measurement-units:manage',
    'suppliers:manage',
    'raw-materials:manage',
    'recipes:manage',
    'products:manage',
    'purchases:manage',
    'inventory:manage',
    'reports:read',
  ],
  seller: ['sales:manage', 'customers:manage', 'orders:manage'],
} as const;

const measurementUnits = [
  {
    code: 'g',
    name: 'Gramo',
    kind: MeasurementKind.MASS,
    conversionRateToBase: 1,
    isBase: true,
  },
  {
    code: 'kg',
    name: 'Kilogramo',
    kind: MeasurementKind.MASS,
    conversionRateToBase: 1000,
    isBase: false,
  },
  {
    code: 'ml',
    name: 'Mililitro',
    kind: MeasurementKind.VOLUME,
    conversionRateToBase: 1,
    isBase: true,
  },
  {
    code: 'l',
    name: 'Litro',
    kind: MeasurementKind.VOLUME,
    conversionRateToBase: 1000,
    isBase: false,
  },
  {
    code: 'un',
    name: 'Unidad',
    kind: MeasurementKind.UNIT,
    conversionRateToBase: 1,
    isBase: true,
  },
] as const;

async function main() {
  const permissionRecords = new Map<string, { id: string }>();

  for (const [code, description] of permissions) {
    const permission = await prisma.permission.upsert({
      create: { code, description },
      update: { description },
      where: { code },
    });
    permissionRecords.set(code, permission);
  }

  for (const [roleName, codes] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({
      create: { name: roleName },
      update: {},
      where: { name: roleName },
    });

    for (const code of codes) {
      const permission = permissionRecords.get(code);
      if (!permission) {
        throw new Error(`Missing permission ${code}`);
      }

      await prisma.rolePermission.upsert({
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
        update: {},
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
      });
    }
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'admin' },
  });
  const passwordHash = await bcrypt.hash('admin', 12);

  await prisma.user.upsert({
    create: {
      username: 'admin',
      email: 'admin@pasteleria.local',
      passwordHash,
      firstName: 'Admin',
      lastName: 'Pasteleria',
      roleId: adminRole.id,
    },
    update: {
      isActive: true,
      roleId: adminRole.id,
    },
    where: { username: 'admin' },
  });

  for (const measurementUnit of measurementUnits) {
    await prisma.measurementUnit.upsert({
      create: measurementUnit,
      update: {
        name: measurementUnit.name,
        kind: measurementUnit.kind,
        conversionRateToBase: measurementUnit.conversionRateToBase,
        isBase: measurementUnit.isBase,
      },
      where: { code: measurementUnit.code },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
