# Pasteleria Backend

Backend NestJS para gestion integral de una pasteleria: materias primas, unidades, recetas, productos, compras, inventario, ventas, reportes y base preparada para ecommerce.

## Stack

- NestJS
- Fastify
- PostgreSQL
- Prisma
- JWT
- Swagger/OpenAPI

## Requisitos

- Node.js 20.19+ recomendado. En esta maquina se uso 20.9 con versiones compatibles.
- npm
- Docker para levantar PostgreSQL local

## Configuracion

1. Copiar `.env.example` a `.env`.
2. Levantar PostgreSQL: `docker compose up -d`.
3. Generar Prisma Client: `npm run prisma:generate`.
4. Crear migracion inicial: `npm run prisma:migrate -- --name init`.
5. Ejecutar API: `npm run start:dev`.

## URLs Locales

- API health: `http://localhost:3000/api/v1/health`
- Swagger: `http://localhost:3000/docs`
- Prisma Studio: `npm run prisma:studio`

## Scripts

- `npm run build`: compila el backend.
- `npm run lint:check`: valida lint sin modificar archivos.
- `npm run lint`: ejecuta ESLint con autofix.
- `npm test`: corre tests unitarios.
- `npm run prisma:format`: formatea `schema.prisma`.
- `npm run prisma:generate`: genera Prisma Client.
- `npm run prisma:migrate`: crea/aplica migraciones en desarrollo.

## Modulos Implementados

- Auth, usuarios, roles y permisos.
- Unidades de medida, proveedores y materias primas.
- Recetas, productos, compras, inventario, ventas y reportes.
- Clientes, pedidos y pagos manuales preparados para integracion futura.

## Flujos Criticos

- Las compras actualizan stock, costo promedio y movimientos `PURCHASE_IN`.
- Las ventas descuentan stock y congelan costo/ganancia estimada.
- Los pedidos se pueden convertir a venta con `POST /api/v1/orders/:id/convert-to-sale`.
- Las ventas se cancelan con `POST /api/v1/sales/:id/cancel`, generando reversa de stock sin modificar items historicos.
- Los pagos actuales son manuales/ficticios y quedan listos para mapear a proveedores como Mercado Pago.
- Las operaciones criticas registran auditoria en `audit_logs`.

## Documentacion

- `docs/architecture.md`
- `docs/data-model.md`
- `docs/business-flows.md`
- `docs/development-plan.md`
- `docs/security-notes.md`
