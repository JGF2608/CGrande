# Guía de despliegue a producción — Windows Server

Esta guía aplica a la versión actual de Costa Grande: una aplicación Node.js con una sola instancia, base de datos SQLite y archivos locales para imágenes y CVs. Web, base de datos y adjuntos vivirán en el mismo servidor.

## 1. Datos que debe facilitar el cliente

- Servidor **Windows Server 2022 o posterior**, 64 bits, con IP pública fija.
- Acceso por RDP para el administrador técnico y una cuenta administradora del servidor.
- Dominio o subdominio definitivo, por ejemplo `www.empresa.pe`, y acceso a su DNS.
- Al menos 2 vCPU, 4 GB de RAM y 40 GB de disco SSD. Aumentar el disco según los CVs esperados: cada CV puede ocupar hasta 5 MB.
- Permiso para abrir los puertos públicos 80 (HTTP) y 443 (HTTPS). El puerto 3389/RDP debe limitarse a IPs o VPN de confianza.
- Salida SMTP segura hacia el servidor de correo y salida HTTPS para Google Maps.

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
4. Añadir cabeceras de seguridad adicionales.

La aplicación actual puede funcionar en Windows sin estos cambios, pero esos cuatro puntos se deben completar antes de la salida pública. No se debe publicar la copia que conserve la cuenta y contraseña inicial de desarrollo.

La protección contra abuso ya está incorporada: máximo de 240 solicitudes por minuto por IP, límite de 30 intentos de inicio de sesión por IP cada 15 minutos, bloqueo tras 10 fallos por IP o 5 fallos por cuenta durante 15 minutos, límite de 3 MB para solicitudes JSON, 5 MB para CVs y tiempos de conexión acotados. Estas cifras se pueden ajustar si el tráfico real lo requiere.

## 3. Estructura recomendada en el servidor

Usar una carpeta fuera de `C:\inetpub\wwwroot` para que la base de datos, CVs y `.env` nunca sean accesibles como archivos web. Cada versión de código vive separada de los datos:

```text
C:\CostaGrande\
├── current\                     Enlace a la versión de código activa
├── releases\                    Versiones desplegadas: v1.0.0, v1.1.0, etc.
├── data\
│   ├── mvp_catalogo.db           Base de datos SQLite
│   ├── analitica.db              Datos de analítica
│   └── uploads\                 Imágenes y CVs adjuntos
├── config\
│   └── costa-grande.env          Secretos; no copiar a Git
├── backups\                      Copias comprimidas de datos y configuración
├── logs\                         Salida de Node/Caddy
└── scripts\                      Scripts de actualización y respaldo
```

`APP_DATA_DIR` permite que la aplicación use `C:\CostaGrande\data` sin modificar el código en cada despliegue. El usuario que ejecute el servicio debe tener lectura y escritura solamente en `data`, `config`, `logs` y `backups`.

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
   New-Item -ItemType Directory -Force -Path C:\CostaGrande\releases,C:\CostaGrande\data,C:\CostaGrande\config,C:\CostaGrande\backups,C:\CostaGrande\logs,C:\CostaGrande\scripts,C:\Caddy
   ```

## 5. Copiar la aplicación y los datos iniciales

1. Detener el servidor local antes de tomar la copia final, para no copiar SQLite durante una escritura.
2. Crear un paquete de versión desde desarrollo. Por ejemplo:

   ```powershell
   .\scripts\Crear-Paquete-Version.ps1 -Version 1.0.0
   ```

   El paquete excluye `.env`, bases `.db`, `uploads`, `.git` y `node_modules`.
3. Copiar el paquete y los dos scripts de `scripts\` al servidor. Crear primero `C:\CostaGrande\config\costa-grande.env` según la sección 6.
4. Antes de la primera actualización, copiar explícitamente los datos que deben conservarse en `C:\CostaGrande\data`:

   ```text
   base_de_datos\mvp_catalogo.db
   base_de_datos\analitica.db
   base_de_datos\uploads\
   ```

5. Confirmar que `C:\CostaGrande\data\uploads\` contiene las imágenes y CVs existentes.
6. Ejecutar la primera actualización:

   ```powershell
   C:\CostaGrande\scripts\Actualizar-CostaGrande.ps1 -PackagePath C:\Ruta\CostaGrande-v1.0.0.zip
   ```

7. No ejecutar `crear_base_de_datos.js` sobre una base con datos reales, salvo que se haya tomado una copia y se haya validado el cambio.

## 6. Crear el archivo de producción `.env`

Crear `C:\CostaGrande\config\costa-grande.env` manualmente y dar acceso solo al administrador y al usuario del servicio. Nunca copiar este archivo al repositorio.

```env
PORT=3000
MAX_CONNECTIONS=500
APP_DATA_DIR=C:\CostaGrande\data
APP_ENV_FILE=C:\CostaGrande\config\costa-grande.env
EMAIL_NOTIFICATIONS_ENABLED=true
SMTP_HOST=costagrande.com.pe
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=ventas@costagrande.com.pe
SMTP_PASSWORD=REEMPLAZAR_CON_LA_CONTRASEÑA_REAL
SMTP_FROM=ventas@costagrande.com.pe
EMAIL_TEST_RECIPIENT=correo-pruebas@empresa.pe
EMAIL_SALES_RECIPIENT=ventas@costagrande.com.pe
GOOGLE_MAPS_API_KEY=REEMPLAZAR_CON_LA_CLAVE_REAL
ANALYTICS_ENABLED=true
```

- `EMAIL_SALES_RECIPIENT`: correo corporativo que recibe las cotizaciones en producción.
- `MAX_CONNECTIONS`: protección adicional del proceso Node; mantener Caddy como punto de entrada público.
- `SMTP_FROM`: remitente de la cuenta corporativa configurada en cPanel.
- En cPanel, comprobar la configuración SPF y DKIM desde la sección de entregabilidad del correo.
- En Google Cloud, restringir la clave de Maps al dominio final (`https://www.empresa.pe/*` y, si corresponde, `https://empresa.pe/*`).

## 7. Prueba local en el servidor

Desde PowerShell, con la aplicación copiada:

```powershell
Set-Location C:\CostaGrande\current
node --env-file=C:\CostaGrande\config\costa-grande.env backend\server.js
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
C:\nssm\win64\nssm.exe set CostaGrandeApp AppDirectory "C:\CostaGrande\current"
C:\nssm\win64\nssm.exe set CostaGrandeApp AppParameters "--env-file=C:\CostaGrande\config\costa-grande.env backend\server.js"
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
- La aplicación limita solicitudes por IP, intentos de inicio de sesión y el tamaño de solicitudes. Estas medidas mitigan abuso a nivel aplicación, pero no sustituyen un firewall, el proxy Caddy ni protección anti-DDoS del proveedor de red.

## 11. Backup diario

El backup debe contener, como mínimo, `mvp_catalogo.db`, `analitica.db`, `uploads` y una copia cifrada/segura de `costa-grande.env`. Guardar una copia fuera del mismo servidor (OneDrive empresarial, NAS, S3 u otro repositorio autorizado).

Antes de copiar el archivo SQLite, detener brevemente el servicio para mantener una copia consistente:

```powershell
Stop-Service CostaGrandeApp
$fecha = Get-Date -Format 'yyyy-MM-dd_HH-mm'
Compress-Archive -Path C:\CostaGrande\data\mvp_catalogo.db,C:\CostaGrande\data\analitica.db,C:\CostaGrande\data\uploads,C:\CostaGrande\config\costa-grande.env -DestinationPath "C:\CostaGrande\backups\costa-grande_$fecha.zip"
Start-Service CostaGrandeApp
```

Programar este proceso diariamente mediante el Programador de tareas de Windows y verificar periódicamente una restauración en un entorno de prueba.

## 12. Validación final antes de publicar

1. El dominio abre por `https://` y no muestra advertencias de certificado.
2. `http://` redirige a HTTPS.
3. El puerto 3000 no responde desde otra computadora.
4. El favicon, imágenes, popup y banners cargan correctamente.
5. Se recibe una cotización en `EMAIL_SALES_RECIPIENT`.
6. Se carga y descarga un CV desde administración.
7. Se reinicia el servidor y los dos servicios vuelven a iniciar automáticamente.
8. Se ejecuta una copia de seguridad y se verifica que contiene la BD y `uploads`.
9. Se cambian o eliminan todas las cuentas, contraseñas y datos de prueba.

## Notas de capacidad

SQLite es adecuada para este MVP en un único servidor y una única instancia de Node. No se debe ejecutar la aplicación en varios procesos/servidores a la vez con la misma base de datos. Si el volumen de usuarios, cotizaciones o gestión simultánea aumenta de forma importante, el siguiente paso será migrar a PostgreSQL o SQL Server y usar sesiones persistentes.
