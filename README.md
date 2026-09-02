# MVP Catálogo y Cotizaciones

Primera versión local de la plataforma. No requiere cuentas externas ni AWS.

## Qué incluye

- Página principal de la empresa.
- Catálogo de productos de ejemplo.
- Formulario para solicitar una cotización.
- Consulta de un pedido de ejemplo (`PED-1001`).

## Cómo iniciarlo

1. Abre una nueva ventana de PowerShell o reinicia Codex para que reconozca Node.js.
2. Entra a esta carpeta:

   ```powershell
   cd "C:\Users\javie\Documents\Codex\2026-08-30\referenced-chatgpt-conversation-this-is-an\mvp-catalogo"
   ```

3. Inicia la aplicación:

   ```powershell
   node backend/server.js
   ```

4. Abre `http://localhost:3000` en el navegador.

Para detenerla, vuelve a PowerShell y presiona `Ctrl + C`.

## Estructura

- `frontend/`: la parte visual que ve el cliente.
- `backend/`: la lógica que recibe cotizaciones y consulta pedidos.

Los productos, el nombre de la empresa y el pedido de prueba están en `backend/server.js` para poder cambiarlos fácilmente en esta etapa.

Si quieres entender cómo se relacionan las partes del proyecto, lee [GUIA_CODIGO.md](GUIA_CODIGO.md).

## Base de datos local

Las tablas de la base de datos están definidas en `base_de_datos/esquema.sql`. Para crear o actualizar la base local, ejecuta:

```powershell
node base_de_datos/crear_base_de_datos.js
```
