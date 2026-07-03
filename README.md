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
- `npm test`: corre tests unitarios.
- `npm run prisma:format`: formatea `schema.prisma`.
- `npm run prisma:generate`: genera Prisma Client.
- `npm run prisma:migrate`: crea/aplica migraciones en desarrollo.

## Documentacion

- `docs/architecture.md`
- `docs/data-model.md`
- `docs/business-flows.md`
- `docs/development-plan.md`
- `docs/security-notes.md`
