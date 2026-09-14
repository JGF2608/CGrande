# Guía de despliegue a producción — Windows Server

Esta guía aplica a la versión actual de Costa Grande: una aplicación Node.js con una sola instancia, base de datos SQLite y archivos locales para imágenes y CVs. Web, base de datos y adjuntos vivirán en el mismo servidor.

## 1. Datos que debe facilitar el cliente

- Servidor **Windows Server 2022 o posterior**, 64 bits, con IP pública fija.
- Acceso por RDP para el administrador técnico y una cuenta administradora del servidor.
- Dominio o subdominio definitivo, por ejemplo `www.empresa.pe`, y acceso a su DNS.
- Al menos 2 vCPU, 4 GB de RAM y 40 GB de disco SSD. Aumentar el disco según los CVs esperados: cada CV puede ocupar hasta 5 MB.
- Permiso para abrir los puertos públicos 80 (HTTP) y 443 (HTTPS). El puerto 3389/RDP debe limitarse a IPs o VPN de confianza.
- Salida HTTPS a Internet para Resend y Google Maps.

## 2. Qué es infraestructura y qué requiere ajuste de código

### Infraestructura (no modifica la aplicación)

- Instalar Node.js, Caddy, NSSM y las actualizaciones de Windows.
- Configurar DNS, HTTPS, firewall, servicio de Windows, copias de seguridad y monitoreo.
- Copiar la aplicación, la base de datos y las carpetas de archivos al servidor.
- Crear el archivo privado `.env` con claves de correo y Google Maps.

### Ajustes de código recomendados antes de abrir el sitio al público

1. Hacer que Node escuche solo en `127.0.0.1`; Caddy será el único componente expuesto a Internet.
2. Marcar la cookie de sesión como `Secure` en producción, para que solo viaje por HTTPS.
3. Eliminar/cambiar las credenciales iniciales de desarrollo (`admin@empresa.local` / `admin123`) y definir un administrador de producción seguro.
4. Añadir cabeceras de seguridad y límite de intentos al inicio de sesión.

La aplicación actual puede funcionar en Windows sin estos cambios, pero esos cuatro puntos se deben completar antes de la salida pública. No se debe publicar la copia que conserve la cuenta y contraseña inicial de desarrollo.

## 3. Estructura recomendada en el servidor

Usar una carpeta fuera de `C:\inetpub\wwwroot` para que la base de datos, CVs y `.env` nunca sean accesibles como archivos web:

```text
C:\CostaGrande\
├── app\                         Código de la aplicación
│   ├── backend\
│   ├── frontend\
│   ├── base_de_datos\
│   │   ├── mvp_catalogo.db       Base de datos SQLite
│   │   └── uploads\             Imágenes y CVs adjuntos
│   └── .env                      Secretos; no copiar a Git
├── backups\                      Copias comprimidas y temporales
├── logs\                         Salida de Node/Caddy
└── scripts\                      Script de copia de seguridad
```

El usuario que ejecute el servicio debe tener lectura y escritura solamente en `C:\CostaGrande\app\base_de_datos\`, `uploads`, `logs` y `backups`.

## 4. Instalación de componentes

1. Aplicar las actualizaciones de Windows y reiniciar el servidor.
2. Instalar Node.js **22 LTS x64**. Verificar desde PowerShell:

   ```powershell
   node --version
   ```

3. Descargar Caddy para Windows y dejar `caddy.exe` en `C:\Caddy\caddy.exe`.
4. Descargar NSSM (Non-Sucking Service Manager) y dejar `nssm.exe` en `C:\nssm\win64\nssm.exe`. Se usará para que Node y Caddy se inicien solos tras cada reinicio.
5. Crear las carpetas:

   ```powershell
   New-Item -ItemType Directory -Force -Path C:\CostaGrande\app,C:\CostaGrande\backups,C:\CostaGrande\logs,C:\CostaGrande\scripts,C:\Caddy
   ```

## 5. Copiar la aplicación y los datos iniciales

1. Detener el servidor local antes de tomar la copia final, para no copiar SQLite durante una escritura.
2. Copiar todo el contenido del proyecto a `C:\CostaGrande\app`, excluyendo `.git`, `node_modules` y el `.env` de desarrollo.
3. Copiar explícitamente los datos que deben conservarse:

   ```text
   base_de_datos\mvp_catalogo.db
   base_de_datos\uploads\
   ```

4. Confirmar que `C:\CostaGrande\app\base_de_datos\uploads\` contiene las imágenes y CVs existentes.
5. No ejecutar `crear_base_de_datos.js` sobre una base con datos reales, salvo que se haya tomado una copia y se haya validado el cambio.

## 6. Crear el archivo de producción `.env`

Crear `C:\CostaGrande\app\.env` manualmente y dar acceso solo al administrador y al usuario del servicio. Nunca copiar este archivo al repositorio.

```env
PORT=3000
EMAIL_NOTIFICATIONS_ENABLED=true
RESEND_API_KEY=REEMPLAZAR_CON_LA_CLAVE_REAL
RESEND_TEST_RECIPIENT=correo-pruebas@empresa.pe
RESEND_SALES_RECIPIENT=correo-corporativo@empresa.pe
RESEND_FROM=notificaciones@empresa.pe
GOOGLE_MAPS_API_KEY=REEMPLAZAR_CON_LA_CLAVE_REAL
ANALYTICS_ENABLED=true
```

- `RESEND_SALES_RECIPIENT`: correo corporativo que recibe las cotizaciones en producción.
- `RESEND_FROM`: remitente perteneciente a un dominio validado en Resend.
- En Resend, validar el dominio corporativo mediante sus registros DNS SPF/DKIM antes de activar los avisos.
- En Google Cloud, restringir la clave de Maps al dominio final (`https://www.empresa.pe/*` y, si corresponde, `https://empresa.pe/*`).

## 7. Prueba local en el servidor

Desde PowerShell, con la aplicación copiada:

```powershell
Set-Location C:\CostaGrande\app
node --env-file=.env backend\server.js
```

En el propio servidor, abrir `http://localhost:3000`. Verificar página pública, inicio de sesión, administración, carga de imagen, cotización, CV y descarga de CV. Detener con `Ctrl+C` antes de crear los servicios.

## 8. HTTPS con Caddy

Crear `C:\Caddy\Caddyfile` sustituyendo el dominio:

```caddyfile
www.empresa.pe, empresa.pe {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

Cuando el DNS del dominio ya apunte al servidor, Caddy solicitará y renovará automáticamente el certificado HTTPS. No poner la base de datos ni `uploads` como un sitio estático de IIS o Caddy: Caddy solo debe redirigir las solicitudes a Node.

## 9. Servicios de Windows

Crear primero el servicio de Node con NSSM:

```powershell
C:\nssm\win64\nssm.exe install CostaGrandeApp "C:\Program Files\nodejs\node.exe"
C:\nssm\win64\nssm.exe set CostaGrandeApp AppDirectory "C:\CostaGrande\app"
C:\nssm\win64\nssm.exe set CostaGrandeApp AppParameters "--env-file=.env backend\server.js"
C:\nssm\win64\nssm.exe set CostaGrandeApp AppStdout "C:\CostaGrande\logs\app-out.log"
C:\nssm\win64\nssm.exe set CostaGrandeApp AppStderr "C:\CostaGrande\logs\app-error.log"
C:\nssm\win64\nssm.exe set CostaGrandeApp Start SERVICE_AUTO_START
Start-Service CostaGrandeApp
```

Crear el servicio de Caddy:

```powershell
C:\nssm\win64\nssm.exe install CostaGrandeProxy "C:\Caddy\caddy.exe"
C:\nssm\win64\nssm.exe set CostaGrandeProxy AppDirectory "C:\Caddy"
C:\nssm\win64\nssm.exe set CostaGrandeProxy AppParameters "run --config C:\Caddy\Caddyfile"
C:\nssm\win64\nssm.exe set CostaGrandeProxy AppStdout "C:\CostaGrande\logs\caddy-out.log"
C:\nssm\win64\nssm.exe set CostaGrandeProxy AppStderr "C:\CostaGrande\logs\caddy-error.log"
C:\nssm\win64\nssm.exe set CostaGrandeProxy Start SERVICE_AUTO_START
Start-Service CostaGrandeProxy
```

Comprobar estado:

```powershell
Get-Service CostaGrandeApp,CostaGrandeProxy
```

## 10. Firewall y acceso

- Permitir entradas TCP 80 y 443 para Caddy.
- Bloquear entrada externa a 3000. El acceso de Node debe ser solo local.
- Limitar RDP (3389) a VPN o IPs administrativas autorizadas.
- Proteger el acceso a `/admin` con cuentas, contraseñas robustas y HTTPS. No dejar usuarios de ejemplo activos.

## 11. Backup diario

El backup debe contener, como mínimo, `mvp_catalogo.db`, `uploads` y una copia cifrada/segura de `.env`. Guardar una copia fuera del mismo servidor (OneDrive empresarial, NAS, S3 u otro repositorio autorizado).

Antes de copiar el archivo SQLite, detener brevemente el servicio para mantener una copia consistente:

```powershell
Stop-Service CostaGrandeApp
$fecha = Get-Date -Format 'yyyy-MM-dd_HH-mm'
Compress-Archive -Path C:\CostaGrande\app\base_de_datos\mvp_catalogo.db,C:\CostaGrande\app\base_de_datos\uploads -DestinationPath "C:\CostaGrande\backups\costa-grande_$fecha.zip"
Start-Service CostaGrandeApp
```

Programar este proceso diariamente mediante el Programador de tareas de Windows y verificar periódicamente una restauración en un entorno de prueba.

## 12. Validación final antes de publicar

1. El dominio abre por `https://` y no muestra advertencias de certificado.
2. `http://` redirige a HTTPS.
3. El puerto 3000 no responde desde otra computadora.
4. El favicon, imágenes, popup y banners cargan correctamente.
5. Se recibe una cotización en `RESEND_SALES_RECIPIENT`.
6. Se carga y descarga un CV desde administración.
7. Se reinicia el servidor y los dos servicios vuelven a iniciar automáticamente.
8. Se ejecuta una copia de seguridad y se verifica que contiene la BD y `uploads`.
9. Se cambian o eliminan todas las cuentas, contraseñas y datos de prueba.

## Notas de capacidad

SQLite es adecuada para este MVP en un único servidor y una única instancia de Node. No se debe ejecutar la aplicación en varios procesos/servidores a la vez con la misma base de datos. Si el volumen de usuarios, cotizaciones o gestión simultánea aumenta de forma importante, el siguiente paso será migrar a PostgreSQL o SQL Server y usar sesiones persistentes.
