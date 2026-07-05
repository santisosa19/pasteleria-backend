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

## Cancelacion De Venta

1. Una venta confirmada no se edita ni se borra.
2. Si fue cargada mal, el usuario ejecuta una cancelacion/reversa.
3. El sistema marca `sale.status` como `CANCELLED`.
4. Se crean movimientos `ADJUSTMENT_IN` vinculados a la venta para devolver stock.
5. Los items, importes y costos historicos de la venta quedan intactos.
6. Si corresponde, el usuario registra una nueva venta correcta.
7. En una integracion fiscal futura, este flujo puede mapearse a una nota de credito.

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

## Pedido Interno A Venta

1. El usuario crea un pedido con productos, cantidades y cliente opcional.
2. El pedido no descuenta stock al crearse.
3. El usuario confirma o avanza el estado del pedido.
4. Al convertir el pedido en venta, el sistema valida recetas, insumos y stock.
5. Se crea `sale` vinculada a `order_id`.
6. Se crean `sale_items`, movimientos `SALE_OUT` y se descuenta stock.
7. El pedido pasa a `DELIVERED` y queda trazado con su venta.

## Pagos Manuales

1. El usuario puede registrar pagos manuales/ficticios asociados a pedidos.
2. El proveedor por defecto es `manual`.
3. El sistema evita sobrepagar un pedido.
4. Los campos `provider`, `provider_payment_id` y `raw_payload` dejan la base lista para Mercado Pago.

## Regla Importante De Stock

El sistema debe evitar stock negativo salvo que exista una configuracion explicita para permitirlo. Para una pasteleria chica, lo recomendable es bloquear venta/produccion si faltan insumos y mostrar faltantes.
