const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

test('normaliza usuarios y habilita cuentas para clientes existentes', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'costa-grande-db-'));
  const databasePath = path.join(dataDirectory, 'mvp_catalogo.db');
  const database = new DatabaseSync(databasePath);

  try {
    database.exec(fs.readFileSync(path.join(projectRoot, 'base_de_datos', 'esquema.sql'), 'utf8'));
    database.exec('PRAGMA foreign_keys = OFF; DROP TABLE perfiles_ventas; DROP TABLE usuarios;');
    database.exec(`
      CREATE TABLE usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_cliente INTEGER,
        correo TEXT NOT NULL UNIQUE,
        contrasena_hash TEXT NOT NULL,
        rol TEXT NOT NULL CHECK (rol IN ('administracion', 'cliente')),
        requiere_cambio_contrasena INTEGER NOT NULL DEFAULT 0,
        activo INTEGER NOT NULL DEFAULT 1,
        fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_cliente) REFERENCES clientes(id)
      );
      CREATE TABLE usuarios_ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        correo TEXT NOT NULL UNIQUE,
        codigo_usuario TEXT NOT NULL UNIQUE,
        telefono TEXT NOT NULL,
        numero_documento TEXT NOT NULL,
        contrasena_hash TEXT NOT NULL,
        requiere_cambio_contrasena INTEGER NOT NULL DEFAULT 1,
        activo INTEGER NOT NULL DEFAULT 1,
        fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    database.prepare("INSERT INTO usuarios (correo, contrasena_hash, rol) VALUES (?, ?, 'administracion')").run('admin@prueba.test', hashPassword('Admin1234'));
    const clientId = Number(database.prepare('INSERT INTO clientes (nombre_contacto, correo, telefono) VALUES (?, ?, ?)').run('Cliente existente', 'cliente@prueba.test', '934567891').lastInsertRowid);
    database.prepare("INSERT INTO usuarios (id_cliente, correo, contrasena_hash, rol) VALUES (?, ?, ?, 'cliente')").run(clientId, 'correo-antiguo@prueba.test', hashPassword('Cliente123'));
    database.prepare('INSERT INTO usuarios_ventas (nombre, correo, codigo_usuario, telefono, numero_documento, contrasena_hash) VALUES (?, ?, ?, ?, ?, ?)').run('Vendedor existente', 'ventas@prueba.test', 'VEN-0042', '987654321', '12345678', hashPassword('Ventas1234'));
  } finally {
    database.close();
  }

  const verificationScript = String.raw`
    const assert = require('node:assert/strict');
    const path = require('node:path');
    const { DatabaseSync } = require('node:sqlite');
    const repository = require('./base_de_datos/base_de_datos');
    const migrated = repository.authenticate('ventas@prueba.test', 'Ventas1234');
    assert.equal(migrated.role, 'ventas');
    assert.equal(migrated.mustChangePassword, true);
    const existing = repository.listSalesUsers().find((user) => user.email === 'ventas@prueba.test');
    assert.equal(existing.userCode, 'VEN-0042');
    assert.equal(existing.phone, '987654321');
    assert.equal(repository.authenticate(' CLIENTE@PRUEBA.TEST ', 'Cliente123').role, 'cliente');
    const created = repository.createSalesUser({ name: 'Nueva vendedora', email: 'nueva@prueba.test', phone: '912345678', documentNumber: '87654321', temporaryPassword: 'Temporal123' });
    assert.equal(created.email, 'nueva@prueba.test');
    assert.equal(repository.authenticate('nueva@prueba.test', 'Temporal123').role, 'ventas');
    const product = repository.listProducts()[0];
    const quote = repository.createQuote({ name: 'Contacto prueba', email: 'contacto@prueba.test', phone: '923456789', product: product.name, quantity: 1, message: 'Prueba' });
    assert.equal(quote.phone, '923456789');
    const contact = repository.getClientById(quote.clientId);
    repository.updateClient(contact.id, { ...contact, temporaryPassword: 'Acceso1234' });
    assert.equal(repository.authenticate('contacto@prueba.test', 'Acceso1234').role, 'cliente');
    assert.equal(repository.listClients().find((client) => client.id === contact.id).hasAccount, true);
    const db = new DatabaseSync(path.join(process.env.APP_DATA_DIR, 'mvp_catalogo.db'));
    assert.equal(db.prepare("SELECT COUNT(*) total FROM sqlite_master WHERE type='table' AND name='usuarios_ventas'").get().total, 0);
    assert.equal(db.prepare("SELECT COUNT(*) total FROM usuarios WHERE rol='ventas'").get().total, 2);
    assert.equal(db.prepare('SELECT COUNT(*) total FROM perfiles_ventas').get().total, 2);
    assert.equal(db.prepare("SELECT telefono FROM clientes WHERE correo='contacto@prueba.test'").get().telefono, '923456789');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    db.close();
  `;

  const result = spawnSync(process.execPath, ['-e', verificationScript], {
    cwd: projectRoot,
    env: { ...process.env, APP_DATA_DIR: dataDirectory },
    encoding: 'utf8',
  });

  try {
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.ok(fs.existsSync(path.join(dataDirectory, 'mvp_catalogo.pre-user-normalization.db')));
  } finally {
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  }
});
