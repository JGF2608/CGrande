const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { sourceDirectory, databasePath } = require('./rutas_datos');

const schemaPath = path.join(sourceDirectory, 'esquema.sql');
const database = new DatabaseSync(databasePath);

database.exec('PRAGMA foreign_keys = ON;');
database.exec(fs.readFileSync(schemaPath, 'utf8'));

const tables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
console.log(`Base de datos creada o actualizada: ${databasePath}`);
console.log(`Tablas disponibles (${tables.length}): ${tables.map((table) => table.name).join(', ')}`);
database.close();
