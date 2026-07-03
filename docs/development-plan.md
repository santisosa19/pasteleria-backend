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
