const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('reactiva clientes, usuarios de ventas, categorías y productos existentes', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'costa-grande-reactivation-'));
  const verificationScript = String.raw`
    const assert = require('node:assert/strict');
    const repository = require('./base_de_datos/base_de_datos');

    const clientData = {
      name: 'Cliente de prueba',
      email: 'cliente-reactivar@prueba.test',
      phone: '934567891',
      company: 'Empresa de prueba',
      documentType: 'DNI',
      documentNumber: '12345678',
      address: 'Dirección de prueba',
      department: 'San Martín',
      province: 'San Martín',
      district: 'Tarapoto',
      temporaryPassword: 'Temporal123'
    };
    const client = repository.createClient(clientData);
    assert.equal(repository.deleteClient(client.id), true);
    assert.equal(repository.listInactiveClients().some(item => item.id === client.id), true);
    const restoredClient = repository.createClient({ ...clientData, name: 'Cliente actualizado', temporaryPassword: 'NuevaClave123' });
    assert.equal(restoredClient.id, client.id);
    assert.equal(restoredClient.reactivated, true);
    assert.equal(repository.authenticate(clientData.email, 'Temporal123'), null);
    assert.equal(repository.authenticate(clientData.email, 'NuevaClave123').mustChangePassword, true);
    assert.equal(repository.listInactiveClients().some(item => item.id === client.id), false);
    const manuallyRestoredClient = repository.createClient({ ...clientData, email: 'cliente-manual@prueba.test' });
    repository.deleteClient(manuallyRestoredClient.id);
    assert.equal(repository.reactivateClient(manuallyRestoredClient.id).id, manuallyRestoredClient.id);
    assert.equal(repository.authenticate('cliente-manual@prueba.test', 'Temporal123').role, 'cliente');

    const salesData = { name: 'Vendedor de prueba', email: 'ventas-reactivar@prueba.test', phone: '987654321', documentNumber: '87654321', temporaryPassword: 'Temporal123' };
    const salesUser = repository.createSalesUser(salesData);
    assert.equal(repository.deleteSalesUser(salesUser.id), true);
    assert.equal(repository.listInactiveSalesUsers().some(item => item.id === salesUser.id), true);
    const restoredSalesUser = repository.createSalesUser({ ...salesData, name: 'Vendedor actualizado', temporaryPassword: 'NuevaClave123' });
    assert.equal(restoredSalesUser.id, salesUser.id);
    assert.equal(restoredSalesUser.userCode, salesUser.userCode);
    assert.equal(restoredSalesUser.reactivated, true);
    assert.equal(repository.authenticate(salesData.email, 'Temporal123'), null);
    assert.equal(repository.authenticate(salesData.email, 'NuevaClave123').mustChangePassword, true);
    assert.equal(repository.listInactiveSalesUsers().some(item => item.id === salesUser.id), false);
    const manuallyRestoredSalesUser = repository.createSalesUser({ ...salesData, email: 'ventas-manual@prueba.test' });
    repository.deleteSalesUser(manuallyRestoredSalesUser.id);
    assert.equal(repository.reactivateSalesUser(manuallyRestoredSalesUser.id).id, manuallyRestoredSalesUser.id);
    assert.equal(repository.authenticate('ventas-manual@prueba.test', 'Temporal123').role, 'ventas');

    const category = repository.createCategory({ name: 'Categoría para reactivar', description: 'Inicial' });
    assert.equal(repository.deleteCategory(category.id), true);
    assert.equal(repository.listInactiveCategories().some(item => item.id === category.id), true);
    const restoredCategory = repository.createCategory({ name: category.name, description: 'Actualizada' });
    assert.equal(restoredCategory.id, category.id);
    assert.equal(restoredCategory.reactivated, true);
    assert.equal(repository.listCategories().some(item => item.id === category.id), true);

    const unit = repository.listUnits()[0].abbreviation;
    const product = repository.createProduct({ name: 'Producto para reactivar', categoryId: category.id, unit, description: '' });
    assert.equal(repository.deleteProduct(product.id), true);
    assert.equal(repository.listInactiveProducts().some(item => item.id === product.id), true);
    assert.equal(repository.reactivateProduct(product.id).id, product.id);

    const dependentCategory = repository.createCategory({ name: 'Categoría dependiente', description: '' });
    const dependentProduct = repository.createProduct({ name: 'Producto dependiente', categoryId: dependentCategory.id, unit, description: '' });
    repository.deleteProduct(dependentProduct.id);
    repository.deleteCategory(dependentCategory.id);
    assert.throws(() => repository.reactivateProduct(dependentProduct.id), /La categoría del producto está inactiva, debes activarla primero/);
    assert.equal(repository.reactivateCategory(dependentCategory.id).id, dependentCategory.id);
    assert.equal(repository.reactivateProduct(dependentProduct.id).id, dependentProduct.id);
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
