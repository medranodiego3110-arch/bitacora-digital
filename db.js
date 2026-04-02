/**
 * db.js - Wrapper de IndexedDB para Bitácora Digital Construrike
 * Maneja almacenamiento local offline de registros de obra y configuración.
 * Base de datos: BitacoraDB v2 | Stores: registros, config
 */

const DB_NAME = 'BitacoraDB';
const DB_VERSION = 2;
const STORE_NAME = 'registros';
const CONFIG_STORE = 'config';

class BitacoraDB {
  constructor() {
    this.db = null;
  }

  /** Abre o crea la base de datos IndexedDB */
  open() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store de registros
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true
          });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('tipo', 'tipo', { unique: false });
          console.log('[DB] Object store "registros" creado');
        }

        // Store de configuración (obra, residente)
        if (!db.objectStoreNames.contains(CONFIG_STORE)) {
          db.createObjectStore(CONFIG_STORE, { keyPath: 'key' });
          console.log('[DB] Object store "config" creado');
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('[DB] Base de datos abierta correctamente');
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('[DB] Error al abrir base de datos:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // ─── REGISTROS ───

  /** Inserta un nuevo registro */
  addRecord(record) {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.add(record);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Obtiene todos los registros, ordenados por timestamp desc */
  getAllRecords() {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
          const records = request.result.sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
          );
          resolve(records);
        };
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Obtiene un registro por su ID */
  getRecord(id) {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Actualiza un registro existente */
  updateRecord(id, data) {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const record = { ...getReq.result, ...data };
          const putReq = store.put(record);
          putReq.onsuccess = () => resolve(record);
          putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Elimina un registro por ID */
  deleteRecord(id) {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Obtiene registros pendientes de sync */
  getPendingRecords() {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('synced');
        const request = index.getAll(false);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Cuenta registros pendientes */
  countPending() {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('synced');
        const request = index.count(false);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─── CONFIGURACIÓN ───

  /** Guarda un valor de configuración */
  setConfig(key, value) {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(CONFIG_STORE, 'readwrite');
        const store = tx.objectStore(CONFIG_STORE);
        const request = store.put({ key, value });
        request.onsuccess = () => resolve(value);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Obtiene un valor de configuración */
  getConfig(key) {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(CONFIG_STORE, 'readonly');
        const store = tx.objectStore(CONFIG_STORE);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result ? request.result.value : null);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }
}

// Instancia global
const db = new BitacoraDB();
