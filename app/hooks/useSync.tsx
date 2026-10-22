"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { elencaInAttesa, aggiornaStatoSync } from "@/app/lib/offline-db";

interface SyncApiResult {
  clientId: string;
  status: "ok" | "error";
  error?: string;
  retryable?: boolean;
}

interface SyncState {
  flush: () => Promise<void>;
  online: boolean | null;
  inCorso: boolean;
  ultimoEsito: { ok: number; falliti: number } | null;
  errore: string | null;
}

const SyncContext = createContext<SyncState | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState<boolean | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [ultimoEsito, setUltimoEsito] = useState<SyncState["ultimoEsito"]>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const flushInCorsoRef = useRef(false);
  const flushRichiestoRef = useRef(false);

  const flush = useCallback(async () => {
    if (!navigator.onLine) return;
    if (flushInCorsoRef.current) {
      flushRichiestoRef.current = true;
      return;
    }

    flushInCorsoRef.current = true;
    setInCorso(true);
    setErrore(null);

    try {
      do {
        flushRichiestoRef.current = false;
        const daSincronizzare = await elencaInAttesa();
        if (daSincronizzare.length === 0 || !navigator.onLine) break;

        const risposta = await fetch("/api/avvistamenti/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avvistamenti: daSincronizzare }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!risposta.ok) throw new Error(`Sync fallita: ${risposta.status}`);

        const dati: { risultati: SyncApiResult[] } = await risposta.json();
        if (!Array.isArray(dati.risultati)) throw new Error("Risposta sync non valida");
        let ok = 0;
        for (const inviato of daSincronizzare) {
          const risultato = dati.risultati.find((r) => r.clientId === inviato.clientId);
          if (risultato?.status === "ok") {
            await aggiornaStatoSync(inviato, "synced");
            ok++;
          } else if (risultato?.status === "error") {
            await aggiornaStatoSync(inviato, "error", {
              error: risultato.error,
              retryable: risultato.retryable,
            });
          }
        }
        setUltimoEsito({ ok, falliti: daSincronizzare.length - ok });
      } while (flushRichiestoRef.current && navigator.onLine);
    } catch {
      // Nessun dato viene rimosso senza una conferma esplicita del server.
      setUltimoEsito(null);
      setErrore("Sincronizzazione non riuscita. I dati restano sul dispositivo e l'invio verrà ritentato automaticamente.");
    } finally {
      flushInCorsoRef.current = false;
      setInCorso(false);
    }
  }, []);

  useEffect(() => {
    const aggiornaConnessione = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void flush();
    };
    const alRitorno = () => {
      if (document.visibilityState === "visible") aggiornaConnessione();
    };

    window.addEventListener("online", aggiornaConnessione);
    window.addEventListener("offline", aggiornaConnessione);
    document.addEventListener("visibilitychange", alRitorno);
    const interval = setInterval(flush, 30_000);
    aggiornaConnessione();

    return () => {
      window.removeEventListener("online", aggiornaConnessione);
      window.removeEventListener("offline", aggiornaConnessione);
      document.removeEventListener("visibilitychange", alRitorno);
      clearInterval(interval);
    };
  }, [flush]);

  return (
    <SyncContext.Provider value={{ flush, online, inCorso, ultimoEsito, errore }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) throw new Error("useSync richiede SyncProvider");
  return context;
}
