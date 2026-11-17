// Comparte el mismo formato de hash entre el inicio de sesión y los comandos administrativos.
const crypto = require('node:crypto');

// Guarda cada contraseña con una sal aleatoria y scrypt, nunca en texto plano.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

// Verifica el hash en tiempo constante para evitar comparar contraseñas en texto plano.
function verifyPassword(password, stored) {
  const [salt, storedHash] = String(stored).split(':');
  if (!salt || !storedHash || !/^[a-f0-9]{128}$/i.test(storedHash)) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), derived);
}

module.exports = { hashPassword, verifyPassword };
