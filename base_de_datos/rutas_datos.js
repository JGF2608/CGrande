const fs = require('fs');
const path = require('path');

// Ubica la carpeta de datos de la aplicación.
const sourceDirectory = __dirname;
// Conserva los archivos de datos en la ruta configurada.
const dataDirectory = path.resolve(process.env.APP_DATA_DIR || sourceDirectory);

fs.mkdirSync(dataDirectory, { recursive: true });

module.exports = {
  sourceDirectory,
  dataDirectory,
  databasePath: path.join(dataDirectory, 'mvp_catalogo.db'),
  analyticsDatabasePath: path.join(dataDirectory, 'analitica.db'),
  uploadsDirectory: path.join(dataDirectory, 'uploads'),
};
