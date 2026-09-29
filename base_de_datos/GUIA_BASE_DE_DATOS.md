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
