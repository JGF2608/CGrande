const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { sourceDirectory, databasePath } = require('./rutas_datos');

// Ubica los cambios pendientes de estructura de la base de datos.
const migrationsDirectory = path.join(sourceDirectory, 'migraciones');
const database = new DatabaseSync(databasePath);
database.exec('CREATE TABLE IF NOT EXISTS migraciones_aplicadas (nombre TEXT PRIMARY KEY, aplicada_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);');

if (!fs.existsSync(migrationsDirectory)) {
  console.log('No hay migraciones pendientes.');
  database.close();
  process.exit(0);
}

const migrations = fs.readdirSync(migrationsDirectory)
  .filter((file) => /^\d{3,}-[a-z0-9-]+\.sql$/i.test(file))
  .sort();
// Evita repetir las migraciones que ya se ejecutaron.
const applied = new Set(database.prepare('SELECT nombre FROM migraciones_aplicadas').all().map((row) => row.nombre));

for (const migration of migrations) {
  if (applied.has(migration)) continue;
  const sql = fs.readFileSync(path.join(migrationsDirectory, migration), 'utf8');
  database.exec('BEGIN');
  try {
    database.exec(sql);
    database.prepare('INSERT INTO migraciones_aplicadas (nombre) VALUES (?)').run(migration);
    database.exec('COMMIT');
    console.log(`Migración aplicada: ${migration}`);
  } catch (error) {
    database.exec('ROLLBACK');
    database.close();
    throw error;
  }
}

console.log('Migraciones verificadas correctamente.');
database.close();
