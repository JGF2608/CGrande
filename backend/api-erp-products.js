const { Pool } = require('pg');

// PostgreSQL no permite parametrizar identificadores; esta lista evita insertar una columna arbitraria en el SQL.
const allowedPriceColumns = new Set(['precio_com', 'precio_va', 'precio_vb']);

// Distingue errores de configuración para devolver un estado 503 y un mensaje claro al administrador.
function configurationError(message) {
  const error = new Error(message);
  error.statusCode = 503;
  error.code = 'ERP_CONFIGURATION';
  return error;
}

function createErpProductService({ env = process.env, PoolClass = Pool } = {}) {
  let pool;

  // Valida la configuración antes de abrir una conexión y reutiliza un pool acotado durante la vida del servidor.
  function getPool() {
    const host = String(env.ERP_DB_HOST || '').trim();
    const database = String(env.ERP_DB_NAME || '').trim();
    const user = String(env.ERP_DB_USER || '').trim();
    const password = String(env.ERP_DB_PASSWORD || '');
    const port = Number(env.ERP_DB_PORT || 5432);
    const priceColumn = String(env.ERP_PRODUCT_PRICE_COLUMN || 'precio_va').trim();
    const ssl = String(env.ERP_DB_SSL || 'true').trim().toLowerCase();

    if (!host || !database || !user || !password) {
      throw configurationError('Faltan datos de conexión de PostgreSQL del ERP.');
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw configurationError('El puerto de PostgreSQL del ERP no es válido.');
    }
    if (!allowedPriceColumns.has(priceColumn)) {
      throw configurationError('La columna de precio configurada para el ERP no está permitida.');
    }
    if (!['true', 'false'].includes(ssl)) {
      throw configurationError('ERP_DB_SSL debe ser true o false.');
    }

    if (!pool) {
      pool = new PoolClass({
        host,
        port,
        database,
        user,
        password,
        ssl: ssl === 'true' ? { rejectUnauthorized: true } : false,
        max: 5,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
      });
    }

    return { pool, priceColumn };
  }

  // Lee solo los campos aprobados del ERP y los adapta al contrato que expone la API.
  async function listProducts() {
    const { pool: connection, priceColumn } = getPool();
    const result = await connection.query(
      `SELECT codigo, nombre, ${priceColumn} AS reference_price
       FROM public.producto
       ORDER BY codigo`,
    );

    return result.rows.map((row) => {
      const referencePrice = row.reference_price === null ? null : Number(row.reference_price);
      if (referencePrice !== null && !Number.isFinite(referencePrice)) {
        throw new Error(`El producto ${row.codigo} tiene un precio referencial inválido en el ERP.`);
      }

      return {
        code: String(row.codigo ?? ''),
        name: String(row.nombre ?? ''),
        description: '',
        referencePrice,
      };
    });
  }

  return { listProducts };
}

module.exports = { createErpProductService };
