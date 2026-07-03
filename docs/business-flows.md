# Flujos De Negocio

## Compra De Insumos

1. El usuario registra una compra con proveedor, fecha e items.
2. Cada item declara insumo, cantidad, unidad y costo unitario.
3. El sistema convierte cada cantidad a la unidad base del insumo.
4. En una transaccion se crean `purchase`, `purchase_items` y `stock_movements` tipo `PURCHASE_IN`.
5. Se actualiza `raw_materials.current_stock`.
6. Se actualiza `average_cost` y `last_purchase_cost`.
7. Se registra auditoria.

## Costeo De Receta

1. La receta contiene ingredientes con cantidad y unidad.
2. Cada ingrediente se normaliza a la unidad base del insumo.
3. El costo del ingrediente se calcula con `raw_material.average_cost`.
4. El costo total de receta es la suma de ingredientes.
5. El costo unitario se obtiene dividiendo por `yield_quantity`.

## Venta Interna

1. El usuario registra productos y cantidades.
2. El sistema calcula subtotal, descuento, total y costo estimado.
3. Se valida disponibilidad de insumos segun receta de cada producto.
4. En una transaccion se crean `sale`, `sale_items` y movimientos `SALE_OUT` por insumo consumido.
5. Se descuenta `raw_materials.current_stock`.
6. Se congela `unit_cost_estimate` y `profit_estimate` en cada item.
7. Se registra auditoria.

## Ajuste De Stock

1. El usuario elige insumo, tipo de ajuste, cantidad y motivo.
2. El sistema convierte la cantidad a unidad base.
3. Se crea un `stock_movement` tipo `ADJUSTMENT_IN` o `ADJUSTMENT_OUT`.
4. Se actualiza el stock actual.
5. Se registra auditoria.

## Pedido Ecommerce Futuro

1. El cliente crea un pedido desde catalogo.
2. El backend crea `order` y `order_items` con estado `PENDING`.
3. Mercado Pago confirma el pago por webhook.
4. El backend actualiza `payment` y pasa el pedido a `CONFIRMED`.
5. Al producir o entregar se genera la venta y el descuento definitivo de stock.

## Regla Importante De Stock

El sistema debe evitar stock negativo salvo que exista una configuracion explicita para permitirlo. Para una pasteleria chica, lo recomendable es bloquear venta/produccion si faltan insumos y mostrar faltantes.
