const fs = require('fs');
const path = require('path');

function loadLocalEnvironment() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const item = line.trim();
    if (!item || item.startsWith('#')) return;
    const separator = item.indexOf('=');
    if (separator === -1) return;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (key && !process.env[key]) process.env[key] = value;
  });
}

loadLocalEnvironment();

function areNotificationsEnabled() { return String(process.env.EMAIL_NOTIFICATIONS_ENABLED || 'false').toLowerCase() === 'true'; }

function getEmailConfiguration() {
  return {
    enabled: areNotificationsEnabled(),
    ready: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_TEST_RECIPIENT),
    recipient: process.env.RESEND_TEST_RECIPIENT || '',
    salesRecipient: process.env.RESEND_SALES_RECIPIENT || '',
    from: process.env.RESEND_FROM || 'onboarding@resend.dev',
  };
}

function getEmailConfigurationStatus() {
  const configuration = getEmailConfiguration();
  return {
    enabled: configuration.enabled,
    ready: configuration.enabled && configuration.ready,
    apiKeyConfigured: Boolean(process.env.RESEND_API_KEY),
    testRecipientConfigured: Boolean(configuration.recipient),
    salesRecipientConfigured: Boolean(configuration.salesRecipient),
    from: configuration.from,
  };
}

function saveEmailConfiguration({ apiKey, recipient, salesRecipient, from }) {
  if (apiKey && (apiKey.length < 10 || /[\r\n]/.test(apiKey))) throw new Error('La API Key no tiene un formato válido.');
  if (recipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('Ingresa un correo de prueba válido.');
  if (salesRecipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(salesRecipient)) throw new Error('Ingresa un correo válido para ventas.');
  if (from && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) throw new Error('Ingresa un remitente válido.');
  if (!apiKey && !process.env.RESEND_API_KEY) throw new Error('Ingresa la API Key de Resend.');
  if (!recipient && !process.env.RESEND_TEST_RECIPIENT) throw new Error('Ingresa el correo personal que recibirá la prueba.');
  const values = {
    EMAIL_NOTIFICATIONS_ENABLED: process.env.EMAIL_NOTIFICATIONS_ENABLED || 'false',
    RESEND_API_KEY: apiKey || process.env.RESEND_API_KEY,
    RESEND_TEST_RECIPIENT: recipient || process.env.RESEND_TEST_RECIPIENT,
    RESEND_SALES_RECIPIENT: salesRecipient || process.env.RESEND_SALES_RECIPIENT || recipient || process.env.RESEND_TEST_RECIPIENT,
    RESEND_FROM: from || process.env.RESEND_FROM || 'onboarding@resend.dev',
  };
  const content = `# Archivo privado de configuración. No lo compartas ni lo subas a Internet.\nEMAIL_NOTIFICATIONS_ENABLED=${values.EMAIL_NOTIFICATIONS_ENABLED}\nRESEND_API_KEY=${values.RESEND_API_KEY}\nRESEND_TEST_RECIPIENT=${values.RESEND_TEST_RECIPIENT}\nRESEND_SALES_RECIPIENT=${values.RESEND_SALES_RECIPIENT}\nRESEND_FROM=${values.RESEND_FROM}\n`;
  fs.writeFileSync(path.join(__dirname, '..', '.env'), content, { encoding: 'utf8', mode: 0o600 });
  Object.assign(process.env, values);
  return getEmailConfigurationStatus();
}

async function sendTestEmail() {
  const configuration = getEmailConfiguration();
  if (!configuration.enabled) throw new Error('El módulo de correos está desactivado.');
  if (!configuration.ready) throw new Error('Falta configurar la API Key o el correo de prueba en el archivo .env.');
  await sendEmail({
    to: configuration.recipient,
    subject: 'Prueba de correo — MVP de cotizaciones',
    html: '<h2>La conexión funciona</h2><p>Este correo confirma que el MVP puede comunicarse con Resend.</p><p>Cuando se verifique el dominio empresarial, las notificaciones se enviarán desde la empresa.</p>',
  });
}

function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&gt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character])); }

async function sendEmail({ to, subject, html }) {
  const configuration = getEmailConfiguration();
  if (!configuration.enabled) return { skipped: true };
  if (!process.env.RESEND_API_KEY) throw new Error('Falta configurar la API Key de Resend.');
  if (!to) throw new Error('Falta definir el destinatario del correo.');
  // El dominio temporal de Resend solo admite pruebas hacia el correo dueño de la cuenta.
  if (configuration.from === 'onboarding@resend.dev' && to.toLowerCase() !== configuration.recipient.toLowerCase()) {
    console.log(`Correo pendiente para ${to}: se enviará al verificar el dominio empresarial.`);
    return { skipped: true };
  }
  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: configuration.from, to: [to], subject, html }),
    });
  } catch (error) {
    console.log(`No fue posible conectar con Resend: ${error.cause?.message || error.message}`);
    throw new Error('No fue posible conectar con Resend. Revisa la conexión a internet, VPN, proxy o firewall de esta laptop.');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.name || 'Resend no pudo enviar el correo de prueba.');
  return result;
}

function notifyNewQuote(quote) {
  const safe = { code: escapeHtml(quote.code), name: escapeHtml(quote.name), email: escapeHtml(quote.email), product: escapeHtml(quote.product), message: escapeHtml(quote.message || 'Sin detalle adicional.') };
  const configuration = getEmailConfiguration();
  return Promise.allSettled([
    configuration.salesRecipient ? sendEmail({ to: configuration.salesRecipient, subject: `[${safe.code}] Nueva cotización recibida`, html: `<h2>Nueva cotización ${safe.code}</h2><p><strong>Cliente:</strong> ${safe.name}</p><p><strong>Correo:</strong> ${safe.email}</p><p><strong>Producto:</strong> ${safe.product}</p><p><strong>Mensaje:</strong> ${safe.message}</p><p>Ingresa al panel de administración para atenderla.</p>` }) : Promise.resolve(),
    sendEmail({ to: quote.email, subject: `Recibimos tu cotización ${safe.code}`, html: `<h2>Gracias por contactarnos, ${safe.name}</h2><p>Recibimos tu solicitud de cotización con código <strong>${safe.code}</strong>.</p><p><strong>Producto solicitado:</strong> ${safe.product}</p><p>El equipo comercial se comunicará contigo pronto.</p>` }),
  ]);
}

function notifyOrderCreated(order) {
  const safe = { code: escapeHtml(order.code), customer: escapeHtml(order.customer), product: escapeHtml(order.product), quantity: escapeHtml(order.quantity), unit: escapeHtml(order.unit), delivery: escapeHtml(order.estimatedDeliveryDate || 'Por confirmar') };
  return sendEmail({ to: order.customerEmail, subject: `Pedido ${safe.code} confirmado`, html: `<h2>Tu pedido ${safe.code} fue creado</h2><p>Hola, ${safe.customer}.</p><p><strong>Producto:</strong> ${safe.product}</p><p><strong>Cantidad:</strong> ${safe.quantity} ${safe.unit}</p><p><strong>Fecha estimada de entrega:</strong> ${safe.delivery}</p><p>Puedes revisar el seguimiento desde tu cuenta.</p>` });
}

function notifyOrderInTransit(order) {
  const safe = { code: escapeHtml(order.code), customer: escapeHtml(order.customer), delivery: escapeHtml(order.estimatedDeliveryDate || 'Por confirmar') };
  return sendEmail({ to: order.customerEmail, subject: `Tu pedido ${safe.code} está en camino`, html: `<h2>Tu pedido está en camino</h2><p>Hola, ${safe.customer}.</p><p>El pedido <strong>${safe.code}</strong> ya se encuentra en camino.</p><p><strong>Fecha estimada de entrega:</strong> ${safe.delivery}</p><p>Puedes revisar el seguimiento desde tu cuenta.</p>` });
}

module.exports = { getEmailConfiguration, getEmailConfigurationStatus, saveEmailConfiguration, sendTestEmail, notifyNewQuote, notifyOrderCreated, notifyOrderInTransit };
