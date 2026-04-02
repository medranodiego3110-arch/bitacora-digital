/**
 * app.js - Lógica principal de Bitácora Digital Construrike
 * Captura: foto, GPS, timestamp, clima, conectividad, personal, maquinaria, volúmenes
 * Config: obra y residente persistentes
 */

// ─── ESTADO DE LA APLICACIÓN ───
const appState = {
  isOnline: navigator.onLine,
  currentPhoto: null,
  currentGPS: null,
  formTimestamp: null,
  cameraStream: null,
  config: { obra: '', residente: '' }
};

// ═══════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════

async function initApp() {
  try {
    await db.open();
    console.log('[APP] Base de datos inicializada');

    await loadConfig();
    setupEventListeners();
    setupConnectivityListeners();
    updateOnlineIndicator();
    await updatePendingBadge();
    await loadRecords();

    console.log('[APP] Aplicación inicializada correctamente');
  } catch (err) {
    console.error('[APP] Error al inicializar:', err);
    showToast('Error al inicializar la aplicación', 'error');
  }
}

// ═══════════════════════════════════════════════════════════
// CONFIGURACIÓN (Obra y Residente)
// ═══════════════════════════════════════════════════════════

async function loadConfig() {
  try {
    const obra = await db.getConfig('obra');
    const residente = await db.getConfig('residente');
    appState.config.obra = obra || '';
    appState.config.residente = residente || '';
    updateConfigBanner();
  } catch (err) {
    console.warn('[APP] No se pudo cargar config:', err);
  }
}

function updateConfigBanner() {
  const bannerObra = document.getElementById('banner-obra');
  const bannerResidente = document.getElementById('banner-residente');

  if (appState.config.obra) {
    bannerObra.textContent = '🏗️ ' + appState.config.obra;
    bannerResidente.textContent = appState.config.residente ? '👷 ' + appState.config.residente : '';
  } else {
    bannerObra.textContent = '⚠️ Configura obra y residente';
    bannerResidente.textContent = '';
  }
}

function openConfigModal() {
  document.getElementById('config-obra').value = appState.config.obra;
  document.getElementById('config-residente').value = appState.config.residente;
  document.getElementById('modal-config').classList.remove('hidden');
  document.getElementById('modal-config').classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeConfigModal() {
  document.getElementById('modal-config').classList.add('hidden');
  document.getElementById('modal-config').classList.remove('flex');
  document.body.style.overflow = '';
}

async function saveConfig() {
  try {
    const obra = document.getElementById('config-obra').value.trim();
    const residente = document.getElementById('config-residente').value.trim();

    await db.setConfig('obra', obra);
    await db.setConfig('residente', residente);

    appState.config.obra = obra;
    appState.config.residente = residente;

    updateConfigBanner();
    closeConfigModal();
    showToast('Configuración guardada', 'success');
  } catch (err) {
    console.error('[APP] Error guardando config:', err);
    showToast('Error al guardar configuración', 'error');
  }
}

// ═══════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════

function setupEventListeners() {
  // Config
  document.getElementById('btn-open-config').addEventListener('click', openConfigModal);
  document.getElementById('btn-close-config').addEventListener('click', closeConfigModal);
  document.getElementById('btn-save-config').addEventListener('click', saveConfig);

  // Nuevo registro
  document.getElementById('btn-new-record').addEventListener('click', openNewRecordForm);
  document.getElementById('btn-close-modal').addEventListener('click', closeRecordForm);
  document.getElementById('btn-take-photo').addEventListener('click', capturePhoto);
  document.getElementById('btn-save-record').addEventListener('click', saveRecord);

  // Validación
  document.getElementById('field-description').addEventListener('input', validateForm);
  document.getElementById('field-tipo').addEventListener('change', validateForm);

  // Exportar
  document.getElementById('btn-export-csv').addEventListener('click', exportToCSV);
  document.getElementById('btn-export-pdf').addEventListener('click', exportToPDF);

  // Filtros
  document.getElementById('filter-date').addEventListener('change', loadRecords);
  document.getElementById('filter-search').addEventListener('input', debounce(loadRecords, 300));

  // Detalle
  document.getElementById('btn-close-detail').addEventListener('click', closeDetailModal);

  // Click fuera de modales
  document.getElementById('modal-record-form').addEventListener('click', (e) => {
    if (e.target.id === 'modal-record-form') closeRecordForm();
  });
  document.getElementById('modal-detail').addEventListener('click', (e) => {
    if (e.target.id === 'modal-detail') closeDetailModal();
  });
  document.getElementById('modal-config').addEventListener('click', (e) => {
    if (e.target.id === 'modal-config') closeConfigModal();
  });
}

function setupConnectivityListeners() {
  window.addEventListener('online', () => {
    appState.isOnline = true;
    updateOnlineIndicator();
    showToast('Conexión restaurada', 'success');
  });

  window.addEventListener('offline', () => {
    appState.isOnline = false;
    updateOnlineIndicator();
    showToast('Sin conexión — los registros se guardan localmente', 'warning');
  });
}

// ═══════════════════════════════════════════════════════════
// CONECTIVIDAD
// ═══════════════════════════════════════════════════════════

function updateOnlineIndicator() {
  const indicator = document.getElementById('online-indicator');
  const dot = document.getElementById('online-dot');
  const text = document.getElementById('online-text');

  if (appState.isOnline) {
    dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse';
    text.textContent = 'Online';
    indicator.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-900/40 border border-emerald-700/50 text-emerald-300 text-xs font-medium';
  } else {
    dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-400';
    text.textContent = 'Offline';
    indicator.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-900/40 border border-amber-700/50 text-amber-300 text-xs font-medium';
  }
}

async function updatePendingBadge() {
  try {
    const count = await db.countPending();
    const badge = document.getElementById('pending-badge');
    if (count > 0) {
      badge.textContent = count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch (err) {
    console.error('[APP] Error actualizando badge:', err);
  }
}

// ═══════════════════════════════════════════════════════════
// FORMULARIO DE CAPTURA
// ═══════════════════════════════════════════════════════════

function openNewRecordForm() {
  // Verificar config
  if (!appState.config.obra) {
    showToast('Primero configura el nombre de la obra', 'warning');
    openConfigModal();
    return;
  }

  // Resetear estado
  appState.currentPhoto = null;
  appState.currentGPS = null;
  appState.formTimestamp = new Date().toISOString();

  // Resetear campos
  document.getElementById('photo-preview').classList.add('hidden');
  document.getElementById('photo-placeholder').classList.remove('hidden');
  document.getElementById('field-description').value = '';
  document.getElementById('field-volumenes').value = '';
  document.getElementById('field-personal').value = '';
  document.getElementById('field-maquinaria').value = '';
  document.getElementById('field-tipo').value = 'Normal';
  document.getElementById('field-clima').value = 'Bueno';
  document.getElementById('field-conectividad').value = appState.isOnline ? 'Buena' : 'Sin señal';
  document.getElementById('desc-counter').textContent = '0/20 caracteres mínimo';
  document.getElementById('desc-counter').className = 'text-xs text-slate-400 mt-1';

  // Timestamp
  const ts = new Date(appState.formTimestamp);
  document.getElementById('display-timestamp').textContent = formatDateTime(ts);

  // GPS
  getGPS();

  // Deshabilitar guardar
  document.getElementById('btn-save-record').disabled = true;

  // Mostrar modal
  document.getElementById('modal-record-form').classList.remove('hidden');
  document.getElementById('modal-record-form').classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeRecordForm() {
  stopCameraStream();
  document.getElementById('modal-record-form').classList.add('hidden');
  document.getElementById('modal-record-form').classList.remove('flex');
  document.body.style.overflow = '';
}

// ═══════════════════════════════════════════════════════════
// CÁMARA
// ═══════════════════════════════════════════════════════════

async function capturePhoto() {
  const btnPhoto = document.getElementById('btn-take-photo');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Tu navegador no soporta acceso a la cámara', 'error');
    return;
  }

  try {
    btnPhoto.disabled = true;
    btnPhoto.innerHTML = '<span class="animate-spin inline-block mr-2">⏳</span> Abriendo cámara...';

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } }
    });
    appState.cameraStream = stream;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');

    await new Promise((resolve) => { video.onloadedmetadata = () => { video.play(); resolve(); }; });
    await new Promise(r => setTimeout(r, 500));

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    appState.currentPhoto = canvas.toDataURL('image/jpeg', 0.7);
    stopCameraStream();

    const preview = document.getElementById('photo-preview');
    document.getElementById('photo-preview-img').src = appState.currentPhoto;
    preview.classList.remove('hidden');
    document.getElementById('photo-placeholder').classList.add('hidden');

    btnPhoto.innerHTML = '📷 Retomar Foto';
    btnPhoto.disabled = false;
    validateForm();
    showToast('Foto capturada', 'success');

  } catch (err) {
    console.error('[APP] Error al capturar foto:', err);
    stopCameraStream();

    if (err.name === 'NotAllowedError') {
      showToast('Permiso de cámara denegado. Actívalo en configuración del navegador.', 'error');
    } else if (err.name === 'NotFoundError') {
      showToast('No se encontró cámara en el dispositivo', 'error');
    } else {
      showToast('Error al acceder a la cámara: ' + err.message, 'error');
    }
    btnPhoto.innerHTML = '📷 Tomar Foto';
    btnPhoto.disabled = false;
  }
}

function stopCameraStream() {
  if (appState.cameraStream) {
    appState.cameraStream.getTracks().forEach(track => track.stop());
    appState.cameraStream = null;
  }
}

// ═══════════════════════════════════════════════════════════
// GPS
// ═══════════════════════════════════════════════════════════

function getGPS() {
  const gpsDisplay = document.getElementById('display-gps');
  const gpsStatus = document.getElementById('gps-status');

  if (!navigator.geolocation) {
    gpsDisplay.textContent = 'Geolocalización no soportada';
    gpsStatus.className = 'text-red-400 text-xs';
    gpsStatus.textContent = '❌ No disponible';
    return;
  }

  gpsDisplay.textContent = 'Obteniendo ubicación...';
  gpsStatus.className = 'text-amber-400 text-xs animate-pulse';
  gpsStatus.textContent = '⏳ Localizando...';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      appState.currentGPS = {
        lat: parseFloat(position.coords.latitude.toFixed(6)),
        lng: parseFloat(position.coords.longitude.toFixed(6))
      };
      gpsDisplay.textContent = `${appState.currentGPS.lat}, ${appState.currentGPS.lng}`;
      gpsStatus.className = 'text-emerald-400 text-xs';
      gpsStatus.textContent = '✅ GPS obtenido';
      validateForm();
    },
    (error) => {
      appState.currentGPS = null;
      gpsDisplay.textContent = 'No se pudo obtener ubicación';
      gpsStatus.className = 'text-red-400 text-xs';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          gpsStatus.textContent = '❌ Permiso denegado — Activa ubicación en configuración';
          showToast('Permiso de ubicación denegado.', 'error');
          break;
        case error.POSITION_UNAVAILABLE:
          gpsStatus.textContent = '❌ Ubicación no disponible';
          showToast('GPS no disponible.', 'error');
          break;
        case error.TIMEOUT:
          gpsStatus.textContent = '❌ Tiempo agotado — Reintenta';
          showToast('Tiempo agotado al obtener GPS.', 'error');
          break;
        default:
          gpsStatus.textContent = '❌ Error desconocido';
      }
      validateForm();
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

// ═══════════════════════════════════════════════════════════
// VALIDACIÓN
// ═══════════════════════════════════════════════════════════

function validateForm() {
  const desc = document.getElementById('field-description').value.trim();
  const counter = document.getElementById('desc-counter');
  const btnSave = document.getElementById('btn-save-record');

  counter.textContent = `${desc.length}/20 caracteres mínimo`;
  counter.className = desc.length >= 20 ? 'text-xs text-emerald-400 mt-1' : 'text-xs text-amber-400 mt-1';

  const isValid = appState.currentPhoto !== null && appState.currentGPS !== null && desc.length >= 20;
  btnSave.disabled = !isValid;
  return isValid;
}

// ═══════════════════════════════════════════════════════════
// GUARDAR REGISTRO
// ═══════════════════════════════════════════════════════════

async function saveRecord() {
  if (!validateForm()) return;

  const btnSave = document.getElementById('btn-save-record');
  btnSave.disabled = true;
  btnSave.innerHTML = '<span class="animate-spin inline-block mr-2">⏳</span> Guardando...';

  try {
    const record = {
      timestamp: appState.formTimestamp,
      photo: appState.currentPhoto,
      gps: { ...appState.currentGPS },
      obra: appState.config.obra,
      residente: appState.config.residente,
      description: document.getElementById('field-description').value.trim(),
      clima: document.getElementById('field-clima').value,
      conectividad: document.getElementById('field-conectividad').value,
      personal: parseInt(document.getElementById('field-personal').value) || null,
      volumenes: parseFloat(document.getElementById('field-volumenes').value) || null,
      maquinaria: document.getElementById('field-maquinaria').value.trim() || null,
      tipo: document.getElementById('field-tipo').value,
      synced: true
    };

    await db.addRecord(record);

    closeRecordForm();
    await loadRecords();
    await updatePendingBadge();

    showToast('Registro guardado', 'success');

  } catch (err) {
    console.error('[APP] Error al guardar registro:', err);
    showToast('Error al guardar el registro', 'error');
  } finally {
    btnSave.innerHTML = '✅ Guardar Registro';
    btnSave.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════
// CARGAR Y MOSTRAR REGISTROS
// ═══════════════════════════════════════════════════════════

async function loadRecords() {
  try {
    let records = await db.getAllRecords();
    const container = document.getElementById('records-list');
    const emptyState = document.getElementById('empty-state');
    const recordCount = document.getElementById('record-count');

    // Filtro fecha
    const filterDate = document.getElementById('filter-date').value;
    if (filterDate) {
      records = records.filter(r => r.timestamp.startsWith(filterDate));
    }

    // Filtro texto
    const searchTerm = document.getElementById('filter-search').value.trim().toLowerCase();
    if (searchTerm) {
      records = records.filter(r =>
        r.description.toLowerCase().includes(searchTerm) ||
        r.tipo.toLowerCase().includes(searchTerm) ||
        (r.maquinaria && r.maquinaria.toLowerCase().includes(searchTerm))
      );
    }

    recordCount.textContent = `${records.length} registro${records.length !== 1 ? 's' : ''}`;

    if (records.length === 0) {
      container.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    container.innerHTML = records.map(record => createRecordCard(record)).join('');

    container.querySelectorAll('[data-record-id]').forEach(card => {
      card.addEventListener('click', () => openDetailModal(parseInt(card.dataset.recordId)));
    });

  } catch (err) {
    console.error('[APP] Error cargando registros:', err);
  }
}

function createRecordCard(record) {
  const date = new Date(record.timestamp);
  const dateStr = formatDateTime(date);
  const descTruncated = record.description.length > 70
    ? record.description.substring(0, 70) + '...'
    : record.description;

  const syncBadge = record.synced
    ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300 text-xs border border-emerald-700/40">✅ Guardado</span>'
    : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300 text-xs border border-amber-700/40">⏳ Pendiente</span>';

  const tipoBadge = {
    'Normal': '<span class="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">Normal</span>',
    'Incidencia': '<span class="px-2 py-0.5 rounded text-xs bg-red-900/50 text-red-300">Incidencia</span>',
    'Hito': '<span class="px-2 py-0.5 rounded text-xs bg-blue-900/50 text-blue-300">Hito</span>'
  }[record.tipo] || '';

  const climaIcon = { 'Bueno': '☀️', 'Moderado': '⛅', 'Malo': '🌧️' }[record.clima] || '';
  const conectIcon = { 'Buena': '📶', 'Media': '📶', 'Baja': '📶', 'Sin señal': '📵' }[record.conectividad] || '';

  return `
    <div data-record-id="${record.id}" class="record-card flex gap-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-700/60 transition-colors">
      <div class="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-slate-700">
        <img src="${record.photo}" alt="Foto" class="w-full h-full object-cover" loading="lazy">
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2 mb-1">
          <span class="text-xs text-slate-400">🕒 ${dateStr}</span>
          ${tipoBadge}
        </div>
        <p class="text-sm text-slate-200 leading-snug mb-1.5 line-clamp-2">${escapeHTML(descTruncated)}</p>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[11px] text-slate-500">${climaIcon} ${record.clima || ''}</span>
          <span class="text-[11px] text-slate-500">${conectIcon} ${record.conectividad || ''}</span>
          ${record.personal ? `<span class="text-[11px] text-slate-500">👷${record.personal}</span>` : ''}
          ${syncBadge}
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// DETALLE
// ═══════════════════════════════════════════════════════════

async function openDetailModal(id) {
  try {
    const record = await db.getRecord(id);
    if (!record) return;

    const modal = document.getElementById('modal-detail');
    const date = new Date(record.timestamp);
    const mapsUrl = `https://maps.google.com/?q=${record.gps.lat},${record.gps.lng}`;

    document.getElementById('detail-photo').src = record.photo;
    document.getElementById('detail-timestamp').textContent = formatDateTime(date);
    document.getElementById('detail-gps').innerHTML = `<a href="${mapsUrl}" target="_blank" rel="noopener" class="text-blue-400 hover:underline">${record.gps.lat}, ${record.gps.lng} ↗</a>`;
    document.getElementById('detail-obra').textContent = record.obra || 'No especificada';
    document.getElementById('detail-residente').textContent = record.residente || 'No especificado';
    document.getElementById('detail-description').textContent = record.description;
    document.getElementById('detail-clima').textContent = record.clima || '—';
    document.getElementById('detail-conectividad').textContent = record.conectividad || '—';
    document.getElementById('detail-personal').textContent = record.personal != null ? `${record.personal} personas` : 'No especificado';
    document.getElementById('detail-volumenes').textContent = record.volumenes != null ? `${record.volumenes} m³` : 'No especificado';
    document.getElementById('detail-maquinaria').textContent = record.maquinaria || 'No especificada';
    document.getElementById('detail-tipo').textContent = record.tipo;
    document.getElementById('detail-sync').innerHTML = record.synced
      ? '<span class="text-emerald-400">✅ Guardado</span>'
      : '<span class="text-amber-400">⏳ Pendiente</span>';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  } catch (err) {
    console.error('[APP] Error abriendo detalle:', err);
  }
}

function closeDetailModal() {
  const modal = document.getElementById('modal-detail');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.style.overflow = '';
}

// ═══════════════════════════════════════════════════════════
// EXPORTACIÓN CSV
// ═══════════════════════════════════════════════════════════

async function exportToCSV() {
  try {
    const records = await db.getAllRecords();
    if (records.length === 0) {
      showToast('No hay registros para exportar', 'warning');
      return;
    }

    const headers = ['ID', 'Fecha/Hora', 'Latitud', 'Longitud', 'Obra', 'Residente', 'Descripción', 'Clima', 'Conectividad', 'Personal', 'Volúmenes (m³)', 'Maquinaria', 'Tipo', 'Guardado'];
    const rows = records.map(r => [
      r.id,
      r.timestamp,
      r.gps.lat,
      r.gps.lng,
      `"${(r.obra || '').replace(/"/g, '""')}"`,
      `"${(r.residente || '').replace(/"/g, '""')}"`,
      `"${r.description.replace(/"/g, '""')}"`,
      r.clima || '',
      r.conectividad || '',
      r.personal || '',
      r.volumenes || '',
      `"${(r.maquinaria || '').replace(/"/g, '""')}"`,
      r.tipo,
      r.synced ? 'Sí' : 'No'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const today = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `Bitacora_${today}.csv`);
    showToast(`CSV exportado: ${records.length} registros`, 'success');
  } catch (err) {
    console.error('[APP] Error exportando CSV:', err);
    showToast('Error al exportar CSV', 'error');
  }
}

// ═══════════════════════════════════════════════════════════
// EXPORTACIÓN PDF
// ═══════════════════════════════════════════════════════════

async function exportToPDF() {
  try {
    const records = await db.getAllRecords();
    if (records.length === 0) {
      showToast('No hay registros para exportar', 'warning');
      return;
    }

    if (typeof window.jspdf === 'undefined') {
      showToast('Cargando librería PDF...', 'warning');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'letter');
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    // Encabezado
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageW, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Bitácora Digital — Construrike', margin, 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const obraText = appState.config.obra ? `Obra: ${appState.config.obra}` : '';
    const resText = appState.config.residente ? ` | Residente: ${appState.config.residente}` : '';
    doc.text(`${obraText}${resText}`, margin, 24);
    doc.setFontSize(8);
    doc.text(`Generado: ${new Date().toLocaleString('es-MX')} | Total: ${records.length} registros`, margin, 31);
    y = 42;

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const date = new Date(r.timestamp);

      if (y + 85 > pageH - margin) {
        doc.addPage();
        y = margin;
      }

      if (i > 0) {
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, pageW - margin, y);
        y += 5;
      }

      // Título del registro
      doc.setTextColor(30, 64, 175);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Registro #${r.id} — ${r.tipo}`, margin, y);
      y += 6;

      // Datos
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Fecha: ${formatDateTime(date)}`, margin, y); y += 5;
      doc.text(`GPS: ${r.gps.lat}, ${r.gps.lng}`, margin, y); y += 5;
      doc.text(`Clima: ${r.clima || '—'} | Conectividad: ${r.conectividad || '—'}`, margin, y); y += 5;
      if (r.personal != null) { doc.text(`Personal en obra: ${r.personal}`, margin, y); y += 5; }
      if (r.volumenes != null) { doc.text(`Volúmenes: ${r.volumenes} m³`, margin, y); y += 5; }
      if (r.maquinaria) { doc.text(`Maquinaria: ${r.maquinaria}`, margin, y); y += 5; }

      // Descripción
      doc.setTextColor(30, 30, 30);
      const lines = doc.splitTextToSize(`Descripción: ${r.description}`, pageW - 2 * margin);
      doc.text(lines, margin, y);
      y += lines.length * 4 + 3;

      // Foto
      try {
        if (r.photo && y + 45 < pageH - margin) {
          doc.addImage(r.photo, 'JPEG', margin, y, 50, 37.5);
          y += 42;
        }
      } catch (imgErr) {
        y += 5;
      }
      y += 5;
    }

    // Pie de página
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Bitácora Digital Construrike — Página ${p}/${totalPages}`, pageW / 2, pageH - 8, { align: 'center' });
    }

    const today = new Date().toISOString().slice(0, 10);
    doc.save(`Bitacora_${today}.pdf`);
    showToast(`PDF exportado: ${records.length} registros`, 'success');
  } catch (err) {
    console.error('[APP] Error exportando PDF:', err);
    showToast('Error al exportar PDF', 'error');
  }
}

// ═══════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════

function formatDateTime(date) {
  return date.toLocaleString('es-MX', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), ms); };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ═══════════════════════════════════════════════════════════
// TOASTS
// ═══════════════════════════════════════════════════════════

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const colors = {
    success: 'bg-emerald-900/90 border-emerald-600/50 text-emerald-100',
    warning: 'bg-amber-900/90 border-amber-600/50 text-amber-100',
    error: 'bg-red-900/90 border-red-600/50 text-red-100',
    info: 'bg-slate-800/90 border-slate-600/50 text-slate-100'
  };
  const icons = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast-enter flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg ${colors[type]} text-sm max-w-sm`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);

  const duration = type === 'error' ? 6000 : 3000;
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ═══════════════════════════════════════════════════════════
// INICIAR
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', initApp);
