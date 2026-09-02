# Guía sencilla del código

Esta guía explica cómo está construida la primera versión de la plataforma. No necesitas entender programación para usarla: sirve para ubicar qué archivo modifica cada parte.

## La idea general

La aplicación tiene dos partes que trabajan juntas:

```text
Cliente en el navegador
        │
        │ visita la página y envía información
        ▼
Frontend (lo visible) ──────── Backend (la lógica)
  frontend/                         backend/
        │                                │
        └─────────── datos ──────────────┘
```

- **Frontend:** es la web que ve una persona: textos, botones, formularios, colores y pantallas.
- **Backend:** es el pequeño servidor local. Entrega las páginas y recibe los datos enviados por los formularios.

En este MVP todo funciona en tu laptop, en `http://localhost:3000`. Aún no se publica en internet ni se conecta con el ERP.

La base de datos local está en `base_de_datos/mvp_catalogo.db` y la web ya la utiliza para guardar productos, clientes, cotizaciones y pedidos. Por eso esos datos permanecen incluso al reiniciar la aplicación.

## Estructura de carpetas

```text
mvp-catalogo/
├── frontend/             Parte visual de la web
│   ├── index.html        Página pública
│   ├── styles.css        Colores y diseño
│   ├── app.js            Comportamiento de la página pública
│   ├── admin.html        Pantalla de administración
│   └── admin.js          Comportamiento del panel administrativo
├── backend/
│   └── server.js         Servidor y datos temporales
├── README.md             Cómo iniciar la aplicación
└── GUIA_CODIGO.md        Esta explicación
```

## Frontend: lo que ve el cliente

### `frontend/index.html` — página pública

Es el esqueleto de la web principal. Contiene estas secciones:

- Encabezado y menú.
- Portada con el mensaje principal de la empresa.
- Catálogo de productos.
- Sección “Sobre nosotros”.
- Formulario de cotización.
- Buscador de pedidos.

Aquí se cambian los textos fijos, por ejemplo el título de la portada o la descripción de la empresa. El catálogo no está escrito directamente en este archivo: se carga desde el backend para que se pueda administrar después.

### `frontend/styles.css` — apariencia

Define cómo se ve la web: colores, tamaño de letras, espacios, tarjetas de productos y adaptación para celular.

Al inicio están los colores principales:

```css
--navy: azul oscuro
--blue: azul
--gold: amarillo/dorado
```

Cambiar esos valores cambia los colores generales de la web. No es necesario modificar este archivo para añadir productos o cotizaciones.

### `frontend/app.js` — comportamiento de la página pública

Hace que la página pública sea interactiva. Sus tareas son:

1. Pedir al backend la lista de productos y mostrarlos como tarjetas.
2. Llevar un producto elegido al formulario de cotización.
3. Enviar una cotización al backend.
4. Consultar un pedido por su código, por ejemplo `PED-1001`.

La palabra `fetch` que aparece en este archivo significa “pedir información al servidor”. Por ejemplo, `fetch('/api/products')` pide los productos al backend.

### `frontend/admin.html` — panel de administración

Es la pantalla que se abre en `http://localhost:3000/admin`. Contiene:

- Formulario para crear productos.
- Lista para editar o eliminar productos.
- Lista de cotizaciones recibidas.
- Botón para preparar un pedido desde una cotización; solicita producto, cantidad, precio, unidad de medida y fecha estimada de entrega.
- Sección de clientes para crear, editar y retirar clientes del panel.
- Lista de pedidos y selector para cambiar su estado.

En esta etapa no tiene contraseña porque solo se usa en tu propia laptop durante el desarrollo. Antes de publicar la aplicación se debe proteger con acceso de administrador.

### `frontend/admin.js` — acciones del panel

Conecta los botones del panel con el backend:

- Crear producto.
- Editar producto.
- Cargar o reemplazar la imagen de un producto.
- Eliminar producto.
- Ver cotizaciones.
- Mostrar el formulario y crear un pedido asociado a una cotización.
- Gestionar clientes desde el panel de administración.
- Cambiar el estado de un pedido.

También evita que un texto ingresado se interprete como código dentro de la página, una precaución básica de seguridad.

## Backend: la lógica y los datos

### `backend/server.js`

Es el archivo más importante del lado del servidor. Al ejecutar:

```powershell
node backend/server.js
```

este archivo pone en marcha la aplicación y la deja disponible en `http://localhost:3000`.

Cumple tres funciones:

1. **Entrega los archivos visuales.** Por ejemplo, cuando visitas la dirección principal, entrega `index.html`; al visitar `/admin`, entrega `admin.html`.
2. **Guarda los datos de prueba.** Al comienzo del archivo están los productos y pedidos iniciales.
3. **Responde a solicitudes internas.** Estas rutas son la conversación entre frontend y backend:

| Ruta | Qué hace | Quién la usa |
|---|---|---|
| `GET /api/products` | Devuelve el catálogo. | Página pública y panel. |
| `POST /api/products` | Crea un producto. | Panel. |
| `PATCH /api/products/:id` | Actualiza un producto. | Panel. |
| `DELETE /api/products/:id` | Elimina un producto. | Panel. |
| `GET /api/orders` | Devuelve todos los pedidos. | Panel. |
| `GET /api/orders/:código` | Busca un pedido concreto. | Página pública. |
| `PATCH /api/orders/:código` | Cambia el estado de un pedido. | Panel. |
| `GET /api/quotes` | Devuelve cotizaciones recibidas. | Panel. |
| `POST /api/quotes` | Recibe una cotización. | Página pública. |
| `POST /api/quotes/:id/orders` | Crea un pedido desde una cotización. | Panel. |

`GET` significa “consultar”, `POST` significa “crear o enviar”, `PATCH` significa “actualizar” y `DELETE` significa “eliminar”. Son solo nombres estándar para acciones de la web.

## Datos temporales: limitación importante

Actualmente los productos, cotizaciones, pedidos y cambios de estado se guardan en la base de datos local. Esto quiere decir que permanecen al detener o reiniciar el servidor.

Como la base está solo en tu laptop, todavía no está disponible para otros equipos ni sirve como copia de seguridad. Eso se resolverá al llevarla a una base de datos en la nube.

## Cómo probar el flujo completo

1. Abre la web pública: `http://localhost:3000`.
2. Selecciona un producto y envía una cotización.
3. Abre el panel: `http://localhost:3000/admin`.
4. En “Cotizaciones recibidas” verás la solicitud que acabas de enviar.
5. Cambia el estado del pedido `PED-1001`.
6. Vuelve a la página pública y consulta `PED-1001`; verás el nuevo estado.

## Cambios habituales y dónde hacerlos

| Quiero cambiar… | Archivo o lugar |
|---|---|
| Texto de la portada o empresa | `frontend/index.html` |
| Colores y apariencia | `frontend/styles.css` |
| Imagen de un producto | Panel de administración → Productos → Crear o Editar |
| Productos iniciales de prueba | `backend/server.js` |
| Pedidos iniciales de prueba | `backend/server.js` |
| Lo que hace un botón de la web | `frontend/app.js` |
| Lo que hace el panel | `frontend/admin.js` |

## Próximos pasos recomendados

1. Personalizar el contenido con la identidad real de la empresa, productos e imágenes.
2. Añadir un acceso seguro para administradores.
3. Reemplazar los datos temporales por una base de datos.
4. Preparar la integración futura con el ERP.

No hace falta hacer esos pasos ahora para seguir probando el MVP local.
