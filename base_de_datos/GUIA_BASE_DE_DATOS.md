# Guía de la base de datos

La base local está en el archivo `mvp_catalogo.db`. Es el lugar donde, en la siguiente etapa, se guardarán los datos de forma permanente.

## Tablas creadas

| Tabla | Contenido |
|---|---|
| `categorias_producto` | Familias o categorías de productos. |
| `unidades_medida` | Unidad, caja, kg, metro y otras medidas. |
| `productos` | Catálogo de productos. |
| `clientes` | Personas o empresas que cotizan o compran. |
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
clientes ── cotizaciones ── detalle_cotizaciones ── productos
    │
    └── pedidos ─────────── detalle_pedidos ─────── productos
            │
            └── historial_estados_pedido
```

Una cotización o un pedido puede incluir varios productos. Esto permite que la plataforma crezca sin cambiar la estructura principal.

## Situación actual

La web ya está conectada a estas tablas. Al crear o editar un producto, enviar una cotización, crear un pedido o cambiar su estado, la información queda guardada en `mvp_catalogo.db`.
