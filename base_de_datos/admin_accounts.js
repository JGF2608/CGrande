// Gestiona cuentas administrativas directamente en la BD local, sin iniciar el servidor web.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('./passwords');

// Exige las columnas que usa la autenticación para evitar modificar una BD incompatible.
const requiredUserColumns = ['correo', 'contrasena_hash', 'rol', 'requiere_cambio_contrasena', 'activo'];

// Normaliza el correo y rechaza valores que no pueden usarse como cuenta.
function normalizeEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Ingresa un correo válido.');
  }
  return normalized;
}

// Aplica el mínimo de longitud requerido antes de crear o cambiar una credencial.
function validatePassword(password) {
  if (typeof password !== 'string' || Array.from(password).length < 12) {
    throw new Error('La contraseña debe tener al menos 12 caracteres.');
  }
}

// Resuelve una BD existente y no permite crear accidentalmente un archivo nuevo.
function resolveDatabase(dataDirectory) {
  if (!dataDirectory) throw new Error('No se indicó la carpeta de datos de la aplicación.');
  const resolvedDataDirectory = path.resolve(dataDirectory);
  if (!fs.existsSync(resolvedDataDirectory) || !fs.statSync(resolvedDataDirectory).isDirectory()) {
    throw new Error(`No existe la carpeta de datos indicada: ${resolvedDataDirectory}`);
  }
  const databasePath = path.join(fs.realpathSync(resolvedDataDirectory), 'mvp_catalogo.db');
  if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) {
    throw new Error(`No existe una base de datos de la aplicación en ${databasePath}. No se creó ningún archivo.`);
  }
  return { dataDirectory: fs.realpathSync(resolvedDataDirectory), databasePath: fs.realpathSync(databasePath) };
}

// Abre y valida la estructura de usuarios antes de permitir cambios.
function openDatabase(databasePath) {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec('PRAGMA busy_timeout = 5000;');
    const table = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'usuarios'").get();
    if (!table) throw new Error('El archivo indicado no contiene la tabla de usuarios de Costa Grande.');
    const columns = new Set(database.prepare('PRAGMA table_info(usuarios)').all().map((column) => column.name));
    const missingColumns = requiredUserColumns.filter((column) => !columns.has(column));
    if (missingColumns.length) throw new Error(`La tabla de usuarios no tiene las columnas esperadas: ${missingColumns.join(', ')}.`);
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

// Crea una copia SQLite consistente y restringe los permisos del respaldo.
function createBackup(database, dataDirectory) {
  const backupDirectory = path.join(dataDirectory, 'backups');
  fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
  fs.chmodSync(backupDirectory, 0o700);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDirectory, `mvp_catalogo.admin-${timestamp}-${crypto.randomBytes(3).toString('hex')}.db`);
  const escapedPath = backupPath.replace(/'/g, "''");
  database.exec(`VACUUM INTO '${escapedPath}'`);
  fs.chmodSync(backupPath, 0o600);
  return backupPath;
}

// Crea una cuenta administrativa nueva sin reemplazar cuentas existentes.
function createAdminAccount({ dataDirectory, email, password }) {
  const normalizedEmail = normalizeEmail(email);
  validatePassword(password);
  const target = resolveDatabase(dataDirectory);
  const database = openDatabase(target.databasePath);

  try {
    if (database.prepare('SELECT id FROM usuarios WHERE lower(correo) = lower(?)').get(normalizedEmail)) {
      throw new Error('Ya existe una cuenta con ese correo. Para una cuenta administradora existente, usa el comando de restablecimiento.');
    }

    const backupPath = createBackup(database, target.dataDirectory);
    database.exec('BEGIN IMMEDIATE');
    try {
      if (database.prepare('SELECT id FROM usuarios WHERE lower(correo) = lower(?)').get(normalizedEmail)) {
        throw new Error('Ya existe una cuenta con ese correo. No se realizaron cambios.');
      }
      database.prepare("INSERT INTO usuarios (correo, contrasena_hash, rol, requiere_cambio_contrasena, activo) VALUES (?, ?, 'administracion', 0, 1)")
        .run(normalizedEmail, hashPassword(password));
      database.exec('COMMIT');
      return { email: normalizedEmail, databasePath: target.databasePath, backupPath };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  } finally {
    database.close();
  }
}

// Cambia la contraseña solo de una cuenta administrativa que esté activa.
function resetAdminPassword({ dataDirectory, email, password }) {
  const normalizedEmail = normalizeEmail(email);
  validatePassword(password);
  const target = resolveDatabase(dataDirectory);
  const database = openDatabase(target.databasePath);

  try {
    const account = database.prepare("SELECT id FROM usuarios WHERE lower(correo) = lower(?) AND rol = 'administracion' AND activo = 1").get(normalizedEmail);
    if (!account) throw new Error('No existe una cuenta administradora activa con ese correo. No se realizaron cambios.');

    const backupPath = createBackup(database, target.dataDirectory);
    database.exec('BEGIN IMMEDIATE');
    try {
      const currentAccount = database.prepare("SELECT id FROM usuarios WHERE id = ? AND rol = 'administracion' AND activo = 1").get(account.id);
      if (!currentAccount) throw new Error('La cuenta ya no está activa. No se realizaron cambios.');
      database.prepare('UPDATE usuarios SET contrasena_hash = ?, requiere_cambio_contrasena = 0 WHERE id = ?')
        .run(hashPassword(password), account.id);
      database.exec('COMMIT');
      return { email: normalizedEmail, databasePath: target.databasePath, backupPath };
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  } finally {
    database.close();
  }
}

module.exports = { createAdminAccount, resetAdminPassword, resolveDatabase };
