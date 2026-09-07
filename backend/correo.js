const fs = require('fs');
const path = require('path');
const database = require('../base_de_datos/base_de_datos');

const templateDefinitions = {
  quote_sales: { title: 'Nueva cotización para ventas', variables: ['{{quote_code}}', '{{customer_name}}', '{{customer_email}}', '{{product}}', '{{message}}', '{{company_name}}', '{{company_phone}}', '{{company_signature}}'] },
  quote_customer: { title: 'Confirmación de cotización al cliente', variables: ['{{quote_code}}', '{{customer_name}}', '{{product}}', '{{company_name}}', '{{company_phone}}', '{{company_signature}}'] },
  order_created: { title: 'Pedido creado', variables: ['{{order_code}}', '{{customer_name}}', '{{product}}', '{{quantity}}', '{{unit}}', '{{estimated_delivery_date}}', '{{company_name}}', '{{company_phone}}', '{{company_signature}}'] },
  order_in_transit: { title: 'Pedido en camino', variables: ['{{order_code}}', '{{customer_name}}', '{{estimated_delivery_date}}', '{{company_name}}', '{{company_phone}}', '{{company_signature}}'] },
};

function loadLocalEnvironment() {
  const envPath = path.join(__dirname, '..', '.env');
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
function getEmailConfiguration() { return { enabled: areNotificationsEnabled(), ready: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_TEST_RECIPIENT), recipient: process.env.RESEND_TEST_RECIPIENT || '', salesRecipient: process.env.RESEND_SALES_RECIPIENT || '', from: process.env.RESEND_FROM || 'onboarding@resend.dev' }; }
function getEmailConfigurationStatus() { const configuration = getEmailConfiguration(); return { enabled: configuration.enabled, ready: configuration.enabled && configuration.ready, apiKeyConfigured: Boolean(process.env.RESEND_API_KEY), testRecipientConfigured: Boolean(configuration.recipient), salesRecipientConfigured: Boolean(configuration.salesRecipient), from: configuration.from }; }

function saveEmailConfiguration({ apiKey, recipient, salesRecipient, from }) {
  if (apiKey && (apiKey.length < 10 || /[\r\n]/.test(apiKey))) throw new Error('La API Key no tiene un formato válido.');
  if (recipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('Ingresa un correo de prueba válido.');
  if (salesRecipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(salesRecipient)) throw new Error('Ingresa un correo válido para ventas.');
  if (from && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) throw new Error('Ingresa un remitente válido.');
  if (!apiKey && !process.env.RESEND_API_KEY) throw new Error('Ingresa la API Key de Resend.');
  if (!recipient && !process.env.RESEND_TEST_RECIPIENT) throw new Error('Ingresa el correo personal que recibirá la prueba.');
  const values = { EMAIL_NOTIFICATIONS_ENABLED: process.env.EMAIL_NOTIFICATIONS_ENABLED || 'false', RESEND_API_KEY: apiKey || process.env.RESEND_API_KEY, RESEND_TEST_RECIPIENT: recipient || process.env.RESEND_TEST_RECIPIENT, RESEND_SALES_RECIPIENT: salesRecipient || process.env.RESEND_SALES_RECIPIENT || recipient || process.env.RESEND_TEST_RECIPIENT, RESEND_FROM: from || process.env.RESEND_FROM || 'onboarding@resend.dev', GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '', ANALYTICS_ENABLED: process.env.ANALYTICS_ENABLED || 'false' };
  const content = `# Archivo privado de configuración. No lo compartas ni lo subas a Internet.\nEMAIL_NOTIFICATIONS_ENABLED=${values.EMAIL_NOTIFICATIONS_ENABLED}\nRESEND_API_KEY=${values.RESEND_API_KEY}\nRESEND_TEST_RECIPIENT=${values.RESEND_TEST_RECIPIENT}\nRESEND_SALES_RECIPIENT=${values.RESEND_SALES_RECIPIENT}\nRESEND_FROM=${values.RESEND_FROM}\n\n# Clave de Google Maps. Restringirla al dominio de la web en Google Cloud.\nGOOGLE_MAPS_API_KEY=${values.GOOGLE_MAPS_API_KEY}\nANALYTICS_ENABLED=${values.ANALYTICS_ENABLED}\n`;
  fs.writeFileSync(path.join(__dirname, '..', '.env'), content, { encoding: 'utf8', mode: 0o600 }); Object.assign(process.env, values); return getEmailConfigurationStatus();
}

function getEmailTemplates() { return { templates: database.listEmailTemplates().map((template) => ({ ...template, title: templateDefinitions[template.type]?.title || template.type, variables: templateDefinitions[template.type]?.variables || [] })), signature: database.getCompanySettings().emailSignature || '' }; }
function saveEmailTemplate(type, data) { if (!templateDefinitions[type]) throw new Error('El tipo de notificación no es válido.'); const subject = String(data.subject || '').trim(), body = String(data.body || '').trim(); if (!subject || !body) throw new Error('Completa el asunto y el contenido de la plantilla.'); if (subject.length > 180 || body.length > 10000) throw new Error('La plantilla excede el tamaño permitido.'); return database.updateEmailTemplate(type, { subject, body }); }
function saveEmailSignature(signature) { const value = String(signature || '').trim(); if (value.length > 2000) throw new Error('La firma excede el tamaño permitido.'); return database.updateEmailSignature(value); }
function templateValues(values = {}) { const settings = database.getCompanySettings(); return { company_name: 'Costa Grande', company_phone: settings.contactPhone || 'Por configurar', company_signature: settings.emailSignature || 'Costa Grande', ...values }; }
function renderTemplate(type, values) { const template = database.getEmailTemplate(type); if (!template || !templateDefinitions[type]) throw new Error('No se encontró la plantilla de correo.'); const replacements = templateValues(values); const replace = (content) => String(content).replace(/{{\s*([a-z_]+)\s*}}/gi, (_, name) => String(replacements[name.toLowerCase()] ?? '')); return { subject: replace(template.subject), text: replace(template.body) }; }

async function sendEmail({ to, subject, text }) {
  const configuration = getEmailConfiguration(); if (!configuration.enabled) return { skipped: true }; if (!process.env.RESEND_API_KEY) throw new Error('Falta configurar la API Key de Resend.'); if (!to) throw new Error('Falta definir el destinatario del correo.');
  if (configuration.from === 'onboarding@resend.dev' && to.toLowerCase() !== configuration.recipient.toLowerCase()) { console.log(`Correo pendiente para ${to}: se enviará al verificar el dominio empresarial.`); return { skipped: true }; }
  let response; try { response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: configuration.from, to: [to], subject, text }) }); } catch (error) { console.log(`No fue posible conectar con Resend: ${error.cause?.message || error.message}`); throw new Error('No fue posible conectar con Resend. Revisa la conexión a internet, VPN, proxy o firewall de esta laptop.'); }
  const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.message || result.name || 'Resend no pudo enviar el correo.'); return result;
}

function exampleValues() { return { quote_code: 'COT-0001', order_code: 'PED-0001', customer_name: 'María Pérez', customer_email: 'maria@ejemplo.com', product: 'Producto de ejemplo', message: 'Necesito información sobre disponibilidad.', quantity: '10', unit: 'caj', estimated_delivery_date: '15/09/2026' }; }
async function sendTestEmail() { const configuration = getEmailConfiguration(); if (!configuration.enabled) throw new Error('El módulo de correos está desactivado.'); if (!configuration.ready) throw new Error('Falta configurar la API Key o el correo de prueba en el archivo .env.'); await sendEmail({ to: configuration.recipient, subject: 'Prueba de correo — Costa Grande', text: 'La conexión funciona. Este correo confirma que Costa Grande puede comunicarse con Resend.' }); }
async function sendTemplateTest(type) { const configuration = getEmailConfiguration(); if (!configuration.enabled || !configuration.ready) throw new Error('Completa primero la configuración de correo para enviar una prueba.'); await sendEmail({ to: configuration.recipient, ...renderTemplate(type, exampleValues()) }); }

function notifyNewQuote(quote) { const configuration = getEmailConfiguration(), values = { quote_code: quote.code, customer_name: quote.name, customer_email: quote.email, product: quote.product, message: quote.message || 'Sin detalle adicional.' }; return Promise.allSettled([configuration.salesRecipient ? sendEmail({ to: configuration.salesRecipient, ...renderTemplate('quote_sales', values) }) : Promise.resolve(), sendEmail({ to: quote.email, ...renderTemplate('quote_customer', values) })]); }
function notifyOrderCreated(order) { return sendEmail({ to: order.customerEmail, ...renderTemplate('order_created', { order_code: order.code, customer_name: order.customer, product: order.product, quantity: order.quantity, unit: order.unit, estimated_delivery_date: order.estimatedDeliveryDate || 'Por confirmar' }) }); }
function notifyOrderInTransit(order) { return sendEmail({ to: order.customerEmail, ...renderTemplate('order_in_transit', { order_code: order.code, customer_name: order.customer, estimated_delivery_date: order.estimatedDeliveryDate || 'Por confirmar' }) }); }

module.exports = { getEmailConfiguration, getEmailConfigurationStatus, saveEmailConfiguration, getEmailTemplates, saveEmailTemplate, saveEmailSignature, sendTestEmail, sendTemplateTest, notifyNewQuote, notifyOrderCreated, notifyOrderInTransit };
