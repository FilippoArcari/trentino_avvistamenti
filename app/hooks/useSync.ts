// app/hooks/useSync.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  elencaInAttesa,
  aggiornaStatoSync,
  rimuoviSincronizzati,
  type AvvistamentoLocale,
} from "@/app/lib/offline-db";

interface SyncApiResult {
  clientId: string;
  status: "ok" | "error";
  error?: string;
  retryable?: boolean;
}

export function useSync() {
  const [inCorso, setInCorso] = useState(false);
  const [ultimoEsito, setUltimoEsito] = useState<{ ok: number; falliti: number } | null>(null);
  // ref, non state: evita race condition di doppio flush concorrente
  // (es. evento "online" e timer periodico che scattano nello stesso istante)
  const flushInCorsoRef = useRef(false);

  const flush = useCallback(async () => {
    if (flushInCorsoRef.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    flushInCorsoRef.current = true;
    setInCorso(true);

    try {
      const daSincronizzare = await elencaInAttesa();
      if (daSincronizzare.length === 0) {
        setUltimoEsito({ ok: 0, falliti: 0 });
        return;
      }

      const risposta = await fetch("/api/avvistamenti/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avvistamenti: daSincronizzare }),
      });

      // navigator.onLine può essere true anche con connessione presente
      // ma senza uscita reale a internet (es. captive portal wifi): il
      // fetch che fallisce è il segnale affidabile, non l'evento "online".
      if (!risposta.ok && risposta.status !== 207) {
        throw new Error(`Sync fallita con status ${risposta.status}`);
      }

      const dati: { risultati: SyncApiResult[] } = await risposta.json();

      for (const r of dati.risultati) {
        if (r.status === "ok") {
          await aggiornaStatoSync(r.clientId, "synced");
        } else {
          await aggiornaStatoSync(r.clientId, "error", { error: r.error, retryable: r.retryable });
        }
      }

      await rimuoviSincronizzati();

      const ok = dati.risultati.filter((r) => r.status === "ok").length;
      setUltimoEsito({ ok, falliti: dati.risultati.length - ok });
    } catch {
      // errore di rete/fetch: i record restano "pending", verranno
      // ritentati al prossimo trigger. Non li marchiamo "error" perché
      // un fallimento di rete è per definizione retryable.
      setUltimoEsito(null);
    } finally {
      flushInCorsoRef.current = false;
      setInCorso(false);
    }
  }, []);

  useEffect(() => {
    // meccanismo primario, universale (funziona anche su iOS/Safari):
    // online, ritorno in foreground, e poll periodico come rete di sicurezza
    // per il falso-positivo di navigator.onLine descritto sopra.
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") flush();
    });
    const interval = setInterval(flush, 30_000);

    flush(); // tentativo immediato al mount

    // enhancement opportunistico: si attiva solo dove Background Sync
    // esiste (Chrome/Android). Su Safari `'sync' in registration` è
    // false e questo blocco non fa nulla — il fallback sopra resta
    // l'unico meccanismo, come previsto.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        if ("sync" in registration) {
          (registration as any).sync.register("sync-avvistamenti").catch(() => {});
        }
      });
    }

    return () => {
      window.removeEventListener("online", flush);
      clearInterval(interval);
    };
  }, [flush]);

  return { flush, inCorso, ultimoEsito };
}