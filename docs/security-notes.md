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

## Auditoria npm

`npm audit --omit=dev` reporta una vulnerabilidad alta en `multer` traida por `@nestjs/platform-express`, que Nest instala como dependencia opcional de `@nestjs/core` aunque este backend usa `@nestjs/platform-fastify`.

Estado actual:

- La aplicacion no usa Express.
- La aplicacion no registra endpoints de upload.
- `@nestjs/platform-express` no esta declarado en `package.json`.
- `npm audit fix --force` propone cambios de major/downgrade no aceptables.

Accion recomendada:

- Mantener Fastify.
- No agregar upload de archivos sin diseno especifico.
- Reintentar auditoria al actualizar Node a 20.19+ o 22 LTS y subir dependencias Nest cuando exista fix limpio.
- En CI productivo, auditar tambien con `npm audit --omit=dev --omit=optional` para distinguir runtime real de dependencias opcionales instaladas por npm.

## Recomendaciones Para Produccion

- Usar secretos largos y rotacion de refresh tokens.
- Activar rate limiting en `auth`.
- Registrar auditoria en compras, ventas, ajustes de stock, pagos y cambios de precio.
- Usar HTTPS detras de reverse proxy.
- No exponer Swagger publicamente sin proteccion.
