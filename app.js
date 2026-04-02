/**
 * app.js - Lógica principal de Bitácora Digital Construrike
 * Maneja: captura de fotos, GPS, formulario, sync, exportación
 */

// ─── ENDPOINT DE SINCRONIZACIÓN (simulado para piloto) ───
const SYNC_ENDPOINT = 'https://jsonplaceholder.typicode.com/posts';
const SYNC_TIMEOUT = 8000; // 8 segundos timeout

// ─── ESTADO DE LA APLICACIÓN ───
const appState = {
  isOnline: navigator.onLine,
  currentPhoto: null,
  currentGPS: null,
  formTimestamp: null,
  syncInProgress: false,
  cameraStream: null
};

// ═══════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════

async function initApp() {
  try {
    await db.open();
    console.log('[APP] Base de datos inicializada');

    setupEventListeners();
    setupConnectivityListeners();
    updateOnlineIndicator();
    await updatePendingBadge();
    await loadRecords();

    // Si hay conexión al iniciar, intentar sync
    if (navigator.onLine) {
      setTimeout(() => syncPendingRecords(), 2000);
    }

    console.log('[APP] Aplicación inicializada correctamente');
  } catch (err) {
    console.error('[APP] Error al inicializar:', err);
    showToast('Error al inicializar la aplicación', 'error');
  }
}

// ═══════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════

function setupEventListeners() {
  // Botón nuevo registro (FAB)
  document.getElementById('btn-new-record').addEventListener('click', openNewRecordForm);

  // Botón cerrar modal
  document.getElementById('btn-close-modal').addEventListener('click', closeRecordForm);

  // Botón tomar foto
  document.getElementById('btn-take-photo').addEventListener('click', capturePhoto);

  // Botón guardar registro
  document.getElementById('btn-save-record').addEventListener('click', saveRecord);

  // Validación en tiempo real del campo descripción
  document.getElementById('field-description').addEventListener('input', validateForm);

  // Tipo de evento
  document.getElementById('field-tipo').addEventListener('change', validateForm);

  // Exportar CSV
  document.getElementById('btn-export-csv').addEventListener('click', exportToCSV);

  // Exportar PDF
  document.getElementById('btn-export-pdf').addEventListener('click', exportToPDF);

  // Filtro por fecha
  document.getElementById('filter-date').addEventListener('change', loadRecords);

  // Búsqueda por texto
  document.getElementById('filter-search').addEventListener('input', debounce(loadRecords, 300));

  // Cerrar modal detalle
  document.getElementById('btn-close-detail').addEventListener('click', closeDetailModal);

  // Click fuera del modal para cerrar
  document.getElementById('modal-record-form').addEventListener('click', (e) => {
    if (e.target.id === 'modal-record-form') closeRecordForm();
  });
  document.getElementById('modal-detail').addEventListener('click', (e) => {
    if (e.target.id === 'modal-detail') closeDetailModal();
  });
}

function setupConnectivityListeners() {
  window.addEventListener('online', () => {
    appState.isOnline = true;
    updateOnlineIndicator();
    showToast('Conexión restaurada', 'success');
    // Auto-sync al detectar conexión
    syncPendingRecords();
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
  // Resetear estado
  appState.currentPhoto = null;
  appState.currentGPS = null;
  appState.formTimestamp = new Date().toISOString();

  // Resetear campos visuales
  document.getElementById('photo-preview').classList.add('hidden');
  document.getElementById('photo-placeholder').classList.remove('hidden');
  document.getElementById('field-description').value = '';
  document.getElementById('field-volumenes').value = '';
  document.getElementById('field-tipo').value = 'Normal';
  document.getElementById('desc-counter').textContent = '0/20 caracteres mínimo';
  document.getElementById('desc-counter').className = 'text-xs text-slate-400 mt-1';

  // Mostrar timestamp
  const ts = new Date(appState.formTimestamp);
  document.getElementById('display-timestamp').textContent = formatDateTime(ts);

  // Obtener GPS
  getGPS();

  // Deshabilitar botón guardar
  document.getElementById('btn-save-record').disabled = true;

  // Mostrar modal
  document.getElementById('modal-record-form').classList.remove('hidden');
  document.getElementById('modal-record-form').classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeRecordForm() {
  // Detener stream de cámara si está activo
  stopCameraStream();

  document.getElementById('modal-record-form').classList.add('hidden');
  document.getElementById('modal-record-form').classList.remove('flex');
  document.body.style.overflow = '';
}

// ═══════════════════════════════════════════════════════════
// CAPTURA DE FOTO (Cámara del dispositivo)
// ═══════════════════════════════════════════════════════════

async function capturePhoto() {
  const btnPhoto = document.getElementById('btn-take-photo');

  // Verificar soporte de MediaDevices
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Tu navegador no soporta acceso a la cámara', 'error');
    return;
  }

  try {
    btnPhoto.disabled = true;
    btnPhoto.innerHTML = '<span class="animate-spin inline-block mr-2">⏳</span> Abriendo cámara...';

    // Solicitar acceso a cámara trasera preferentemente
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 960 }
      }
    });

    appState.cameraStream = stream;

    // Crear video temporal para captura
    const video = document.createElement('video');
    video.srcObject = stream;
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');

    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });

    // Esperar un momento para que la cámara se estabilice
    await new Promise(r => setTimeout(r, 500));

    // Capturar frame al canvas
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // Convertir a base64 JPEG (calidad 0.7 para ahorrar espacio)
    appState.currentPhoto = canvas.toDataURL('image/jpeg', 0.7);

    // Detener stream
    stopCameraStream();

    // Mostrar preview
    const preview = document.getElementById('photo-preview');
    const previewImg = document.getElementById('photo-preview-img');
    previewImg.src = appState.currentPhoto;
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
// GPS (Geolocation API)
// ═══════════════════════════════════════════════════════════

function getGPS() {
  const gpsDisplay = document.getElementById('display-gps');
  const gpsStatus = document.getElementById('gps-status');

  if (!navigator.geolocation) {
    gpsDisplay.textContent = 'Geolocalización no soportada';
    gpsStatus.className = 'text-red-400 text-xs';
    gpsStatus.textContent = '❌ No disponible';
    showToast('Tu navegador no soporta GPS', 'error');
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
      console.log('[APP] GPS obtenido:', appState.currentGPS);
    },
    (error) => {
      console.error('[APP] Error GPS:', error);
      appState.currentGPS = null;
      gpsDisplay.textContent = 'No se pudo obtener ubicación';
      gpsStatus.className = 'text-red-400 text-xs';

      switch (error.code) {
        case error.PERMISSION_DENIED:
          gpsStatus.textContent = '❌ Permiso denegado — Activa ubicación en configuración';
          showToast('Permiso de ubicación denegado. Actívalo en configuración del dispositivo.', 'error');
          break;
        case error.POSITION_UNAVAILABLE:
          gpsStatus.textContent = '❌ Ubicación no disponible';
          showToast('GPS no disponible. Verifica que la ubicación esté activada.', 'error');
          break;
        case error.TIMEOUT:
          gpsStatus.textContent = '❌ Tiempo agotado — Reintenta';
          showToast('Tiempo agotado al obtener GPS. Reintenta.', 'error');
          break;
        default:
          gpsStatus.textContent = '❌ Error desconocido';
      }
      validateForm();
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000 // Aceptar posición cacheada de hasta 1 minuto
    }
  );
}

// ═══════════════════════════════════════════════════════════
// VALIDACIÓN
// ═══════════════════════════════════════════════════════════

function validateForm() {
  const desc = document.getElementById('field-description').value.trim();
  const counter = document.getElementById('desc-counter');
  const btnSave = document.getElementById('btn-save-record');

  // Contador de caracteres
  counter.textContent = `${desc.length}/20 caracteres mínimo`;
  if (desc.length >= 20) {
    counter.className = 'text-xs text-emerald-400 mt-1';
  } else {
    counter.className = 'text-xs text-amber-400 mt-1';
  }

  // Validar todos los campos obligatorios
  const isValid = (
    appState.currentPhoto !== null &&
    appState.currentGPS !== null &&
    desc.length >= 20
  );

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
      description: document.getElementById('field-description').value.trim(),
      volumenes: parseFloat(document.getElementById('field-volumenes').value) || null,
      tipo: document.getElementById('field-tipo').value,
      synced: false
    };

    await db.addRecord(record);

    closeRecordForm();
    await loadRecords();
    await updatePendingBadge();

    showToast('Registro guardado localmente', appState.isOnline ? 'success' : 'warning');

    // Si hay conexión, intentar sync inmediata
    if (appState.isOnline) {
      setTimeout(() => syncPendingRecords(), 1000);
    }

  } catch (err) {
    console.error('[APP] Error al guardar registro:', err);
    showToast('Error al guardar el registro', 'error');
  } finally {
    btnSave.innerHTML = '✅ Guardar Registro';
    btnSave.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════
// SINCRONIZACIÓN
// ═══════════════════════════════════════════════════════════

async function syncPendingRecords() {
  if (appState.syncInProgress || !appState.isOnline) return;

  appState.syncInProgress = true;

  try {
    const pending = await db.getPendingRecords();
    if (pending.length === 0) {
      appState.syncInProgress = false;
      return;
    }

    console.log(`[SYNC] Sincronizando ${pending.length} registros...`);
    let synced = 0;

    for (const record of pending) {
      try {
        // POST simulado al endpoint (en producción: backend real)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SYNC_TIMEOUT);

        const response = await fetch(SYNC_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timestamp: record.timestamp,
            gps: record.gps,
            description: record.description,
            volumenes: record.volumenes,
            tipo: record.tipo
            // No enviar foto base64 al endpoint simulado para evitar payload enorme
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          await db.updateRecord(record.id, { synced: true });
          synced++;
          console.log(`[SYNC] Registro ${record.id} sincronizado`);
        }
      } catch (fetchErr) {
        console.warn(`[SYNC] Falló sync de registro ${record.id}:`, fetchErr.message);
        // Si falla, se queda en queue para siguiente intento
      }
    }

    if (synced > 0) {
      showToast(`${synced} registro${synced > 1 ? 's' : ''} sincronizado${synced > 1 ? 's' : ''}`, 'success');
      await loadRecords();
      await updatePendingBadge();
    }

  } catch (err) {
    console.error('[SYNC] Error general:', err);
  } finally {
    appState.syncInProgress = false;
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

    // Aplicar filtro de fecha
    const filterDate = document.getElementById('filter-date').value;
    if (filterDate) {
      records = records.filter(r => r.timestamp.startsWith(filterDate));
    }

    // Aplicar búsqueda por texto
    const searchTerm = document.getElementById('filter-search').value.trim().toLowerCase();
    if (searchTerm) {
      records = records.filter(r =>
        r.description.toLowerCase().includes(searchTerm) ||
        r.tipo.toLowerCase().includes(searchTerm)
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

    // Agregar event listeners a las cards
    container.querySelectorAll('[data-record-id]').forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.dataset.recordId);
        openDetailModal(id);
      });
    });

  } catch (err) {
    console.error('[APP] Error cargando registros:', err);
  }
}

function createRecordCard(record) {
  const date = new Date(record.timestamp);
  const dateStr = formatDateTime(date);
  const descTruncated = record.description.length > 80
    ? record.description.substring(0, 80) + '...'
    : record.description;

  const syncBadge = record.synced
    ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300 text-xs border border-emerald-700/40">✅ Sincronizado</span>'
    : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300 text-xs border border-amber-700/40">⏳ Pendiente</span>';

  const tipoBadge = {
    'Normal': '<span class="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">Normal</span>',
    'Incidencia': '<span class="px-2 py-0.5 rounded text-xs bg-red-900/50 text-red-300">Incidencia</span>',
    'Hito': '<span class="px-2 py-0.5 rounded text-xs bg-blue-900/50 text-blue-300">Hito</span>'
  }[record.tipo] || '';

  return `
    <div data-record-id="${record.id}" class="record-card flex gap-3 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 cursor-pointer hover:bg-slate-700/60 transition-colors">
      <div class="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-slate-700">
        <img src="${record.photo}" alt="Foto registro" class="w-full h-full object-cover" loading="lazy">
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2 mb-1">
          <span class="text-xs text-slate-400">🕒 ${dateStr}</span>
          ${tipoBadge}
        </div>
        <p class="text-sm text-slate-200 leading-snug mb-2 line-clamp-2">${escapeHTML(descTruncated)}</p>
        <div class="flex items-center justify-between">
          <span class="text-xs text-slate-500">📍 ${record.gps.lat}, ${record.gps.lng}</span>
          ${syncBadge}
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// MODAL DE DETALLE
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
    document.getElementById('detail-description').textContent = record.description;
    document.getElementById('detail-volumenes').textContent = record.volumenes != null ? `${record.volumenes} m³` : 'No especificado';
    document.getElementById('detail-tipo').textContent = record.tipo;
    document.getElementById('detail-sync').innerHTML = record.synced
      ? '<span class="text-emerald-400">✅ Sincronizado</span>'
      : '<span class="text-amber-400">⏳ Pendiente de sincronización</span>';

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

    const headers = ['ID', 'Fecha/Hora', 'Latitud', 'Longitud', 'Descripción', 'Volúmenes', 'Tipo', 'Sincronizado'];
    const rows = records.map(r => [
      r.id,
      r.timestamp,
      r.gps.lat,
      r.gps.lng,
      `"${r.description.replace(/"/g, '""')}"`,
      r.volumenes || '',
      r.tipo,
      r.synced ? 'Sí' : 'No'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const BOM = '\uFEFF'; // BOM para compatibilidad con Excel y acentos
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
// EXPORTACIÓN PDF (con jsPDF)
// ═══════════════════════════════════════════════════════════

async function exportToPDF() {
  try {
    const records = await db.getAllRecords();
    if (records.length === 0) {
      showToast('No hay registros para exportar', 'warning');
      return;
    }

    // Verificar que jsPDF esté cargado
    if (typeof window.jspdf === 'undefined') {
      showToast('Cargando librería PDF...', 'warning');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'letter');
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = margin;

    // Encabezado
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageW, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Bitácora Digital — Construrike', margin, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${new Date().toLocaleString('es-MX')} | Total registros: ${records.length}`, margin, 26);
    y = 40;

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const date = new Date(r.timestamp);

      // Verificar espacio en página (foto 40mm + texto ~30mm = ~75mm)
      if (y + 80 > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }

      // Línea separadora
      if (i > 0) {
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, pageW - margin, y);
        y += 5;
      }

      // Info del registro
      doc.setTextColor(30, 64, 175);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Registro #${r.id} — ${r.tipo}`, margin, y);
      y += 6;

      doc.setTextColor(80, 80, 80);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Fecha: ${formatDateTime(date)}`, margin, y);
      y += 5;
      doc.text(`GPS: ${r.gps.lat}, ${r.gps.lng}`, margin, y);
      y += 5;
      if (r.volumenes != null) {
        doc.text(`Volúmenes: ${r.volumenes} m³`, margin, y);
        y += 5;
      }
      doc.text(`Estado: ${r.synced ? 'Sincronizado' : 'Pendiente'}`, margin, y);
      y += 5;

      // Descripción (texto largo con wrap)
      doc.setTextColor(30, 30, 30);
      const lines = doc.splitTextToSize(`Descripción: ${r.description}`, pageW - 2 * margin);
      doc.text(lines, margin, y);
      y += lines.length * 4 + 3;

      // Foto (si cabe)
      try {
        if (r.photo && y + 45 < doc.internal.pageSize.getHeight() - margin) {
          doc.addImage(r.photo, 'JPEG', margin, y, 50, 37.5);
          y += 42;
        }
      } catch (imgErr) {
        console.warn('[PDF] No se pudo insertar imagen del registro', r.id);
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
      doc.text(
        `Bitácora Digital Construrike — Página ${p}/${totalPages}`,
        pageW / 2, doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
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
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
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
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');

  const colors = {
    success: 'bg-emerald-900/90 border-emerald-600/50 text-emerald-100',
    warning: 'bg-amber-900/90 border-amber-600/50 text-amber-100',
    error: 'bg-red-900/90 border-red-600/50 text-red-100',
    info: 'bg-slate-800/90 border-slate-600/50 text-slate-100'
  };

  const icons = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️'
  };

  const toast = document.createElement('div');
  toast.className = `toast-enter flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg ${colors[type]} text-sm max-w-sm`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${escapeHTML(message)}</span>`;

  container.appendChild(toast);

  // Auto-remove (errores permanecen más tiempo)
  const duration = type === 'error' ? 6000 : 3000;
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ═══════════════════════════════════════════════════════════
// INICIAR APP CUANDO EL DOM ESTÉ LISTO
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', initApp);
