const productList = document.querySelector('#product-list');
const productSelect = document.querySelector('#product-select');
const kpiList = document.querySelector('#kpi-list');
let whatsappNumber = '';
let timelineItems = [];
let activeTimelineItem = 0;
let bannerItems = [];
let activeBannerItem = 0;
let bannerTimer = null;
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));

function contactByWhatsApp(message) {
  if (!whatsappNumber) { alert('No hay número de WhatsApp configurado. Comunícate con la empresa por sus canales de atención.'); return; }
  window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

async function loadWhatsAppSettings() { const settings = await fetch('/api/company-settings').then((response) => response.json()); whatsappNumber = settings.whatsappNumber || ''; }
async function loadBanners() { bannerItems = await fetch('/api/banners').then((response) => response.json()); activeBannerItem = 0; clearInterval(bannerTimer); renderBanner(); if (bannerItems.length > 1) bannerTimer = setInterval(() => { activeBannerItem = (activeBannerItem + 1) % bannerItems.length; renderBanner(); }, 15000); }
function renderBanner() { const slider = document.querySelector('#banner-slider'); if (!bannerItems.length) { slider.parentElement.classList.add('hidden'); return; } const banner = bannerItems[activeBannerItem]; slider.innerHTML = `<img class="banner-slide" src="${banner.image}" alt="Banner publicitario ${activeBannerItem + 1}">`; }
async function loadKpis() { const kpis = await fetch('/api/kpis').then((response) => response.json()); kpiList.innerHTML = kpis.map((kpi) => `<article class="kpi-card"><span class="kpi-value">${escapeHtml(kpi.value)}</span><h3>${escapeHtml(kpi.title)}</h3><p>${escapeHtml(kpi.description || '')}</p></article>`).join(''); }
async function loadTimeline() { timelineItems = await fetch('/api/timeline').then((response) => response.json()); activeTimelineItem = 0; renderTimeline(); }
function renderTimeline() { if (!timelineItems.length) return; const item = timelineItems[activeTimelineItem]; const previous = activeTimelineItem > 0 ? timelineItems[activeTimelineItem - 1] : null; const next = activeTimelineItem < timelineItems.length - 1 ? timelineItems[activeTimelineItem + 1] : null; const image = item.image ? `<img class="timeline-image" src="${item.image}" alt="${escapeHtml(item.title)}">` : ''; document.querySelector('#timeline-slider').innerHTML = `<article class="timeline-slide"><div class="timeline-side">${previous ? `<strong>${escapeHtml(previous.year)}</strong><p>${escapeHtml(previous.title)}</p>` : ''}</div><div class="timeline-featured ${image ? 'with-image' : ''}"><div><time>${escapeHtml(item.year)}</time><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></div>${image}</div><div class="timeline-side">${next ? `<strong>${escapeHtml(next.year)}</strong><p>${escapeHtml(next.title)}</p>` : ''}</div></article>`; document.querySelector('#timeline-dots').innerHTML = timelineItems.map((entry, index) => `<button class="timeline-dot ${index === activeTimelineItem ? 'active' : ''}" type="button" aria-label="Ver año ${escapeHtml(entry.year)}"></button>`).join(''); document.querySelector('#timeline-previous').disabled = !previous; document.querySelector('#timeline-next').disabled = !next; document.querySelectorAll('.timeline-dot').forEach((button, index) => button.addEventListener('click', () => { activeTimelineItem = index; renderTimeline(); })); }
function moveTimeline(direction) { const target = activeTimelineItem + direction; if (target < 0 || target >= timelineItems.length) return; activeTimelineItem = target; renderTimeline(); }
document.querySelector('#timeline-previous').addEventListener('click', () => moveTimeline(-1)); document.querySelector('#timeline-next').addEventListener('click', () => moveTimeline(1)); let timelineTouchStart = 0; document.querySelector('#timeline-slider').addEventListener('touchstart', (event) => { timelineTouchStart = event.changedTouches[0].screenX; }, { passive: true }); document.querySelector('#timeline-slider').addEventListener('touchend', (event) => { const distance = event.changedTouches[0].screenX - timelineTouchStart; if (Math.abs(distance) > 40) moveTimeline(distance < 0 ? 1 : -1); }, { passive: true });
document.querySelector('#whatsapp-general').addEventListener('click', () => contactByWhatsApp('Hola, deseo comunicarme con atención comercial.'));

const mobileMenuToggle = document.querySelector('#mobile-menu-toggle');
const mainNavigation = document.querySelector('#main-navigation');
mobileMenuToggle.addEventListener('click', () => {
  const isOpen = mainNavigation.classList.toggle('is-open');
  mobileMenuToggle.classList.toggle('is-open', isOpen);
  mobileMenuToggle.setAttribute('aria-expanded', String(isOpen));
  mobileMenuToggle.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
});
mainNavigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  mainNavigation.classList.remove('is-open'); mobileMenuToggle.classList.remove('is-open'); mobileMenuToggle.setAttribute('aria-expanded', 'false'); mobileMenuToggle.setAttribute('aria-label', 'Abrir menú');
}));

async function loadProducts() {
  const products = await fetch('/api/products').then((response) => response.json());
  productList.innerHTML = products.map((product) => { const visual = product.image && product.image.startsWith('data:image/') ? `<img class="product-photo" src="${product.image}" alt="${escapeHtml(product.name)}">` : `<div class="product-icon">${escapeHtml(product.image || '📦')}</div>`; return `<article class="product product-card" tabindex="0">${visual}<div class="product-name"><h3>${escapeHtml(product.name)}</h3></div><div class="product-details"><p class="category">${escapeHtml(product.category)}</p><p>${escapeHtml(product.description)}</p><button class="button select-product" data-product="${escapeHtml(product.name)}">Cotizar este producto</button><button class="text-button whatsapp-product" data-product="${escapeHtml(product.name)}">Consultar por WhatsApp</button></div></article>`; }).join('');
  productSelect.innerHTML = `<option value="">Selecciona un producto</option>${products.map((product) => `<option>${escapeHtml(product.name)}</option>`).join('')}`;
  const heroVisual = document.querySelector('#hero-visual');
  const heroProduct = products.find((product) => product.image && product.image.startsWith('data:image/'));
  if (heroProduct) { heroVisual.style.setProperty('--hero-image', `url("${heroProduct.image}")`); heroVisual.classList.add('has-image'); }
  document.querySelectorAll('.select-product').forEach((button) => button.addEventListener('click', () => { productSelect.value = button.dataset.product; document.querySelector('#cotizacion').scrollIntoView({ behavior: 'smooth' }); }));
  document.querySelectorAll('.whatsapp-product').forEach((button) => button.addEventListener('click', () => contactByWhatsApp(`Hola, deseo consultar por el producto: ${button.dataset.product}.`)));
}

document.querySelector('#quote-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const response = await fetch('/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) });
  const data = await response.json();
  document.querySelector('#quote-message').textContent = data.message;
  if (response.ok) event.target.reset();
});

fetch('/api/auth/me').then(async (response) => { if (!response.ok) return; const { user } = await response.json(); const trackingAccess = document.querySelector('#tracking-access'); const sessionMenu = document.querySelector('#session-menu'); const destination = user.role === 'cliente' ? '/cuenta' : '/admin'; trackingAccess.href = destination; trackingAccess.textContent = user.role === 'cliente' ? 'Ver mis pedidos' : 'Ir a administración'; sessionMenu.innerHTML = `<button id="session-access" class="session-access session-icon" aria-label="Abrir menú de usuario">👤</button><div id="session-dropdown" class="session-dropdown hidden"><a href="${destination}">${user.role === 'cliente' ? 'Mi cuenta' : 'Administración'}</a><button id="session-logout">Cerrar sesión</button></div>`; document.querySelector('#session-access').onclick = () => document.querySelector('#session-dropdown').classList.toggle('hidden'); document.querySelector('#session-logout').onclick = async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.reload(); }; if (user.role === 'cliente') { const clientResponse = await fetch('/api/my/client'); if (!clientResponse.ok) return; const client = await clientResponse.json(); const quoteForm = document.querySelector('#quote-form'); quoteForm.elements.name.value = client.name || ''; quoteForm.elements.email.value = client.email || ''; quoteForm.elements.name.readOnly = true; quoteForm.elements.email.readOnly = true; document.querySelector('#quote-account-note').classList.remove('hidden'); } });

Promise.all([loadWhatsAppSettings(), loadBanners(), loadProducts(), loadKpis(), loadTimeline()]);

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); sectionObserver.unobserve(entry.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('main > .section:not(.hero)').forEach((section) => sectionObserver.observe(section));
