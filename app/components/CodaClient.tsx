"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/app/components/Navbar";
import { elencaInAttesa, salvaLocale, eliminaLocale, type AvvistamentoLocale } from "@/app/lib/offline-db";
import { EditAvvistamentoModal, type EditableAvvistamento } from "@/app/components/EditAvvistamentoModal";
import { useSync } from "@/app/hooks/useSync";

const LABEL_SPECIE: Record<string, string> = {
  cervo: "Cervo",
  camoscio: "Camoscio",
  capriolo: "Capriolo",
};
const LABEL_SESSO: Record<string, string> = {
  maschio: "Maschio",
  femmina: "Femmina",
  indeterminato: "Indeterminato",
};
const LABEL_TIPOLOGIA: Record<string, string> = {
  palcuto: "Palcuto",
  sottile: "Sottile",
  fusone: "Fusone",
  femmina: "Femmina",
  piccolo: "Piccolo",
  yearling: "Yearling",
  adulto: "Adulto",
  prima: "Prima",
  seconda: "Seconda",
};

export function CodaClient() {
  const [avvistamenti, setAvvistamenti] = useState<AvvistamentoLocale[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<AvvistamentoLocale | null>(null);

  const { flush, inCorso, ultimoEsito } = useSync();

  const loadData = async () => {
    try {
      const records = await elencaInAttesa();
      setAvvistamenti(records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Aggiorna la lista quando la sync finisce (i record potrebbero sparire perché sincronizzati)
    if (!inCorso) {
      loadData();
    }
  }, [inCorso]);

  const handleSaveEdit = async (updated: EditableAvvistamento) => {
    if (!editingRecord) return;
    const recordSalvato: AvvistamentoLocale = {
      ...editingRecord,
      specie: updated.specie,
      tipologia: updated.tipologia,
      sesso: updated.sesso,
      syncStatus: "pending", // reset status if edited
      syncError: undefined
    };
    await salvaLocale(recordSalvato);
    setEditingRecord(null);
    await loadData();
    flush(); // tenta la sync subito dopo la modifica
  };

  const handleDelete = async (clientId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo record in coda?")) return;
    await eliminaLocale(clientId);
    await loadData();
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-sans flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
              Coda Offline
            </h1>
            <p className="text-[#8b9ab3] text-base">
              Record in attesa di essere inviati al server
            </p>
          </div>
          <button
            onClick={() => flush()}
            disabled={inCorso}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-medium transition-all disabled:opacity-50"
          >
            {inCorso ? "Sincronizzazione in corso..." : "Forza Sync"}
          </button>
        </div>

        {ultimoEsito && (
          <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4 flex gap-4 text-sm">
            <span className="text-[#6ab07a]">Sincronizzati con successo: {ultimoEsito.ok}</span>
            {ultimoEsito.falliti > 0 && (
              <span className="text-red-400">Falliti: {ultimoEsito.falliti}</span>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-white/5 bg-white/[0.03] overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center text-[#8b9ab3]">Caricamento...</div>
          ) : avvistamenti.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#4a7c59]/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#6ab07a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-medium text-lg">La coda è vuota</p>
              <p className="text-[#8b9ab3] mt-1">Tutti i record sono stati sincronizzati con il server.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#8b9ab3] text-xs uppercase tracking-wider border-b border-white/5">
                    <th className="text-left py-4 px-4 font-medium">Data</th>
                    <th className="text-left py-4 px-4 font-medium">Specie</th>
                    <th className="text-left py-4 px-4 font-medium">Tipologia / Sesso</th>
                    <th className="text-left py-4 px-4 font-medium">Stato</th>
                    <th className="text-right py-4 px-4 font-medium">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {avvistamenti.map((a) => (
                    <tr key={a.clientId} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-4 text-[#c9d5e0]">
                        {new Date(a.timestamp).toLocaleString("it-IT", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                        })}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          a.specie === "cervo" ? "bg-[#4a7c59]/20 text-[#6ab07a]" : "bg-[#5e7a8f]/20 text-[#7aafc0]"
                        }`}>
                          {LABEL_SPECIE[a.specie] ?? a.specie}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-[#c9d5e0]">
                        <span className="capitalize">{LABEL_TIPOLOGIA[a.tipologia] ?? a.tipologia}</span>
                        <span className="text-[#8b9ab3] mx-2">•</span>
                        <span>{LABEL_SESSO[a.sesso] ?? a.sesso}</span>
                      </td>
                      <td className="py-4 px-4">
                        {a.syncStatus === "error" ? (
                          <span className="text-red-400 text-xs px-2 py-1 rounded-full bg-red-400/10" title={a.syncError}>Errore</span>
                        ) : (
                          <span className="text-amber-400 text-xs px-2 py-1 rounded-full bg-amber-400/10">In attesa</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setEditingRecord(a)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition-colors mr-2"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => handleDelete(a.clientId)}
                          className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors"
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
          initialData={editingRecord}
          onSave={handleSaveEdit}
          onCancel={() => setEditingRecord(null)}
        />
      )}
    </div>
  );
}
