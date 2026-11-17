// Ofrece los comandos interactivos para crear o restablecer administradores desde CWP.
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { createAdminAccount, resetAdminPassword, resolveDatabase } = require('../base_de_datos/admin_accounts');

// Lee solo las opciones permitidas y exige sus valores explícitamente.
function parseArguments(argumentsList) {
  const options = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!['--data-dir', '--email'].includes(argument)) throw new Error(`Opción desconocida: ${argument}`);
    const value = argumentsList[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Falta el valor para ${argument}.`);
    const name = argument.slice(2);
    if (Object.prototype.hasOwnProperty.call(options, name)) throw new Error(`La opción ${argument} no debe repetirse.`);
    options[name] = value;
    index += 1;
  }
  return options;
}

// Lee una contraseña sin mostrar los caracteres en la terminal.
function readHidden(prompt) {
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Ejecuta este comando desde una terminal interactiva para que la contraseña no se muestre.');
  }

  return new Promise((resolve, reject) => {
    const wasRaw = stdin.isRaw;
    let value = '';
    let finished = false;
    stdin.setEncoding('utf8');

    const finish = (error) => {
      if (finished) return;
      finished = true;
      stdin.removeListener('data', onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003' || character === '\u0004') return finish(new Error('Operación interrumpida.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') {
          value = Array.from(value).slice(0, -1).join('');
          continue;
        }
        if (character >= ' ' && character !== '\u007f') value += character;
      }
    };

    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

// Solicita datos visibles, como el correo y la confirmación de la ruta.
async function askLine(prompt) {
  const interfaceReadline = readline.createInterface({ input: stdin, output: stdout });
  try {
    return (await interfaceReadline.question(prompt)).trim();
  } finally {
    interfaceReadline.close();
  }
}

// Confirma dos veces la contraseña y comprueba su longitud mínima.
async function getPasswords() {
  const password = await readHidden('Nueva contraseña (mínimo 12 caracteres, no se mostrará): ');
  const confirmation = await readHidden('Repite la contraseña: ');
  if (password !== confirmation) throw new Error('Las contraseñas no coinciden.');
  if (Array.from(password).length < 12) throw new Error('La contraseña debe tener al menos 12 caracteres.');
  return password;
}

// Evita modificar la BD hasta que el operador confirme su ruta completa.
async function confirmDatabase(databasePath) {
  stdout.write(`Base de datos que se modificará: ${databasePath}\n`);
  const confirmation = await askLine('Escribe la ruta completa anterior para confirmar: ');
  if (confirmation !== databasePath) throw new Error('La ruta no coincide. No se realizaron cambios.');
}

// Valida el objetivo, solicita credenciales y ejecuta la operación elegida.
async function main() {
  const [operation, ...remainingArguments] = process.argv.slice(2);
  if (!['create', 'reset'].includes(operation)) {
    throw new Error('Uso: npm run admin:create [-- --data-dir RUTA] o npm run admin:reset -- --email CORREO [--data-dir RUTA].');
  }

  const options = parseArguments(remainingArguments);
  if (operation === 'reset' && !options.email) throw new Error('Para restablecer una contraseña debes indicar --email CORREO.');
  if (operation === 'create' && options.email) throw new Error('El correo se solicitará de forma interactiva al crear una cuenta.');
  if (!options['data-dir']) throw new Error('Debes indicar --data-dir con la carpeta de datos de este ambiente.');

  const dataDirectory = path.resolve(options['data-dir']);
  const target = resolveDatabase(dataDirectory);
  await confirmDatabase(target.databasePath);

  const email = operation === 'create' ? await askLine('Correo del administrador: ') : options.email;
  const password = await getPasswords();
  const result = operation === 'create'
    ? createAdminAccount({ dataDirectory, email, password })
    : resetAdminPassword({ dataDirectory, email, password });

  stdout.write(`Cuenta administradora ${operation === 'create' ? 'creada' : 'actualizada'}: ${result.email}\n`);
  stdout.write(`Respaldo creado: ${result.backupPath}\n`);
  if (operation === 'reset') stdout.write('Reinicia la aplicación desde CWP para cerrar las sesiones activas.\n');
}

main().catch((error) => {
  fs.writeSync(2, `${error.message}\n`);
  process.exitCode = 1;
});
