/* TABLA MAESTRO + DETALLE: vista compartida por administración, ventas y clientes. */
(function initializeDocumentTable() {
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
  const money = (value) => `S/. ${Number(value || 0).toFixed(2)}`;
  const documentTotal = (document) => (document.items || []).reduce((total, item) => total + (Number(item.quantity || 0) * Number(item.price || 0)), 0);
  const formatDate = (value) => {
    if (!value) return 'Sin fecha';
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value);
  };
  const itemSummary = (items = []) => {
    if (!items.length) return 'Sin productos';
    const names = items.slice(0, 2).map((item) => item.product).join(', ');
    return `${names}${items.length > 2 ? ` +${items.length - 2}` : ''}`;
  };
  const statusTone = (status = '') => {
    const normalized = String(status).toLowerCase();
    if (normalized.includes('entregado') || normalized.includes('aprobada')) return 'is-success';
    if (normalized.includes('cancel')) return 'is-danger';
    if (normalized.includes('camino') || normalized.includes('revisada')) return 'is-info';
    return 'is-pending';
  };
  const statusBadge = (status) => `<span class="document-status ${statusTone(status)}"><i></i>${escapeHtml(status || 'Sin estado')}</span>`;
  const masterColumnDefaults = [106, 116, 196, 120, 136];
  const detailColumnDefaults = [44, 158, 104, 108, 112];
  const masterColumnMinimums = [82, 92, 120, 105, 108];
  const detailColumnMinimums = [38, 100, 82, 96, 100];
  const csvCell = (value = '') => `"${String(value ?? '').replace(/"/g, '""')}"`;

  function savedColumnWidths(key, defaults) {
    try {
      const widths = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(widths) && widths.length === defaults.length && widths.every((width) => Number.isFinite(width))) return widths;
    } catch (error) {
      // Si el navegador bloquea localStorage, se conservan los anchos predeterminados.
    }
    return [...defaults];
  }

  function saveColumnWidths(key, widths) {
    try { localStorage.setItem(key, JSON.stringify(widths)); } catch (error) { /* Preferencia opcional. */ }
  }

  function resizableHeader(label, index) {
    return `${label}<span class="document-column-resizer" data-column-index="${index}" role="separator" aria-label="Cambiar ancho de ${label}" aria-orientation="vertical" tabindex="0"></span>`;
  }

  function columnGroup(widths) {
    return `<colgroup>${widths.map((width) => `<col style="width:${width}px">`).join('')}</colgroup>`;
  }

  function enableColumnResize(table, storageKey, widths, minimums) {
    if (!table) return;
    const scroll = table.closest('.document-table-scroll');
    const columns = [...table.querySelectorAll('col')];
    const applyWidths = () => {
      widths.forEach((width, index) => { if (columns[index]) columns[index].style.width = `${width}px`; });
      table.style.width = `${Math.max(widths.reduce((total, width) => total + width, 0), scroll?.clientWidth || 0)}px`;
      saveColumnWidths(storageKey, widths);
    };
    const resizeBy = (index, difference) => {
      widths[index] = Math.max(minimums[index] || 70, Math.round(widths[index] + difference));
      applyWidths();
    };
    table.querySelectorAll('.document-column-resizer').forEach((handle) => {
      const index = Number(handle.dataset.columnIndex);
      handle.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const startX = event.clientX;
        const startWidth = widths[index];
        handle.classList.add('is-resizing');
        document.body.classList.add('document-column-resizing');
        const move = (moveEvent) => {
          widths[index] = Math.max(minimums[index] || 70, Math.round(startWidth + moveEvent.clientX - startX));
          applyWidths();
        };
        const stop = () => {
          handle.classList.remove('is-resizing');
          document.body.classList.remove('document-column-resizing');
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', stop);
          window.removeEventListener('pointercancel', stop);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop, { once: true });
        window.addEventListener('pointercancel', stop, { once: true });
      });
      handle.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        resizeBy(index, event.key === 'ArrowLeft' ? -12 : 12);
      });
      handle.addEventListener('dblclick', () => {
        widths[index] = table.classList.contains('document-master-table') ? masterColumnDefaults[index] : detailColumnDefaults[index];
        applyWidths();
      });
    });
    applyWidths();
  }

  function exportDocuments(documents, configuration, showCustomer, customerOf, emailOf, phoneOf) {
    const type = configuration.exportName || (String(configuration.detailLabel || '').toLowerCase().includes('pedido') ? 'pedidos' : 'cotizaciones');
    const headers = ['Tipo', 'Código', 'Fecha', 'Estado'];
    if (showCustomer) headers.push('Contacto', 'Correo', 'Teléfono');
    headers.push('Producto', 'Cantidad', 'Unidad', 'Precio unitario', 'Subtotal', 'Total del documento', 'Observaciones', 'Entrega estimada', 'Documento de origen');
    const rows = documents.flatMap((document) => {
      const items = document.items?.length ? document.items : [{}];
      return items.map((item) => {
        const row = [type === 'pedidos' ? 'Pedido' : 'Cotización', document.code, formatDate(document.createdAt), document.status || ''];
        if (showCustomer) row.push(customerOf(document), emailOf(document), phoneOf(document));
        row.push(item.product || '', item.quantity ?? '', item.unit || '', Number(item.price || 0).toFixed(2), Number((item.quantity || 0) * (item.price || 0)).toFixed(2), documentTotal(document).toFixed(2), document.message || '', document.estimatedDeliveryDate ? formatDate(document.estimatedDeliveryDate) : '', document.quoteCode || document.orderCode || '');
        return row;
      });
    });
    const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function render(container, documents, configuration = {}) {
    if (!container) return null;
    const records = Array.isArray(documents) ? documents : [];
    if (!records.length) {
      container.innerHTML = `<p class="document-empty">${escapeHtml(configuration.emptyMessage || 'Aún no hay registros.')}</p>`;
      return null;
    }

    const keyOf = (document) => String(document.id ?? document.code);
    const customerOf = configuration.customer || ((document) => document.name || document.customer || 'Cliente');
    const emailOf = configuration.email || ((document) => document.email || document.customerEmail || '');
    const phoneOf = configuration.phone || ((document) => document.phone || document.customerPhone || '');
    const showCustomer = configuration.showCustomer !== false;
    const tableKey = `${location.pathname}:${container.id || configuration.detailLabel || 'documentos'}`;
    const masterWidths = savedColumnWidths(`document-columns:master:${tableKey}`, masterColumnDefaults);
    const detailWidths = savedColumnWidths(`document-columns:detail:${tableKey}`, detailColumnDefaults);
    let selectedKey = container.dataset.selectedDocument || keyOf(records[0]);
    let query = '';

    function draw() {
      const normalizedQuery = query.trim().toLowerCase();
      const filtered = records.filter((document) => {
        if (!normalizedQuery) return true;
        const searchable = [document.code, document.status, customerOf(document), emailOf(document), phoneOf(document), ...(document.items || []).map((item) => item.product)].join(' ').toLowerCase();
        return searchable.includes(normalizedQuery);
      });
      if (!filtered.some((document) => keyOf(document) === selectedKey)) selectedKey = filtered.length ? keyOf(filtered[0]) : '';
      container.dataset.selectedDocument = selectedKey;
      const selected = filtered.find((document) => keyOf(document) === selectedKey);
      const rows = filtered.map((document) => {
        const key = keyOf(document);
        const selectedClass = key === selectedKey ? ' is-selected' : '';
        const secondary = showCustomer ? customerOf(document) : itemSummary(document.items);
        return `<tr class="document-master-row${selectedClass}" data-document-key="${escapeHtml(key)}" tabindex="0" aria-selected="${key === selectedKey}">
          <td><strong>${escapeHtml(document.code)}</strong></td>
          <td>${escapeHtml(formatDate(document.createdAt))}</td>
          <td>${escapeHtml(secondary)}</td>
          <td class="document-money">${money(documentTotal(document))}</td>
          <td>${statusBadge(document.status)}</td>
        </tr>`;
      }).join('');
      const metadata = selected ? [
        showCustomer && customerOf(selected) ? ['Contacto', customerOf(selected)] : null,
        showCustomer && emailOf(selected) ? ['Correo', emailOf(selected)] : null,
        showCustomer && phoneOf(selected) ? ['Teléfono', phoneOf(selected)] : null,
        ['Fecha', formatDate(selected.createdAt)],
        selected.estimatedDeliveryDate ? ['Entrega estimada', formatDate(selected.estimatedDeliveryDate)] : null,
        selected.quoteCode ? ['Cotización de origen', selected.quoteCode] : null,
        selected.orderCode ? ['Pedido asociado', selected.orderCode] : null
      ].filter(Boolean) : [];
      const items = selected ? (selected.items || []).map((item, index) => `<tr>
        <td class="document-line-number">${index + 1}</td>
        <td>${escapeHtml(item.product)}</td>
        <td>${escapeHtml(item.quantity)} ${escapeHtml(item.unit || '')}</td>
        <td>${money(item.price)}</td>
        <td class="document-money">${money(Number(item.quantity || 0) * Number(item.price || 0))}</td>
      </tr>`).join('') : '';
      const actions = selected && configuration.actions ? configuration.actions(selected) : '';
      const note = selected?.message ? `<div class="document-note"><strong>Observaciones</strong><p>${escapeHtml(selected.message)}</p></div>` : '';

      container.innerHTML = `<div class="document-toolbar">
          <label><span>Buscar</span><input class="document-search" type="search" value="${escapeHtml(query)}" placeholder="Código, cliente, estado o producto"></label>
          <div class="document-toolbar-actions"><small>${filtered.length} de ${records.length} registros</small><button class="button document-export" type="button">Exportar a Excel</button></div>
        </div>
        <div class="document-workspace">
          <div class="document-master">
            <div class="document-table-scroll"><table class="document-master-table">
              ${columnGroup(masterWidths)}
              <thead><tr><th>${resizableHeader('Código', 0)}</th><th>${resizableHeader('Fecha', 1)}</th><th>${resizableHeader(showCustomer ? 'Contacto' : 'Productos', 2)}</th><th>${resizableHeader('Total', 3)}</th><th>${resizableHeader('Estado', 4)}</th></tr></thead>
              <tbody>${rows || '<tr><td colspan="5">No hay coincidencias.</td></tr>'}</tbody>
            </table></div>
            <small class="document-master-hint">Selecciona una fila para revisar su detalle.</small>
          </div>
          <aside class="document-detail" aria-live="polite">
            ${selected ? `<header class="document-detail-header">
                <div><small>${escapeHtml(configuration.detailLabel || 'Registro seleccionado')}</small><strong>${escapeHtml(selected.code)}</strong></div>
                ${statusBadge(selected.status)}
              </header>
              <div class="document-detail-meta">${metadata.map(([label, value]) => `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></span>`).join('')}</div>
              <div class="document-detail-items"><div class="document-table-scroll"><table>
                ${columnGroup(detailWidths)}
                <thead><tr><th>${resizableHeader('#', 0)}</th><th>${resizableHeader('Producto', 1)}</th><th>${resizableHeader('Cantidad', 2)}</th><th>${resizableHeader('Precio unit.', 3)}</th><th>${resizableHeader('Subtotal', 4)}</th></tr></thead>
                <tbody>${items || '<tr><td colspan="5">Sin productos registrados.</td></tr>'}</tbody>
              </table></div></div>
              ${note}
              <div class="document-detail-total"><span>Total</span><strong>${money(documentTotal(selected))}</strong></div>
              ${actions ? `<div class="document-detail-actions">${actions}</div>` : ''}` : '<p class="document-empty">Selecciona un registro para ver su detalle.</p>'}
          </aside>
        </div>`;

      container.querySelector('.document-search')?.addEventListener('input', (event) => {
        const cursor = event.target.selectionStart;
        query = event.target.value;
        draw();
        const search = container.querySelector('.document-search');
        search?.focus();
        search?.setSelectionRange(cursor, cursor);
      });
      container.querySelector('.document-export')?.addEventListener('click', () => exportDocuments(filtered, configuration, showCustomer, customerOf, emailOf, phoneOf));
      enableColumnResize(container.querySelector('.document-master-table'), `document-columns:master:${tableKey}`, masterWidths, masterColumnMinimums);
      enableColumnResize(container.querySelector('.document-detail-items table'), `document-columns:detail:${tableKey}`, detailWidths, detailColumnMinimums);
      container.querySelectorAll('.document-master-row').forEach((row) => {
        const selectRow = () => { selectedKey = row.dataset.documentKey; draw(); };
        row.addEventListener('click', selectRow);
        row.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectRow();
          }
        });
      });
      if (selected && configuration.afterRender) configuration.afterRender(container, selected);
    }

    draw();
    return { redraw: draw };
  }

  window.CostaGrandeDocumentTable = { render, escapeHtml, money, documentTotal, formatDate };
}());
