/**
 * db.js - Wrapper de IndexedDB para Bitácora Digital Construrike
 * Maneja almacenamiento local offline de registros de obra.
 * Base de datos: BitacoraDB | Object Store: registros
 */

const DB_NAME = 'BitacoraDB';
const DB_VERSION = 1;
const STORE_NAME = 'registros';

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
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true
          });
          // Índices para búsqueda y filtrado
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('tipo', 'tipo', { unique: false });
          console.log('[DB] Object store "registros" creado con índices');
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

  /** Inserta un nuevo registro en la base de datos */
  addRecord(record) {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.add(record);

        request.onsuccess = () => {
          console.log('[DB] Registro guardado, id:', request.result);
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
      } catch (err) {
        console.error('[DB] Error en addRecord:', err);
        reject(err);
      }
    });
  }

  /** Obtiene todos los registros, ordenados por timestamp descendente */
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
        console.error('[DB] Error en getAllRecords:', err);
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

  /** Actualiza un registro existente (ej: marcar como sincronizado) */
  updateRecord(id, data) {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(id);

        getReq.onsuccess = () => {
          const record = { ...getReq.result, ...data };
          const putReq = store.put(record);
          putReq.onsuccess = () => {
            console.log('[DB] Registro actualizado, id:', id);
            resolve(record);
          };
          putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
      } catch (err) {
        console.error('[DB] Error en updateRecord:', err);
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

        request.onsuccess = () => {
          console.log('[DB] Registro eliminado, id:', id);
          resolve(true);
        };
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /** Obtiene solo registros pendientes de sincronización */
  getPendingRecords() {
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('synced');
        const request = index.getAll(false);

        request.onsuccess = () => {
          console.log('[DB] Registros pendientes:', request.result.length);
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
      } catch (err) {
        console.error('[DB] Error en getPendingRecords:', err);
        reject(err);
      }
    });
  }

  /** Cuenta registros pendientes de sync (para badge) */
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
}

// Instancia global
const db = new BitacoraDB();
