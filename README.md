# Bitácora Digital — Construrike

Aplicación web progresiva (PWA) para registro digital de bitácora de obra con funcionamiento offline. Desarrollada como intervención de mejora (fase Improve/DMAIC) del proyecto Lean Six Sigma Green Belt en Construrike.

## Problema

PCBS (Porcentaje de Cumplimiento de Bitácora Semanal) = 0% en 23 obras. Causa raíz: sistema de registro 100% físico/manual sin verificación remota. Esta app interviene la variable X3 (método de registro) y mitiga X2 (conectividad limitada en zona serrana de Chihuahua).

## Instalación — GitHub Pages

1. Fork o clona este repositorio
2. Ve a **Settings → Pages → Source: main branch, root (/)**
3. Espera ~1 minuto a que se publique
4. Accede a `https://tu-usuario.github.io/nombre-repo/`
5. En el navegador del celular, toca **"Agregar a pantalla de inicio"** para instalar la PWA

## Features

- **Captura offline**: Foto + GPS + timestamp automáticos, sin necesidad de conexión
- **Almacenamiento local**: IndexedDB persiste datos aunque se cierre el navegador
- **Poka-Yoke**: Campos obligatorios validados, GPS y foto requeridos antes de guardar
- **Sincronización automática**: Detecta conexión y envía registros pendientes
- **Indicador visual**: Badge Online/Offline y contador de registros pendientes
- **Exportación**: CSV y PDF con fotos incluidas
- **Filtros**: Búsqueda por texto y filtro por fecha
- **PWA completa**: Instalable, funciona sin internet, cacheado de assets

## Stack

- HTML5 + CSS3 (Tailwind via CDN)
- JavaScript Vanilla ES6+
- Service Worker (cache first / network first)
- IndexedDB
- Geolocation API + MediaDevices API
- jsPDF para exportación PDF

## Estructura

```
index.html      → UI principal
manifest.json   → Configuración PWA
sw.js           → Service Worker (offline)
app.js          → Lógica de la aplicación
db.js           → Wrapper de IndexedDB
styles.css      → Estilos complementarios
```

## Notas del piloto

- Sin autenticación (piloto de 4 semanas, 1 obra)
- Sync a endpoint simulado (jsonplaceholder.typicode.com)
- Datos almacenados localmente en el dispositivo
- Para producción: agregar backend con auth, base de datos centralizada

## Créditos

Proyecto académico — Lean Six Sigma Green Belt  
Universidad Tecmilenio, Chihuahua, México
