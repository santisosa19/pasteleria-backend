# Plan De Desarrollo

## Fase 0 - Base Tecnica

- Backend NestJS con configuracion, Swagger, seguridad HTTP y Prisma.
- Frontend React base.
- Modelo relacional inicial.
- Repos separados para frontend y backend.

## Fase 1 - Maestros Del Negocio

- Auth y usuarios.
- Roles basicos.
- Unidades de medida.
- Proveedores.
- Materias primas.
- Validaciones de alta/baja logica.

## Fase 2 - Recetas Y Costos

- CRUD de recetas.
- Ingredientes por receta.
- Conversion de unidades.
- Calculo de costo total y costo por rendimiento.
- Productos vendibles asociados a receta.

## Fase 3 - Compras E Inventario

- Registro de compras con items.
- Transacciones para entrada de stock.
- Costo promedio y ultimo costo.
- Movimientos de stock.
- Alertas de stock minimo.

## Fase 4 - Ventas Y Rentabilidad

- Registro de ventas.
- Validacion de disponibilidad.
- Descuento automatico por receta.
- Ganancia estimada.
- Reportes basicos.

## Fase 5 - Reportes Operativos

- Consumo por periodo.
- Margen por producto.
- Compras por proveedor.
- Ventas por periodo.
- Faltantes y reposicion sugerida.

## Fase 6 - Ecommerce

- Catalogo publico.
- Clientes.
- Pedidos online.
- Integracion Mercado Pago.
- Webhooks de pago.
- Estados de pedido.

## Estado Actual Backend

- Base tecnica completa.
- Maestros principales implementados.
- Recetas, productos, compras, inventario, ventas, reportes, clientes, pedidos y pagos implementados.
- Conversion de pedido a venta implementada.
- Cancelacion de venta con reversa de stock implementada.
- Auditoria de operaciones criticas implementada.
- Errores de API en espanol.

## Pendiente Antes Del Frontend

- Tests unitarios/integracion para flujos criticos.
- Documentar ejemplos de payload por endpoint.
- Revisar si `catalog` se deja para ecommerce o se agrega como lectura simple de productos publicados.

## Primeros Endpoints Recomendados

- `POST /auth/login`
- `GET /measurement-units`
- `POST /measurement-units`
- `GET /raw-materials`
- `POST /raw-materials`
- `POST /recipes`
- `GET /recipes/:id/cost`
- `POST /purchases`
- `GET /inventory/movements`
- `POST /sales`
- `POST /orders/:id/convert-to-sale`
- `POST /sales/:id/cancel`
