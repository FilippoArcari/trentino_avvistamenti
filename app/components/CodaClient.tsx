"use client";

import { useCallback, useEffect, useState } from "react";
import { Navbar } from "@/app/components/Navbar";
import { elencaLocali, salvaLocale, eliminaLocale, type AvvistamentoLocale } from "@/app/lib/offline-db";
import { EditAvvistamentoModal, type EditableAvvistamento } from "@/app/components/EditAvvistamentoModal";
import { useSync } from "@/app/hooks/useSync";
import { hslaSpecie, etichettaSpecie } from "@/app/utils/speciesColor";


export function CodaClient() {
  const [avvistamenti, setAvvistamenti] = useState<AvvistamentoLocale[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroreCoda, setErroreCoda] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<AvvistamentoLocale | null>(null);

  const { flush, online, inCorso, ultimoEsito, errore } = useSync();

  const loadData = useCallback(() => {
    return elencaLocali().then((records) => {
      setAvvistamenti(records.filter((record) => record.syncStatus !== "synced").sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      setErroreCoda(null);
    }).catch(() => {
      setErroreCoda("Impossibile leggere gli avvistamenti salvati sul dispositivo. Riprova ricaricando la pagina.");
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void loadData();
  }, [inCorso, loadData]);

  const handleSaveEdit = async (updated: EditableAvvistamento) => {
    if (!editingRecord) return;
    const recordSalvato: AvvistamentoLocale = {
      ...editingRecord,
      specie: updated.specie,
      tipologia: updated.tipologia,
      sesso: updated.sesso,
      syncStatus: "pending", // reset status if edited
      syncError: undefined,
      syncRetryable: undefined,
    };
    await salvaLocale(recordSalvato, true);
    setEditingRecord(null);
    await loadData();
    flush(); // tenta la sync subito dopo la modifica
  };

  const handleDelete = async (clientId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo record in coda?")) return;
    try {
      await eliminaLocale(clientId);
      await loadData();
    } catch {
      setErroreCoda("Eliminazione non riuscita. L'avvistamento è ancora sul dispositivo.");
    }
  };

  return (
    <div className="min-h-screen bg-base-100 text-base-content font-sans flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-base-content tracking-tight mb-2">
              Coda Offline
            </h1>
            <p className="text-base-content/60 text-base">
              Record in attesa di essere inviati al server
            </p>
          </div>
          <button
            onClick={() => flush()}
            disabled={inCorso || online === false}
            className="px-4 py-2 rounded-xl bg-base-content/5 border border-base-content/10 hover:bg-base-content/10 text-sm font-medium transition-all disabled:opacity-50"
          >
            {inCorso ? "Sincronizzazione in corso..." : "Sincronizza ora"}
          </button>
        </div>

        {(online === false || errore) && (
          <p role="status" className="mb-6 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
            {online === false
              ? "Sei offline. Gli avvistamenti restano sul dispositivo e saranno inviati automaticamente al ritorno della connessione."
              : errore}
          </p>
        )}

        {ultimoEsito && (
          <div className="mb-6 rounded-xl border border-base-content/10 bg-base-content/5 p-4 flex gap-4 text-sm">
            <span className="text-success">Sincronizzati con successo: {ultimoEsito.ok}</span>
            {ultimoEsito.falliti > 0 && (
              <span className="text-error">Falliti: {ultimoEsito.falliti}</span>
            )}
          </div>
        )}

        {erroreCoda && <p role="alert" className="mb-6 text-sm text-error">{erroreCoda}</p>}

        <div className="rounded-2xl border border-base-content/5 bg-base-content/[0.03] overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center text-base-content/60">Caricamento...</div>
          ) : erroreCoda ? null : avvistamenti.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-base-content font-medium text-lg">La coda è vuota</p>
              <p className="text-base-content/60 mt-1">Tutti i record sono stati sincronizzati con il server.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-base-content/60 text-xs uppercase tracking-wider border-b border-base-content/5">
                    <th className="text-left py-4 px-4 font-medium">Data</th>
                    <th className="text-left py-4 px-4 font-medium">Specie</th>
                    <th className="text-left py-4 px-4 font-medium">Tipologia / Sesso</th>
                    <th className="text-left py-4 px-4 font-medium">Stato</th>
                    <th className="text-right py-4 px-4 font-medium">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {avvistamenti.map((a) => (
                    <tr key={a.clientId} className="border-b border-base-content/[0.04] hover:bg-base-content/[0.02] transition-colors">
                      <td className="py-4 px-4 text-base-content">
                        {new Date(a.timestamp).toLocaleString("it-IT", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                        })}
                      </td>
                      <td className="py-4 px-4">
                          <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: hslaSpecie(a.specie, 0.2),
                            color: hslaSpecie(a.specie, 1),
                          }}
                        >
                          {etichettaSpecie(a.specie)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-base-content">
                        <span>{a.tipologia}</span>
                        <span className="text-base-content/60 mx-2">•</span>
                        <span>{a.sesso}</span>
                      </td>
                      <td className="py-4 px-4">
                        {a.syncStatus === "error" ? (
                          <span className="text-error text-xs" title={a.syncError}>
                            {a.syncRetryable === false ? "Da correggere" : "Invio da ritentare"}
                            {a.syncError && <span className="block mt-1">{a.syncError}</span>}
                          </span>
                        ) : (
                          <span className="text-warning text-xs px-2 py-1 rounded-full bg-warning/10">In attesa</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setEditingRecord(a)}
                          className="px-3 py-1.5 rounded-lg bg-base-content/5 hover:bg-base-content/10 text-base-content text-xs font-medium transition-colors mr-2"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => handleDelete(a.clientId)}
                          className="px-3 py-1.5 rounded-lg bg-error/10 hover:bg-error/20 text-error text-xs font-medium transition-colors"
                        >
                          Elimina
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {editingRecord && (
        <EditAvvistamentoModal
          initialData={editingRecord as EditableAvvistamento}
          onSave={handleSaveEdit}
          onCancel={() => setEditingRecord(null)}
        />
      )}
    </div>
  );
}
