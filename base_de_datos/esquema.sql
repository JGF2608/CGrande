PRAGMA foreign_keys = ON;

-- Datos maestros
CREATE TABLE IF NOT EXISTS categorias_producto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  id_categoria_padre INTEGER,
  imagen_url TEXT,
  fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  FOREIGN KEY (id_categoria_padre) REFERENCES categorias_producto(id)
);

CREATE TABLE IF NOT EXISTS unidades_medida (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  abreviatura TEXT NOT NULL UNIQUE,
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);

CREATE TABLE IF NOT EXISTS configuracion_empresa (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  numero_whatsapp TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  linkedin_url TEXT,
  clientes_historicos INTEGER NOT NULL DEFAULT 0 CHECK (clientes_historicos >= 0),
  fecha_actualizacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kpis_adicionales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  valor TEXT NOT NULL,
  descripcion TEXT,
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hitos_historia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anio INTEGER NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  imagen_url TEXT,
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Contenido comercial visible al inicio de la web.
CREATE TABLE IF NOT EXISTS banners_publicitarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  texto_boton TEXT,
  enlace TEXT,
  imagen_url TEXT,
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TEXT
);

CREATE TABLE IF NOT EXISTS socios_comerciales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  imagen_url TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TEXT
);

CREATE TABLE IF NOT EXISTS puntos_atencion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL,
  latitud REAL,
  longitud REAL,
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TEXT
);

CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio_referencial NUMERIC NOT NULL DEFAULT 0 CHECK (precio_referencial >= 0),
  id_categoria INTEGER,
  id_unidad_medida INTEGER,
  imagen_url TEXT,
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TEXT,
  FOREIGN KEY (id_categoria) REFERENCES categorias_producto(id),
  FOREIGN KEY (id_unidad_medida) REFERENCES unidades_medida(id)
);

-- Clientes y cotizaciones
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo_documento TEXT,
  numero_documento TEXT,
  razon_social TEXT,
  nombre_contacto TEXT NOT NULL,
  correo TEXT NOT NULL UNIQUE,
  telefono TEXT,
  direccion TEXT,
  departamento TEXT,
  provincia TEXT,
  distrito TEXT,
  fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cliente INTEGER,
  correo TEXT NOT NULL UNIQUE,
  contrasena_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('administracion', 'cliente')),
  requiere_cambio_contrasena INTEGER NOT NULL DEFAULT 0 CHECK (requiere_cambio_contrasena IN (0, 1)),
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_cliente) REFERENCES clientes(id)
);

CREATE TABLE IF NOT EXISTS usuarios_ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL UNIQUE,
  codigo_usuario TEXT NOT NULL UNIQUE,
  telefono TEXT NOT NULL,
  numero_documento TEXT NOT NULL,
  contrasena_hash TEXT NOT NULL,
  requiere_cambio_contrasena INTEGER NOT NULL DEFAULT 1 CHECK (requiere_cambio_contrasena IN (0, 1)),
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cotizaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  id_cliente INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Enviada', 'Aceptada', 'Rechazada', 'Vencida')),
  fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_vencimiento TEXT,
  observaciones TEXT,
  FOREIGN KEY (id_cliente) REFERENCES clientes(id)
);

CREATE TABLE IF NOT EXISTS detalle_cotizaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_cotizacion INTEGER NOT NULL,
  id_producto INTEGER,
  descripcion_producto TEXT NOT NULL,
  cantidad NUMERIC NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC NOT NULL CHECK (precio_unitario >= 0),
  id_unidad_medida INTEGER,
  FOREIGN KEY (id_cotizacion) REFERENCES cotizaciones(id) ON DELETE CASCADE,
  FOREIGN KEY (id_producto) REFERENCES productos(id),
  FOREIGN KEY (id_unidad_medida) REFERENCES unidades_medida(id)
);

-- Pedidos y seguimiento
CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  id_cliente INTEGER NOT NULL,
  id_cotizacion INTEGER,
  estado TEXT NOT NULL DEFAULT 'Pedido en curso' CHECK (estado IN ('Pedido en curso', 'Pedido en camino', 'Pedido entregado', 'Cancelado')),
  fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_estimada_entrega TEXT,
  fecha_entrega TEXT,
  observaciones TEXT,
  FOREIGN KEY (id_cliente) REFERENCES clientes(id),
  FOREIGN KEY (id_cotizacion) REFERENCES cotizaciones(id)
);

CREATE TABLE IF NOT EXISTS detalle_pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_pedido INTEGER NOT NULL,
  id_producto INTEGER,
  descripcion_producto TEXT NOT NULL,
  cantidad NUMERIC NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC NOT NULL CHECK (precio_unitario >= 0),
  id_unidad_medida INTEGER,
  FOREIGN KEY (id_pedido) REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (id_producto) REFERENCES productos(id),
  FOREIGN KEY (id_unidad_medida) REFERENCES unidades_medida(id)
);

CREATE TABLE IF NOT EXISTS historial_estados_pedido (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_pedido INTEGER NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('Pedido en curso', 'Pedido en camino', 'Pedido entregado', 'Cancelado')),
  fecha_registro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  comentario TEXT,
  FOREIGN KEY (id_pedido) REFERENCES pedidos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS indice_productos_categoria ON productos(id_categoria);
CREATE INDEX IF NOT EXISTS indice_cotizaciones_cliente ON cotizaciones(id_cliente);
CREATE INDEX IF NOT EXISTS indice_usuarios_cliente ON usuarios(id_cliente);
CREATE INDEX IF NOT EXISTS indice_usuarios_ventas_correo ON usuarios_ventas(correo);
CREATE INDEX IF NOT EXISTS indice_pedidos_cliente ON pedidos(id_cliente);
CREATE INDEX IF NOT EXISTS indice_historial_pedido ON historial_estados_pedido(id_pedido);
