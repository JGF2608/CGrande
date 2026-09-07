# Módulo de Analítica y KPIs

Este módulo está separado de catálogo, clientes, cotizaciones y pedidos. Mantiene los eventos de navegación en `base_de_datos/analitica.db`, una base de datos distinta de la transaccional.

## Activación

El interruptor se encuentra únicamente en el archivo privado `.env`:

```text
ANALYTICS_ENABLED=true
```

Con `false`, la web no registra eventos y el Dashboard informa que el módulo está desactivado.

## Contratos

- `POST /api/analytics/events`: recibe eventos anónimos permitidos.
- `GET /api/analytics/config`: comunica al frontend si la captura está activa.
- `GET /api/analytics/dashboard`: entrega indicadores a Administración.

Los eventos no incluyen nombres, correos, contraseñas ni direcciones IP. La aplicación solo persiste un identificador de sesión anónimo guardado en el navegador.

El Dashboard solicita el resumen comercial mediante `getAnalyticsSnapshot()`. Esta interfaz es el límite entre el módulo de analítica y el módulo transaccional; al migrar a un microservicio, puede reemplazarse por una API interna o una cola de eventos sin cambiar la vista administrativa.
