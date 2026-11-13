# Guía de la base de datos

La base local está en el archivo `mvp_catalogo.db`. Es el lugar donde, en la siguiente etapa, se guardarán los datos de forma permanente.

## Tablas creadas

| Tabla | Contenido |
|---|---|
| `categorias_producto` | Familias o categorías de productos. |
| `unidades_medida` | Unidad, caja, kg, metro y otras medidas. |
| `productos` | Catálogo de productos. |
| `clientes` | Personas o empresas que cotizan o compran. |
| `usuarios` | Credenciales y rol de administración, cliente o ventas. |
| `perfiles_ventas` | Nombre, código, teléfono y documento del personal de ventas. |
| `cotizaciones` | Cabecera de cada cotización, con código `COT-XXXX`. |
| `detalle_cotizaciones` | Productos, cantidades y precios de una cotización. |
| `pedidos` | Cabecera de cada pedido, con código `PED-XXXX`. |
| `detalle_pedidos` | Productos, cantidades y precios de un pedido. |
| `historial_estados_pedido` | Registro de los cambios de estado del pedido. |
| `registro_auditoria_administrativa` | Actor, fecha, acción, tipo, nombre y campos modificados para clientes, usuarios de ventas, productos y categorías. |

## Relación entre las tablas

```text
categorias_producto ──┐
unidades_medida ──────┼── productos
                       │
clientes ── usuarios (rol cliente)
    │
    ├── cotizaciones ────── detalle_cotizaciones ── productos
    │       └── el teléfono se obtiene del cliente relacionado
    └── pedidos ─────────── detalle_pedidos ─────── productos
            │
            └── historial_estados_pedido

usuarios (rol ventas) ── perfiles_ventas
```

Todas las credenciales se administran en `usuarios`. Los datos exclusivos del personal comercial se mantienen en `perfiles_ventas`, relacionados uno a uno con su cuenta. Una cotización o un pedido puede incluir varios productos.

## Situación actual

La web ya está conectada a estas tablas. Al crear o editar un producto, enviar una cotización, crear un pedido o cambiar su estado, la información queda guardada en `mvp_catalogo.db`.

El panel administrativo conserva desde su implementación los cambios de clientes, usuarios de ventas, productos y categorías. El registro guarda el ID, correo y rol del actor, la acción, la entidad, el nombre del registro y los nombres de los campos afectados; no almacena contraseñas, hashes ni valores anteriores o nuevos. Los cambios anteriores a la implementación no se pueden reconstruir.

## Consulta de productos del ERP

La ruta administrativa `GET /api/erp/products` consulta en vivo, en modo de solo lectura, la tabla `public.producto` de PostgreSQL. Requiere una sesión de administración y devuelve `code`, `name`, `description` (vacía por ahora) y `referencePrice`. La ruta del catálogo actual (`/api/products`) sigue usando SQLite; esta consulta inicial no modifica la web pública ni las cotizaciones.

La consulta usa `codigo`, `nombre` y `precio_va`. La columna de precio se puede cambiar mediante `ERP_PRODUCT_PRICE_COLUMN` a `precio_com` o `precio_vb`. No se concatena un nombre de columna arbitrario en la consulta: solo se aceptan esas tres opciones.

Configura `ERP_DB_HOST`, `ERP_DB_PORT`, `ERP_DB_NAME`, `ERP_DB_USER` y `ERP_DB_PASSWORD` en el entorno privado del servidor. TLS se mantiene activo por defecto (`ERP_DB_SSL=true`); desactívalo solo si el administrador de PostgreSQL confirma que el servidor no lo admite. La cuenta debe tener permiso de lectura sobre `public.producto`. No incluyas credenciales en Git ni las compartas por chat.
