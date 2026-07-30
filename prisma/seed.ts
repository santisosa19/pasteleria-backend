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
  ['measurement-units:create', 'Crear unidades de medida'],
  ['measurement-units:read', 'Listar y ver unidades de medida'],
  ['measurement-units:update', 'Actualizar unidades de medida'],
  ['measurement-units:delete', 'Desactivar unidades de medida'],
  ['suppliers:create', 'Crear proveedores'],
  ['suppliers:read', 'Listar y ver proveedores'],
  ['suppliers:update', 'Actualizar proveedores'],
  ['suppliers:delete', 'Desactivar proveedores'],
  ['raw-materials:create', 'Crear materias primas'],
  ['raw-materials:read', 'Listar y ver materias primas'],
  ['raw-materials:update', 'Actualizar materias primas'],
  ['raw-materials:delete', 'Desactivar materias primas'],
  ['recipes:create', 'Crear recetas'],
  ['recipes:read', 'Listar y ver recetas'],
  ['recipes:update', 'Actualizar recetas'],
  ['recipes:delete', 'Desactivar recetas'],
  ['recipes:cost:read', 'Ver costos de recetas'],
  ['products:create', 'Crear productos'],
  ['products:read', 'Listar y ver productos'],
  ['products:update', 'Actualizar productos'],
  ['products:delete', 'Desactivar productos'],
  ['products:profit:read', 'Ver estimaciones de rentabilidad de productos'],
  ['purchases:create', 'Registrar compras'],
  ['purchases:read', 'Listar y ver compras'],
  ['inventory:movements:read', 'Ver movimientos de inventario'],
  ['inventory:low-stock:read', 'Ver alertas de stock bajo'],
  ['inventory:adjustments:create', 'Crear ajustes de inventario'],
  ['sales:create', 'Registrar ventas'],
  ['sales:read', 'Listar y ver ventas'],
  ['sales:cancel', 'Cancelar ventas'],
  ['reports:sales-summary:read', 'Ver resumen de ventas'],
  ['reports:product-margins:read', 'Ver margenes por producto'],
  ['reports:purchases-by-supplier:read', 'Ver compras por proveedor'],
  ['reports:raw-material-consumption:read', 'Ver consumo de materias primas'],
  ['reports:read', 'Ver reportes'],
  ['customers:create', 'Crear clientes'],
  ['customers:read', 'Listar y ver clientes'],
  ['customers:update', 'Actualizar clientes'],
  ['customers:delete', 'Eliminar clientes'],
  ['orders:create', 'Crear pedidos'],
  ['orders:read', 'Listar y ver pedidos'],
  ['orders:status:update', 'Actualizar estado de pedidos'],
  ['orders:convert-to-sale', 'Convertir pedidos a ventas'],
  ['payments:create', 'Registrar pagos'],
  ['payments:read', 'Listar y ver pagos'],
  ['payments:status:update', 'Actualizar estado de pagos'],
] as const;

const operatorPermissions = [
  'measurement-units:create',
  'measurement-units:read',
  'measurement-units:update',
  'measurement-units:delete',
  'suppliers:create',
  'suppliers:read',
  'suppliers:update',
  'suppliers:delete',
  'raw-materials:create',
  'raw-materials:read',
  'raw-materials:update',
  'raw-materials:delete',
  'recipes:create',
  'recipes:read',
  'recipes:update',
  'recipes:delete',
  'recipes:cost:read',
  'products:create',
  'products:read',
  'products:update',
  'products:delete',
  'products:profit:read',
  'purchases:create',
  'purchases:read',
  'inventory:movements:read',
  'inventory:low-stock:read',
  'inventory:adjustments:create',
  'reports:sales-summary:read',
  'reports:product-margins:read',
  'reports:purchases-by-supplier:read',
  'reports:raw-material-consumption:read',
  'reports:read',
] as const;

const sellerPermissions = [
  'products:read',
  'raw-materials:read',
  'measurement-units:read',
  'sales:create',
  'sales:read',
  'sales:cancel',
  'customers:create',
  'customers:read',
  'customers:update',
  'customers:delete',
  'orders:create',
  'orders:read',
  'orders:status:update',
  'orders:convert-to-sale',
  'payments:create',
  'payments:read',
  'payments:status:update',
] as const;

const rolePermissions = {
  admin: permissions.map(([code]) => code),
  operator: operatorPermissions,
  seller: sellerPermissions,
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
