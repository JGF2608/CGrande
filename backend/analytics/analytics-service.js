const repository = require('./analytics-repository');

const allowedEvents = new Set(['visita_web', 'categoria_abierta', 'producto_consultado', 'clic_whatsapp']);
const cleanText = (value, limit = 120) => String(value || '').trim().replace(/[<>]/g, '').slice(0, limit);

function createAnalyticsService({ getBusinessSnapshot }) {
  function enabled() { return String(process.env.ANALYTICS_ENABLED || 'false').toLowerCase() === 'true'; }
  function recordEvent(data) {
    if (!enabled() || !allowedEvents.has(data.type)) return false;
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
    if (!enabled()) return null;
    return { enabled: true, behavior: repository.behaviorSummary(), business: getBusinessSnapshot() };
  }
  return { enabled, recordEvent, getDashboard };
}

module.exports = { createAnalyticsService };
