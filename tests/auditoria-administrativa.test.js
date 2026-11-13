const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('registra actor, acción y campos sin guardar contraseñas', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'costa-grande-audit-'));
  const verificationScript = String.raw`
    const assert = require('node:assert/strict');
    const repository = require('./base_de_datos/base_de_datos');
    const actor = { id: 1, email: 'admin@prueba.test', role: 'administracion' };

    const category = repository.createCategory({ name: 'Categoría auditada', description: 'Inicial' }, actor);
    repository.updateCategory(category.id, { name: category.name, description: 'Actualizada' }, actor);
    repository.deleteCategory(category.id, actor);
    repository.reactivateCategory(category.id, actor);

    const unit = repository.listUnits()[0].abbreviation;
    const product = repository.createProduct({ name: 'Producto auditado', categoryId: category.id, description: '', unit }, actor);
    repository.deleteProduct(product.id, actor);
    repository.reactivateProduct(product.id, actor);

    const salesUser = repository.createSalesUser({ name: 'Usuario auditado', email: 'ventas@prueba.test', phone: '987654321', documentNumber: '12345678', temporaryPassword: 'SecretoTemporal123' }, actor);
    repository.updateSalesUser(salesUser.id, { name: 'Usuario editado', email: salesUser.email, phone: salesUser.phone, documentNumber: salesUser.documentNumber, temporaryPassword: 'OtroSecreto123' }, actor);
    repository.deleteSalesUser(salesUser.id, actor);
    repository.reactivateSalesUser(salesUser.id, actor);

    const client = repository.createClient({ name: 'Cliente auditado', email: 'cliente@prueba.test', phone: '912345678', company: '', documentType: 'DNI', documentNumber: '12345678', address: 'Dirección de prueba', department: 'San Martín', province: 'San Martín', district: 'Tarapoto', temporaryPassword: 'ClavePrivada123' }, actor);
    repository.deleteClient(client.id, actor);
    repository.reactivateClient(client.id, actor);

    const events = repository.listAuditEvents();
    assert.ok(events.length >= 13);
    assert.ok(events.some(event => event.entity === 'categoria' && event.action === 'modificado' && event.changedFields.includes('description')));
    assert.ok(events.some(event => event.entity === 'producto' && event.action === 'desactivado'));
    assert.ok(events.some(event => event.entity === 'usuario_ventas' && event.action === 'reactivado'));
    assert.ok(events.some(event => event.entity === 'cliente' && event.action === 'desactivado'));
    assert.ok(events.some(event => event.entity === 'categoria' && event.entityName === 'Categoría auditada'));
    assert.ok(events.some(event => event.entity === 'producto' && event.entityName === 'Producto auditado'));
    assert.ok(events.some(event => event.entity === 'usuario_ventas' && event.entityName === 'Usuario editado'));
    assert.ok(events.some(event => event.entity === 'cliente' && event.entityName === 'Cliente auditado'));
    assert.ok(events.every(event => event.actorId === actor.id && event.actorEmail === actor.email && event.actorRole === actor.role));
    assert.ok(!JSON.stringify(events).includes('SecretoTemporal123'));
    assert.ok(!JSON.stringify(events).includes('OtroSecreto123'));
    assert.ok(!JSON.stringify(events).includes('ClavePrivada123'));
  `;

  try {
    const result = spawnSync(process.execPath, ['-e', verificationScript], {
      cwd: projectRoot,
      env: { ...process.env, APP_DATA_DIR: dataDirectory },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  }
});
