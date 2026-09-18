const repository = require('./analytics-repository');

// Limita los tipos de eventos que admite la medición web.
const allowedEvents = new Set(['visita_web', 'categoria_abierta', 'producto_consultado', 'clic_whatsapp']);
const cleanText = (value, limit = 120) => String(value || '').trim().replace(/[<>]/g, '').slice(0, limit);

// Expone el registro de eventos y el resumen para el dashboard.
function createAnalyticsService({ getBusinessSnapshot }) {
  // Mantiene habilitados el registro de estadísticas y el dashboard sin depender del entorno.
  function enabled() { return true; }
  function recordEvent(data) {
    if (!allowedEvents.has(data.type)) return false;
    const session = cleanText(data.session, 96);
    if (!session || !/^[a-zA-Z0-9_-]{12,96}$/.test(session)) throw new Error('Sesión de analítica inválida.');
    repository.record({
      type: data.type,
      session,
      categoryId: Number.isInteger(Number(data.categoryId)) ? Number(data.categoryId) : null,
      categoryName: cleanText(data.categoryName),
      productName: cleanText(data.productName),
      path: cleanText(data.path, 180),
    });
    return true;
  }
  function getDashboard() {
    return { enabled: true, behavior: repository.behaviorSummary(), business: getBusinessSnapshot() };
  }
  return { enabled, recordEvent, getDashboard };
}

module.exports = { createAnalyticsService };
