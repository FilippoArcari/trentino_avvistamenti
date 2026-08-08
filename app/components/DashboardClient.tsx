// app/components/DashboardClient.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { GraficoSpecie } from "@/app/components/GraficoSpecie";
import { Navbar } from "@/app/components/Navbar";
import Link from "next/link";
import { hslaSpecie, etichettaSpecie } from "@/app/utils/speciesColor";
import { EditAvvistamentoModal, type EditableAvvistamento } from "@/app/components/EditAvvistamentoModal";
import { type Sesso, sessoAmmesso, specieAmmesse, type Specie } from "../utils/constant";

// Leaflet richiede il DOM — import dinamico senza SSR
const MappaAvvistamenti = dynamic(
  () =>
    import("@/app/components/MappaAvvistamenti").then(
      (m) => m.MappaAvvistamenti
    ),
  { ssr: false, loading: () => <MapSkeleton /> }
);

export interface Avvistamento {
  _id: string;
  specie: Specie;
  tipologia: string;
  sesso: Sesso;
  posizione: { lat: number; lng: number };
  timestamp: string;
}

const PER_PAGINA = 10;

function MapSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-base-300 rounded-2xl animate-pulse">
      <span className="text-primary text-sm font-medium">
        Caricamento mappa…
      </span>
    </div>
  );
}

export function DashboardClient() {
  const [avvistamenti, setAvvistamenti] = useState<Avvistamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<Avvistamento | null>(null);
  const [pagina, setPagina] = useState(1);
  const [filtroSpecie, setFiltroSpecie] = useState<"" | Avvistamento["specie"]>("");
  const [filtroSesso, setFiltroSesso] = useState<"" | Avvistamento["sesso"]>("");
  const [filtroDataDa, setFiltroDataDa] = useState("");
  const [filtroDataA, setFiltroDataA] = useState("");

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filtroSpecie) params.set("specie", filtroSpecie);
    if (filtroSesso) params.set("sesso", filtroSesso);
    if (filtroDataDa) params.set("da", filtroDataDa);
    if (filtroDataA) params.set("a", filtroDataA);
    const queryString = params.toString();

    fetch(`/api/avvistamenti${queryString ? `?${queryString}` : ""}`)
      .then((r) => {
        if (!r.ok) throw new Error("Errore nel caricamento dati");
        return r.json();
      })
      .then((data: Avvistamento[]) => {
        setAvvistamenti(data);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Errore sconosciuto");
        setLoading(false);
      });
  }, [filtroSpecie, filtroSesso, filtroDataDa, filtroDataA]);

  // Rifà la fetch ogni volta che cambia un filtro (loadData cambia identità perché
  // dipende dai filtri) e riporta la paginazione a pagina 1 sul nuovo set di risultati.
  useEffect(() => {
    setPagina(1);
    loadData();
  }, [loadData]);

  const handleSaveEdit = async (updated: EditableAvvistamento) => {
    if (!updated._id) return;
    const res = await fetch(`/api/avvistamenti/${updated._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        specie: updated.specie,
        tipologia: updated.tipologia,
        sesso: updated.sesso,
      }),
    });
    if (res.ok) {
      setEditingRecord(null);
      loadData();
    } else {
      alert("Errore durante il salvataggio");
    }
  };

  const handleDelete = async (id: string) => {
    if (!navigator.onLine) {
      alert("La modifica e l'eliminazione dei record online è disponibile solamente quando si è connessi a internet.");
      return;
    }
    if (!confirm("Sei sicuro di voler eliminare questo avvistamento?")) return;
    try {
      const res = await fetch(`/api/avvistamenti/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadData();
      } else {
        alert("Errore durante l'eliminazione");
      }
    } catch (e) {
      alert("Errore di rete durante l'eliminazione");
    }
  };

  const cervi = avvistamenti.filter((a) => a.specie === specieAmmesse[0]).length;
  const camosci = avvistamenti.filter((a) => a.specie === specieAmmesse[1]).length;

  const totalePagine = Math.max(1, Math.ceil(avvistamenti.length / PER_PAGINA));
  const paginaCorrente = Math.min(pagina, totalePagine);
  const avvistamentiPagina = avvistamenti.slice(
    (paginaCorrente - 1) * PER_PAGINA,
    paginaCorrente * PER_PAGINA
  );

  const filtriAttivi = Boolean(filtroSpecie || filtroSesso || filtroDataDa || filtroDataA);

  const resetFiltri = () => {
    setFiltroSpecie("");
    setFiltroSesso("");
    setFiltroDataDa("");
    setFiltroDataA("");
  };

  return (
    <div className="min-h-screen bg-base-100 text-base-content font-sans">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-base-content tracking-tight mb-2">
            Dashboard Avvistamenti
          </h1>
          <p className="text-base-content/60 text-base">
            Panoramica degli avvistamenti registrati in Trentino
          </p>
        </div>

        {/* ── Error state ────────────────────────────────────── */}
        {error && (
          <div className="mb-8 rounded-2xl border border-error/20 bg-error/10 px-5 py-4 text-error text-sm">
            {error}
          </div>
        )}

        {/* ── Empty state (nessun dato registrato, nessun filtro attivo) ── */}
        {!loading && !error && avvistamenti.length === 0 && !filtriAttivi && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <p className="text-base-content/60 text-base text-center max-w-xs">
              Nessun avvistamento ancora registrato. Vai su{" "}
              <Link
                href="/"
                className="text-success underline underline-offset-2"
              >
                Registra
              </Link>{" "}
              per inserire il primo.
            </p>
          </div>
        )}

        {/* ── Barra filtri ─────────────────────────────────────── */}
        {!loading && !error && (avvistamenti.length > 0 || filtriAttivi) && (
          <FiltriBar
            filtroSpecie={filtroSpecie}
            filtroSesso={filtroSesso}
            filtroDataDa={filtroDataDa}
            filtroDataA={filtroDataA}
            onSpecieChange={setFiltroSpecie}
            onSessoChange={setFiltroSesso}
            onDataDaChange={setFiltroDataDa}
            onDataAChange={setFiltroDataA}
            onReset={resetFiltri}
            filtriAttivi={filtriAttivi}
          />
        )}

        {/* ── Empty state (filtri senza risultati) ────────────── */}
        {!loading && !error && avvistamenti.length === 0 && filtriAttivi && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <p className="text-base-content/60 text-base text-center max-w-xs">
              Nessun avvistamento corrisponde ai filtri selezionati.
            </p>
            <button
              onClick={resetFiltri}
              className="text-success underline underline-offset-2 text-sm"
            >
              Azzera filtri
            </button>
          </div>
        )}

        {/* ── Main grid ───────────────────────────────────────── */}
        {(loading || avvistamenti.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Mappa — occupa 2/3 su schermi grandi */}
            <div className="lg:col-span-2">
              <PanelCard title="Mappa degli avvistamenti">
                <div className="h-[420px] rounded-xl overflow-hidden">
                  {loading ? (
                    <MapSkeleton />
                  ) : (
                    <MappaAvvistamenti avvistamenti={avvistamenti} />
                  )}
                </div>
              </PanelCard>
            </div>

            {/* Grafico a torta */}
            <div className="lg:col-span-1">
              <PanelCard title="Avvistamenti per specie">
                <div className="flex flex-col">
                  {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="w-40  rounded-full bg-base-content/5 animate-pulse" />
                    </div>
                  ) : (
                    <GraficoSpecie avvistamenti={avvistamenti} />
                  )}
                </div>
              </PanelCard>
            </div>
          </div>
        )}

        {/* ── Tabella avvistamenti ──────────────────────── */}
        {!loading && avvistamenti.length > 0 && (
          <div className="mt-6">
            <PanelCard title={`Avvistamenti (${avvistamenti.length})`}>
              <TabellaAvvistamenti
                avvistamenti={avvistamentiPagina}
                onEdit={(record) => {
                  if (!navigator.onLine) {
                    alert("La modifica e l'eliminazione dei record online è disponibile solamente quando si è connessi a internet.");
                    return;
                  }
                  setEditingRecord(record);
                }}
                onDelete={handleDelete}
              />
              <Paginazione
                paginaCorrente={paginaCorrente}
                totalePagine={totalePagine}
                onChange={setPagina}
              />
            </PanelCard>
          </div>
        )}
      </main>

      {editingRecord && (
        <EditAvvistamentoModal
          initialData={editingRecord as unknown as EditableAvvistamento}
          onSave={handleSaveEdit}
          onCancel={() => setEditingRecord(null)}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
  className = "",
}: {
  label: string;
  value: string;
  accent: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-base-content/5 bg-base-content/[0.03] p-5 flex items-center gap-4 ${className}`}
      style={{ boxShadow: `inset 0 0 0 1px ${accent}20` }}
    >
      <div
        className="w-3 h-10 rounded-full flex-shrink-0"
        style={{ background: accent }}
      />
      <div>
        <p className="text-2xl font-bold text-base-content leading-none mb-1">
          {value}
        </p>
        <p className="text-xs text-base-content/60 font-medium">{label}</p>
      </div>
    </div>
  );
}

function PanelCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-base-content/5 bg-base-content/[0.03] p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-base-content uppercase tracking-widest">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function FiltriBar({
  filtroSpecie,
  filtroSesso,
  filtroDataDa,
  filtroDataA,
  onSpecieChange,
  onSessoChange,
  onDataDaChange,
  onDataAChange,
  onReset,
  filtriAttivi,
}: {
  filtroSpecie: "" | Avvistamento["specie"];
  filtroSesso: "" | Avvistamento["sesso"];
  filtroDataDa: string;
  filtroDataA: string;
  onSpecieChange: (v: "" | Avvistamento["specie"]) => void;
  onSessoChange: (v: "" | Avvistamento["sesso"]) => void;
  onDataDaChange: (v: string) => void;
  onDataAChange: (v: string) => void;
  onReset: () => void;
  filtriAttivi: boolean;
}) {
  return (
    <div className="mb-6 rounded-2xl border border-base-content/5 bg-base-content/[0.03] p-4 flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-content/60 font-medium">Specie</label>
        <select
          value={filtroSpecie}
          onChange={(e) => onSpecieChange(e.target.value as "" | Avvistamento["specie"])}
          className="select select-sm select-bordered bg-base-100"
        >
          <option value="">Tutte</option>
          {specieAmmesse.map((s) => (
            <option key={s} value={s}>
              {etichettaSpecie(s)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-content/60 font-medium">Sesso</label>
        <select
          value={filtroSesso}
          onChange={(e) => onSessoChange(e.target.value as "" | Avvistamento["sesso"])}
          className="select select-sm select-bordered bg-base-100"
        >
          <option value="">Tutti</option>
          {sessoAmmesso.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-content/60 font-medium">Dal</label>
        <input
          type="date"
          value={filtroDataDa}
          max={filtroDataA || undefined}
          onChange={(e) => onDataDaChange(e.target.value)}
          className="input input-sm input-bordered bg-base-100"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-base-content/60 font-medium">Al</label>
        <input
          type="date"
          value={filtroDataA}
          min={filtroDataDa || undefined}
          onChange={(e) => onDataAChange(e.target.value)}
          className="input input-sm input-bordered bg-base-100"
        />
      </div>

      {filtriAttivi && (
        <button
          onClick={onReset}
          className="px-3 py-1.5 rounded-lg bg-error/10 hover:bg-error/20 text-error text-xs font-medium transition-colors"
        >
          Azzera filtri
        </button>
      )}
    </div>
  );
}

function TabellaAvvistamenti({
  avvistamenti,
  onEdit,
  onDelete,
}: {
  avvistamenti: Avvistamento[];
  onEdit?: (record: Avvistamento) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-base-content/60 text-xs uppercase tracking-wider border-b border-base-content/5">
            <th className="text-left py-2 px-2 font-medium">Data</th>
            <th className="text-left py-2 px-2 font-medium">Specie</th>
            <th className="text-left py-2 px-2 font-medium">Tipologia</th>
            <th className="text-left py-2 px-2 font-medium">Sesso</th>
            <th className="text-left py-2 px-2 font-medium">Posizione</th>
            {(onEdit || onDelete) && <th className="text-right py-2 px-2 font-medium">Azioni</th>}
          </tr>
        </thead>
        <tbody>
          {avvistamenti.map((a) => (
            <tr
              key={a._id}
              className="border-b border-base-content/[0.04] hover:bg-base-content/[0.02] transition-colors"
            >
              <td className="py-3 px-2 text-base-content">
                {new Date(a.timestamp).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </td>
              <td className="py-3 px-2">
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
              <td className="py-3 px-2 text-base-content capitalize">
                {a.tipologia}
              </td>
              <td className="py-3 px-2 text-base-content capitalize">
                {a.sesso}
              </td>
              <td className="py-3 px-2 text-base-content/60 font-mono text-xs">
                {a.posizione.lat.toFixed(4)}, {a.posizione.lng.toFixed(4)}
              </td>
              {(onEdit || onDelete) && (
                <td className="py-3 px-2 text-right whitespace-nowrap">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(a)}
                      className="px-2 py-1 rounded-lg bg-base-content/5 hover:bg-base-content/10 text-base-content text-xs font-medium transition-colors mr-2"
                    >
                      Modifica
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(a._id)}
                      className="px-2 py-1 rounded-lg bg-error/10 hover:bg-error/20 text-error text-xs font-medium transition-colors"
                    >
                      Elimina
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Paginazione({
  paginaCorrente,
  totalePagine,
  onChange,
}: {
  paginaCorrente: number;
  totalePagine: number;
  onChange: (pagina: number) => void;
}) {
  if (totalePagine <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-2">
      <button
        onClick={() => onChange(paginaCorrente - 1)}
        disabled={paginaCorrente === 1}
        className="px-3 py-1.5 rounded-lg bg-base-content/5 hover:bg-base-content/10 disabled:opacity-30 disabled:cursor-not-allowed text-base-content text-xs font-medium transition-colors"
      >
        ← Precedente
      </button>

      <span className="text-xs text-base-content/60 font-medium">
        Pagina {paginaCorrente} di {totalePagine}
      </span>

      <button
        onClick={() => onChange(paginaCorrente + 1)}
        disabled={paginaCorrente === totalePagine}
        className="px-3 py-1.5 rounded-lg bg-base-content/5 hover:bg-base-content/10 disabled:opacity-30 disabled:cursor-not-allowed text-base-content text-xs font-medium transition-colors"
      >
        Successiva →
      </button>
    </div>
  );
}