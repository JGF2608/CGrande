const assert = require('node:assert/strict');
const test = require('node:test');
const { createErpProductService } = require('../backend/api-erp-products');

// Credenciales ficticias y un pool simulado permiten probar sin conectarse a la red ni al ERP real.
const validEnvironment = {
  ERP_DB_HOST: 'db.example.test',
  ERP_DB_PORT: '5432',
  ERP_DB_NAME: 'catalog',
  ERP_DB_USER: 'catalog_reader',
  ERP_DB_PASSWORD: 'secret-for-test',
};

test('consulta productos con precio_va y devuelve el contrato de lectura definido', async () => {
  let poolOptions;
  let queryText;
  const service = createErpProductService({
    env: validEnvironment,
    PoolClass: class {
      constructor(options) {
        poolOptions = options;
      }

      async query(query) {
        queryText = query;
        return {
          rows: [
            { codigo: '00042', nombre: 'Producto de prueba', reference_price: '123.45' },
            { codigo: '00043', nombre: 'Sin precio', reference_price: null },
          ],
        };
      }
    },
  });

  assert.deepEqual(await service.listProducts(), [
    { code: '00042', name: 'Producto de prueba', description: '', referencePrice: 123.45 },
    { code: '00043', name: 'Sin precio', description: '', referencePrice: null },
  ]);
  assert.match(queryText, /FROM public\.producto/);
  assert.match(queryText, /precio_va AS reference_price/);
  assert.deepEqual(poolOptions.ssl, { rejectUnauthorized: true });
  assert.equal(poolOptions.password, validEnvironment.ERP_DB_PASSWORD);
});

test('permite cambiar a una columna de precio aprobada mediante configuración', async () => {
  let queryText;
  const service = createErpProductService({
    env: { ...validEnvironment, ERP_PRODUCT_PRICE_COLUMN: 'precio_vb' },
    PoolClass: class {
      async query(query) {
        queryText = query;
        return { rows: [] };
      }
    },
  });

  await service.listProducts();
  assert.match(queryText, /precio_vb AS reference_price/);
});

test('rechaza una columna de precio no permitida antes de conectarse', async () => {
  const service = createErpProductService({
    env: { ...validEnvironment, ERP_PRODUCT_PRICE_COLUMN: 'precio_va; DROP TABLE producto' },
    PoolClass: class {
      constructor() {
        assert.fail('No debe abrirse una conexión con configuración inválida.');
      }
    },
  });

  await assert.rejects(service.listProducts(), { code: 'ERP_CONFIGURATION', statusCode: 503 });
});

test('reporta la falta de credenciales de conexión', async () => {
  const service = createErpProductService({
    env: {},
    PoolClass: class {
      constructor() {
        assert.fail('No debe abrirse una conexión si faltan credenciales.');
      }
    },
  });

  await assert.rejects(service.listProducts(), {
    code: 'ERP_CONFIGURATION',
    statusCode: 503,
    message: 'Faltan datos de conexión de PostgreSQL del ERP.',
  });
});
