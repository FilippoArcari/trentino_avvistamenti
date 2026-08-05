// app/lib/offline-db.ts
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface AvvistamentoLocale {
  clientId: string; // UUID generato qui, chiave di idempotenza per la sync
  specie: string;
  tipologia: string;
  sesso: string;
  posizione: { lat: number; lng: number };
  timestamp: string; // ISO string: IndexedDB con Date nativi è più fragile da serializzare/clonare
  syncStatus: "pending" | "synced" | "error";
  syncError?: string;
  syncRetryable?: boolean;
  createdAtLocale: string;
}

interface AvvistamentiDB extends DBSchema {
  outbox: {
    key: string; // clientId
    value: AvvistamentoLocale;
    indexes: { "by-status": string };
  };
}

let dbPromise: Promise<IDBPDatabase<AvvistamentiDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<AvvistamentiDB>("avvistamenti-outbox", 1, {
      upgrade(db) {
        const store = db.createObjectStore("outbox", { keyPath: "clientId" });
        store.createIndex("by-status", "syncStatus");
      },
    });
  }
  return dbPromise;
}

export async function salvaLocale(record: AvvistamentoLocale) {
  const db = await getDB();
  await db.put("outbox", record);
}

export async function elencaLocali(): Promise<AvvistamentoLocale[]> {
  const db = await getDB();
  return db.getAll("outbox");
}

export async function elencaInAttesa(): Promise<AvvistamentoLocale[]> {
  const db = await getDB();
  return db.getAllFromIndex("outbox", "by-status", "pending");
}

export async function aggiornaStatoSync(
  clientId: string,
  status: "synced" | "error",
  detail?: { error?: string; retryable?: boolean }
) {
  const db = await getDB();
  const record = await db.get("outbox", clientId);
  if (!record) return;
  record.syncStatus = status;
  record.syncError = detail?.error;
  record.syncRetryable = detail?.retryable;
  await db.put("outbox", record);
}

export async function rimuoviSincronizzati() {
  const db = await getDB();
  const tx = db.transaction("outbox", "readwrite");
  let cursor = await tx.store.index("by-status").openCursor("synced");
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function eliminaLocale(clientId: string) {
  const db = await getDB();
  await db.delete("outbox", clientId);
}

/** Best-effort: chiede al browser di non fare eviction dello storage.
 *  Su Safari/iOS l'esito è meno garantito che su Chrome — vedi nota
 *  sui limiti PWA iOS. Non blocca il funzionamento se fallisce. */
export async function richiediStoragePersistente() {
  if (navigator.storage?.persist) {
    try {
      await navigator.storage.persist();
    } catch {
      // non fatale: l'app funziona comunque, solo con eviction meno prevedibile
    }
  }
}