# Modelo Relacional Inicial

## Nucleo Administrativo

- `roles` 1:N `users`
- `suppliers` 1:N `purchases`
- `measurement_units` normaliza unidades y conversiones.
- `raw_materials` referencia su unidad base.

## Recetas Y Productos

- `recipes` 1:N `recipe_ingredients`
- `recipe_ingredients` N:1 `raw_materials`
- `recipe_ingredients` N:1 `measurement_units`
- `products` N:1 `recipes`, opcional para permitir productos futuros sin receta fija.

## Compras Y Stock

- `purchases` 1:N `purchase_items`
- `purchase_items` N:1 `raw_materials`
- `stock_movements` registra toda entrada, salida o ajuste de insumos.
- `stock_movements.source_type` y `source_id` permiten trazabilidad sin forzar una FK polimorfica.

## Ventas

- `sales` 1:N `sale_items`
- `sale_items` N:1 `products`
- `sales.order_id` permite convertir un pedido ecommerce en venta final.

## Ecommerce Futuro

- `customers` 1:N `orders`
- `orders` 1:N `order_items`
- `orders` 1:N `payments`
- `order_items` N:1 `products`

## Auditoria

- `audit_logs` guarda actor, accion, entidad, id de entidad y metadata.
- Se debe usar en operaciones criticas, no necesariamente en cada lectura.

## Decisiones De Diseno

- Los importes usan `Decimal`, no `Float`.
- Las cantidades de stock se guardan normalizadas en unidad base.
- Las unidades de compra/receta se guardan para trazabilidad historica.
- Los costos estimados de venta se guardan en `sale_items` para que reportes historicos no cambien si cambia el costo promedio.
- `orders` y `payments` existen desde el inicio para no rehacer el modelo al agregar ecommerce.
