const assert = require('node:assert/strict');
const test = require('node:test');

test('envía la prueba al correo de ventas cuando no existe un destinatario exclusivo', async () => {
  delete process.env.EMAIL_TEST_RECIPIENT;
  Object.assign(process.env, {
    EMAIL_NOTIFICATIONS_ENABLED: 'true',
    SMTP_HOST: 'costagrande.com.pe',
    SMTP_PORT: '465',
    SMTP_SECURE: 'true',
    SMTP_USER: 'ventas@costagrande.com.pe',
    SMTP_PASSWORD: 'secreto-de-prueba',
    SMTP_FROM: 'ventas@costagrande.com.pe',
    EMAIL_SALES_RECIPIENT: 'ventas@costagrande.com.pe',
  });

  const nodemailer = require('nodemailer');
  const databaseModule = require.resolve('../base_de_datos/base_de_datos');
  require.cache[databaseModule] = { id: databaseModule, filename: databaseModule, loaded: true, exports: {} };
  const originalCreateTransport = nodemailer.createTransport;
  let transportOptions;
  let message;
  nodemailer.createTransport = (options) => {
    transportOptions = options;
    return { sendMail: async (data) => { message = data; return { messageId: 'smtp-test' }; } };
  };

  try {
    const email = require('../backend/correo');
    assert.deepEqual(email.getEmailConfigurationStatus(), {
      enabled: true,
      ready: true,
      host: 'costagrande.com.pe',
      port: 465,
      secure: true,
      user: 'ventas@costagrande.com.pe',
      passwordConfigured: true,
      testRecipientConfigured: true,
      salesRecipientConfigured: true,
      from: 'ventas@costagrande.com.pe',
    });
    await email.sendTestEmail();
    assert.deepEqual(transportOptions, {
      host: 'costagrande.com.pe',
      port: 465,
      secure: true,
      auth: { user: 'ventas@costagrande.com.pe', pass: 'secreto-de-prueba' },
    });
    assert.equal(message.to, 'ventas@costagrande.com.pe');
    assert.equal(message.from, 'ventas@costagrande.com.pe');
  } finally {
    nodemailer.createTransport = originalCreateTransport;
    delete require.cache[databaseModule];
  }
});
