const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const database = require('../base_de_datos/base_de_datos');

const templateDefinitions = {
  quote_sales: { title: 'Nueva cotización para ventas', variables: ['{{quote_code}}', '{{customer_name}}', '{{customer_email}}', '{{product}}', '{{message}}', '{{company_name}}', '{{company_phone}}', '{{company_signature}}'] },
  quote_customer: { title: 'Confirmación de cotización al cliente', variables: ['{{quote_code}}', '{{customer_name}}', '{{product}}', '{{company_name}}', '{{company_phone}}', '{{company_signature}}'] },
  order_created: { title: 'Pedido creado', variables: ['{{order_code}}', '{{customer_name}}', '{{product}}', '{{quantity}}', '{{unit}}', '{{estimated_delivery_date}}', '{{company_name}}', '{{company_phone}}', '{{company_signature}}'] },
  order_in_transit: { title: 'Pedido en camino', variables: ['{{order_code}}', '{{customer_name}}', '{{estimated_delivery_date}}', '{{company_name}}', '{{company_phone}}', '{{company_signature}}'] },
};

// Ubica el archivo de configuración local del correo.
function environmentFilePath() { return path.resolve(process.env.APP_ENV_FILE || path.join(__dirname, '..', '.env')); }
// Lee la configuración local utilizada para enviar notificaciones.
function loadLocalEnvironment() {
  const envPath = environmentFilePath();
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const item = line.trim(); if (!item || item.startsWith('#')) return;
    const separator = item.indexOf('='); if (separator === -1) return;
    const key = item.slice(0, separator).trim(), value = item.slice(separator + 1).trim();
    if (key && !process.env[key]) process.env[key] = value;
  });
}
loadLocalEnvironment();

function areNotificationsEnabled() { return String(process.env.EMAIL_NOTIFICATIONS_ENABLED || 'false').toLowerCase() === 'true'; }
// Reúne los datos necesarios para conectarse al servidor SMTP de cPanel.
function getEmailConfiguration() {
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE ?? (port === 465)).toLowerCase() === 'true';
  const user = process.env.SMTP_USER || '';
  const salesRecipient = process.env.EMAIL_SALES_RECIPIENT || user;
  return {
    enabled: areNotificationsEnabled(),
    host: process.env.SMTP_HOST || 'costagrande.com.pe',
    port,
    secure,
    user,
    password: process.env.SMTP_PASSWORD || '',
    recipient: process.env.EMAIL_TEST_RECIPIENT || salesRecipient,
    salesRecipient,
    from: process.env.SMTP_FROM || user,
  };
}
function getEmailConfigurationStatus() {
  const configuration = getEmailConfiguration();
  const ready = Boolean(configuration.host && configuration.port && configuration.user && configuration.password && configuration.recipient && configuration.from);
  return { enabled: configuration.enabled, ready: configuration.enabled && ready, host: configuration.host, port: configuration.port, secure: configuration.secure, user: configuration.user, passwordConfigured: Boolean(configuration.password), testRecipientConfigured: Boolean(configuration.recipient), salesRecipientConfigured: Boolean(configuration.salesRecipient), from: configuration.from };
}

// Guarda la configuración de correo para las notificaciones.
function saveEmailConfiguration({ host, port, secure, user, password, recipient, salesRecipient, from }) {
  if (host && (!/^[a-z0-9.-]+$/i.test(host) || /[\r\n]/.test(host))) throw new Error('Ingresa un servidor SMTP válido.');
  const smtpPort = Number(port || process.env.SMTP_PORT || 465);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) throw new Error('Ingresa un puerto SMTP válido.');
  if (user && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) throw new Error('Ingresa un usuario SMTP válido.');
  if (password && /[\r\n]/.test(password)) throw new Error('La contraseña SMTP no tiene un formato válido.');
  if (recipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('Ingresa un correo de prueba válido.');
  if (salesRecipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(salesRecipient)) throw new Error('Ingresa un correo válido para ventas.');
  if (from && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) throw new Error('Ingresa un remitente válido.');
  if (!password && !process.env.SMTP_PASSWORD) throw new Error('Ingresa la contraseña de la cuenta de correo.');
  const smtpUser = user || process.env.SMTP_USER || 'ventas@costagrande.com.pe';
  const values = { PORT: process.env.PORT || '3000', MAX_CONNECTIONS: process.env.MAX_CONNECTIONS || '500', APP_DATA_DIR: process.env.APP_DATA_DIR || '', APP_ENV_FILE: process.env.APP_ENV_FILE || '', EMAIL_NOTIFICATIONS_ENABLED: process.env.EMAIL_NOTIFICATIONS_ENABLED || 'false', SMTP_HOST: host || process.env.SMTP_HOST || 'costagrande.com.pe', SMTP_PORT: String(smtpPort), SMTP_SECURE: String(secure ?? process.env.SMTP_SECURE ?? 'true'), SMTP_USER: smtpUser, SMTP_PASSWORD: password || process.env.SMTP_PASSWORD, SMTP_FROM: from || process.env.SMTP_FROM || smtpUser, EMAIL_TEST_RECIPIENT: recipient || process.env.EMAIL_TEST_RECIPIENT || '', EMAIL_SALES_RECIPIENT: salesRecipient || process.env.EMAIL_SALES_RECIPIENT || smtpUser, GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '', ANALYTICS_ENABLED: process.env.ANALYTICS_ENABLED || 'false' };
  const content = `# Archivo privado de configuración. No lo compartas ni lo subas a Internet.\nPORT=${values.PORT}\nMAX_CONNECTIONS=${values.MAX_CONNECTIONS}\nAPP_DATA_DIR=${values.APP_DATA_DIR}\nAPP_ENV_FILE=${values.APP_ENV_FILE}\n\nEMAIL_NOTIFICATIONS_ENABLED=${values.EMAIL_NOTIFICATIONS_ENABLED}\nSMTP_HOST=${values.SMTP_HOST}\nSMTP_PORT=${values.SMTP_PORT}\nSMTP_SECURE=${values.SMTP_SECURE}\nSMTP_USER=${values.SMTP_USER}\nSMTP_PASSWORD=${values.SMTP_PASSWORD}\nSMTP_FROM=${values.SMTP_FROM}\nEMAIL_TEST_RECIPIENT=${values.EMAIL_TEST_RECIPIENT}\nEMAIL_SALES_RECIPIENT=${values.EMAIL_SALES_RECIPIENT}\n\n# Clave de Google Maps. Restringirla al dominio de la web en Google Cloud.\nGOOGLE_MAPS_API_KEY=${values.GOOGLE_MAPS_API_KEY}\nANALYTICS_ENABLED=${values.ANALYTICS_ENABLED}\n`;
  const envPath = environmentFilePath(); fs.mkdirSync(path.dirname(envPath), { recursive: true }); fs.writeFileSync(envPath, content, { encoding: 'utf8', mode: 0o600 }); Object.assign(process.env, values); return getEmailConfigurationStatus();
}

function getEmailTemplates() { return { templates: database.listEmailTemplates().map((template) => ({ ...template, title: templateDefinitions[template.type]?.title || template.type, variables: templateDefinitions[template.type]?.variables || [] })), signature: database.getCompanySettings().emailSignature || '' }; }
function saveEmailTemplate(type, data) { if (!templateDefinitions[type]) throw new Error('El tipo de notificación no es válido.'); const subject = String(data.subject || '').trim(), body = String(data.body || '').trim(); if (!subject || !body) throw new Error('Completa el asunto y el contenido de la plantilla.'); if (subject.length > 180 || body.length > 10000) throw new Error('La plantilla excede el tamaño permitido.'); return database.updateEmailTemplate(type, { subject, body }); }
function saveEmailSignature(signature) { const value = String(signature || '').trim(); if (value.length > 2000) throw new Error('La firma excede el tamaño permitido.'); return database.updateEmailSignature(value); }
// Prepara los datos que reemplazan las variables de cada plantilla.
function templateValues(values = {}) { const settings = database.getCompanySettings(); return { company_name: 'Costa Grande', company_phone: settings.contactPhone || 'Por configurar', company_signature: settings.emailSignature || 'Costa Grande', ...values }; }
// Sustituye las variables y la firma en el contenido del correo.
function renderTemplate(type, values) { const template = database.getEmailTemplate(type); if (!template || !templateDefinitions[type]) throw new Error('No se encontró la plantilla de correo.'); const replacements = templateValues(values); const replace = (content) => String(content).replace(/{{\s*([a-z_]+)\s*}}/gi, (_, name) => String(replacements[name.toLowerCase()] ?? '')); return { subject: replace(template.subject), text: replace(template.body) }; }

// Envía el mensaje con la configuración de correo activa.
async function sendEmail({ to, subject, text }) {
  const configuration = getEmailConfiguration();
  if (!configuration.enabled) return { skipped: true };
  if (!configuration.host || !configuration.user || !configuration.password || !configuration.from) throw new Error('Falta completar la configuración SMTP.');
  if (!to) throw new Error('Falta definir el destinatario del correo.');
  const transporter = nodemailer.createTransport({ host: configuration.host, port: configuration.port, secure: configuration.secure, auth: { user: configuration.user, pass: configuration.password } });
  try { return await transporter.sendMail({ from: configuration.from, to, subject, text }); } catch (error) { console.log(`No fue posible enviar el correo por SMTP: ${error.message}`); throw new Error('No fue posible enviar el correo por SMTP. Revisa el servidor, puerto, usuario, contraseña y acceso SSL/TLS.'); }
}

function exampleValues() { return { quote_code: 'COT-0001', order_code: 'PED-0001', customer_name: 'María Pérez', customer_email: 'maria@ejemplo.com', product: 'Producto de ejemplo', message: 'Necesito información sobre disponibilidad.', quantity: '10', unit: 'caj', estimated_delivery_date: '15/09/2026' }; }
// Envía un correo de prueba a la dirección configurada.
async function sendTestEmail() { const configuration = getEmailConfiguration(); const status = getEmailConfigurationStatus(); if (!configuration.enabled) throw new Error('El módulo de correos está desactivado.'); if (!status.ready) throw new Error('Falta completar la configuración SMTP o el correo de prueba.'); await sendEmail({ to: configuration.recipient, subject: 'Prueba de correo — Costa Grande', text: 'La conexión funciona. Este correo confirma que Costa Grande puede enviar notificaciones mediante el servidor SMTP de cPanel.' }); }
async function sendTemplateTest(type) { const configuration = getEmailConfiguration(); if (!getEmailConfigurationStatus().ready) throw new Error('Completa primero la configuración SMTP para enviar una prueba.'); await sendEmail({ to: configuration.recipient, ...renderTemplate(type, exampleValues()) }); }

// Prepara las notificaciones de una cotización nueva.
function notifyNewQuote(quote) { const configuration = getEmailConfiguration(), values = { quote_code: quote.code, customer_name: quote.name, customer_email: quote.email, product: quote.product, message: quote.message || 'Sin detalle adicional.' }; return Promise.allSettled([configuration.salesRecipient ? sendEmail({ to: configuration.salesRecipient, ...renderTemplate('quote_sales', values) }) : Promise.resolve(), sendEmail({ to: quote.email, ...renderTemplate('quote_customer', values) })]); }
// Prepara la notificación cuando se crea un pedido.
function notifyOrderCreated(order) { return sendEmail({ to: order.customerEmail, ...renderTemplate('order_created', { order_code: order.code, customer_name: order.customer, product: order.product, quantity: order.quantity, unit: order.unit, estimated_delivery_date: order.estimatedDeliveryDate || 'Por confirmar' }) }); }
// Prepara la notificación cuando un pedido sale a reparto.
function notifyOrderInTransit(order) { return sendEmail({ to: order.customerEmail, ...renderTemplate('order_in_transit', { order_code: order.code, customer_name: order.customer, estimated_delivery_date: order.estimatedDeliveryDate || 'Por confirmar' }) }); }

module.exports = { getEmailConfiguration, getEmailConfigurationStatus, saveEmailConfiguration, getEmailTemplates, saveEmailTemplate, saveEmailSignature, sendTestEmail, sendTemplateTest, notifyNewQuote, notifyOrderCreated, notifyOrderInTransit };
