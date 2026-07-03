# Arquitectura Del Sistema

## Objetivo

Construir una plataforma modular para gestion interna de una pasteleria, preparada para exponer el mismo backend a un ecommerce en una segunda etapa.

## Stack Inicial

- Backend: NestJS
- HTTP adapter: Fastify
- Base de datos: PostgreSQL
- ORM: Prisma
- API: REST
- Autenticacion: JWT
- Documentacion: Swagger/OpenAPI
- Frontend interno: React
- Frontend futuro ecommerce: otro cliente del mismo backend

## Principios

- La base de datos es la fuente de verdad para stock, compras, ventas, recetas y costos.
- Todo cambio de stock debe tener un `stock_movement` trazable.
- Compras, ventas y egresos de stock deben ejecutarse dentro de transacciones.
- El ecommerce no debe duplicar reglas de negocio: usa `products`, `catalog`, `orders`, `payments` y stock del mismo backend.
- Los costos estimados de venta se congelan al momento de vender para mantener reportes historicos consistentes.

## Modulos Backend

- `auth`: login, refresh tokens, JWT, guards y politicas por rol.
- `users`: usuarios internos y roles.
- `suppliers`: proveedores.
- `measurement-units`: unidades y conversiones a unidad base.
- `raw-materials`: insumos, costo promedio, stock minimo y estado.
- `recipes`: recetas, ingredientes y rendimiento.
- `products`: productos vendibles asociados a recetas.
- `purchases`: compras a proveedores y actualizacion de stock.
- `inventory`: movimientos, ajustes y disponibilidad.
- `sales`: ventas internas y descuento de insumos.
- `reports`: rentabilidad, costos, stock y consumo.
- `catalog`: exposicion publica/controlada de productos publicados.
- `customers`: clientes para pedidos online o ventas identificadas.
- `orders`: pedidos internos/ecommerce.
- `payments`: pagos y futura integracion Mercado Pago.

## Capas Recomendadas Por Modulo

Para los modulos simples se puede empezar con `controller`, `service` y DTOs. Cuando un modulo concentre reglas importantes, usar esta separacion:

- `domain`: reglas puras, calculos de costo, disponibilidad, conversiones.
- `application`: casos de uso, transacciones y orquestacion.
- `infrastructure`: Prisma, integraciones externas y persistencia.
- `presentation`: controllers REST y DTOs.

No conviene sobredisenar desde el dia uno. La separacion debe aparecer primero en `purchases`, `sales`, `inventory`, `recipes`, `orders` y `payments`.

## Seguridad Base

- JWT access token corto y refresh token separado.
- Hash de passwords con `bcrypt`.
- `ValidationPipe` global con whitelist y bloqueo de propiedades no declaradas.
- `@fastify/helmet` para headers HTTP seguros.
- CORS por variable de entorno.
- Secrets solo por `.env`, nunca versionados.
- Roles iniciales sugeridos: `admin`, `operator`, `seller`.
- Auditoria en operaciones criticas: compras, ventas, ajustes de stock, cambios de precio y pagos.

## Preparacion Para Ecommerce

- `products.isPublished` define si aparece en catalogo.
- `orders.channel` diferencia pedidos internos y ecommerce.
- `payments.provider` permite Mercado Pago sin acoplar el dominio al proveedor.
- `payments.rawPayload` conserva payloads para conciliacion y soporte.
- Una venta puede originarse desde un pedido mediante `sales.order_id`.
- El stock y disponibilidad salen del mismo calculo usado por ventas internas.
