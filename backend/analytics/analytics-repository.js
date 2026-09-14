const { DatabaseSync } = require('node:sqlite');
const { analyticsDatabasePath } = require('../../base_de_datos/rutas_datos');

const database = new DatabaseSync(analyticsDatabasePath);
database.exec(`
  CREATE TABLE IF NOT EXISTS eventos_analitica (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    sesion TEXT NOT NULL,
    categoria_id INTEGER,
    categoria_nombre TEXT,
    producto_nombre TEXT,
    ruta TEXT,
    fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS indice_eventos_tipo_fecha ON eventos_analitica(tipo, fecha_creacion);
  CREATE INDEX IF NOT EXISTS indice_eventos_categoria ON eventos_analitica(categoria_id);
`);

function record(event) {
  database.prepare('INSERT INTO eventos_analitica (tipo, sesion, categoria_id, categoria_nombre, producto_nombre, ruta) VALUES (?, ?, ?, ?, ?, ?)')
    .run(event.type, event.session, event.categoryId || null, event.categoryName || null, event.productName || null, event.path || null);
}

function rows(statement, ...parameters) { return database.prepare(statement).all(...parameters); }
function total(statement, ...parameters) { return Number(database.prepare(statement).get(...parameters).total || 0); }

function behaviorSummary() {
  return {
    visits: total("SELECT COUNT(*) AS total FROM eventos_analitica WHERE tipo = 'visita_web'"),
    uniqueVisitors: total("SELECT COUNT(DISTINCT sesion) AS total FROM eventos_analitica WHERE tipo = 'visita_web'"),
    categoryOpens: total("SELECT COUNT(*) AS total FROM eventos_analitica WHERE tipo = 'categoria_abierta'"),
    categories: rows("SELECT COALESCE(categoria_nombre, 'Sin categoría') AS label, COUNT(*) AS value FROM eventos_analitica WHERE tipo = 'categoria_abierta' GROUP BY categoria_id, categoria_nombre ORDER BY value DESC, label LIMIT 8"),
    products: rows("SELECT producto_nombre AS label, COUNT(*) AS value FROM eventos_analitica WHERE tipo IN ('producto_consultado', 'cotizacion_enviada') AND producto_nombre IS NOT NULL GROUP BY producto_nombre ORDER BY value DESC, label LIMIT 8"),
    whatsappClicks: total("SELECT COUNT(*) AS total FROM eventos_analitica WHERE tipo = 'clic_whatsapp'"),
  };
}

module.exports = { record, behaviorSummary };
