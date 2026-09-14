const fs = require('fs');
const path = require('path');

const sourceDirectory = __dirname;
const dataDirectory = path.resolve(process.env.APP_DATA_DIR || sourceDirectory);

fs.mkdirSync(dataDirectory, { recursive: true });

module.exports = {
  sourceDirectory,
  dataDirectory,
  databasePath: path.join(dataDirectory, 'mvp_catalogo.db'),
  analyticsDatabasePath: path.join(dataDirectory, 'analitica.db'),
  uploadsDirectory: path.join(dataDirectory, 'uploads'),
};
