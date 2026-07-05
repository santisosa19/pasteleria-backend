# Notas De Seguridad

## Decisiones Aplicadas

- Fastify como adapter HTTP para evitar depender operativamente de Express.
- `@fastify/helmet` habilitado en el bootstrap.
- CORS configurable por `CORS_ORIGIN`.
- `ValidationPipe` global con `whitelist`, `transform` y `forbidNonWhitelisted`.
- Secrets por variables de entorno.
- Modelo preparado para auditoria con `audit_logs`.
- Passwords pensados para hash con `bcrypt`.
- Tokens JWT separados para access y refresh.
- Validacion de variables criticas al arrancar.
- Rate limit simple en memoria para `POST /auth/login`.
- Swagger deshabilitado en produccion salvo `SWAGGER_ENABLED=true`.
- Errores de API en espanol para consumo directo del frontend.
- Auditoria registrada en compras, ajustes de stock, ventas, cancelaciones, pedidos y pagos.

## Auditoria npm

`npm audit --omit=dev --omit=optional` reporta una vulnerabilidad moderada en `@fastify/static`.

Estado actual:

- La aplicacion usa Fastify.
- Swagger puede depender de recursos estaticos en desarrollo.
- `npm audit fix --force` propone subir a una version con breaking changes.

Accion recomendada:

- Mantener Swagger deshabilitado en produccion salvo necesidad explicita.
- No ejecutar `npm audit fix --force` sin revisar breaking changes.
- Reintentar auditoria al actualizar Node a 20.19+ o 22 LTS y subir dependencias Fastify/Nest cuando exista fix limpio.

## Recomendaciones Para Produccion

- Usar secretos largos y rotacion de refresh tokens.
- Persistir rate limiting en Redis si la app pasa a multiples instancias.
- Agregar tests de seguridad para auth, permisos y rate limit.
- Usar HTTPS detras de reverse proxy.
- No exponer Swagger publicamente sin proteccion explicita.
