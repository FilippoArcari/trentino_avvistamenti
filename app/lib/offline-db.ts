// app/lib/offline-db.ts
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface AvvistamentoLocale {
  clientId: string; // UUID generato qui, chiave di idempotenza per la sync
  clientRevision?: number;
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
    }).catch((error: unknown) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

export async function salvaLocale(record: AvvistamentoLocale, esistente = false) {
  const db = await getDB();
  const tx = db.transaction("outbox", "readwrite");
  const precedente = await tx.store.get(record.clientId);
  if (esistente && !precedente) {
    await tx.done;
    throw new Error("L'avvistamento è già stato sincronizzato o rimosso. Chiudi la modifica e aggiorna la coda.");
  }
  await tx.store.put({
    ...record,
    clientRevision: Math.max(precedente?.clientRevision ?? 0, record.clientRevision ?? 0) + 1,
  });
  await tx.done;
}

export async function elencaLocali(): Promise<AvvistamentoLocale[]> {
  const db = await getDB();
  return db.getAll("outbox");
}

export async function elencaInAttesa(): Promise<AvvistamentoLocale[]> {
  const db = await getDB();
  const records = await db.getAll("outbox");
  return records.filter(
    (record) => record.syncStatus === "pending" ||
      (record.syncStatus === "error" && record.syncRetryable !== false)
  );
}

export async function aggiornaStatoSync(
  inviato: AvvistamentoLocale,
  status: "synced" | "error",
  detail?: { error?: string; retryable?: boolean }
) {
  const db = await getDB();
  const tx = db.transaction("outbox", "readwrite");
  const record = await tx.store.get(inviato.clientId);
  // Una risposta tardiva non deve cancellare modifiche salvate durante l'invio.
  if (record && JSON.stringify(record) === JSON.stringify(inviato)) {
    if (status === "synced") {
      await tx.store.delete(record.clientId);
    } else {
      record.syncStatus = status;
      record.syncError = detail?.error;
      record.syncRetryable = detail?.retryable;
      await tx.store.put(record);
    }
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
