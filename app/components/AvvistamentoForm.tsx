// app/components/AvvistamentoForm.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import type { LatLngLiteral } from "leaflet";
import {
  TIPOLOGIE_PER_SPECIE,
  sessiAmmessi,
  sessoDeterminato,
  type Specie,
  type Sesso,
} from "@/app/lib/fauna-config";
import {
  salvaLocale,
  richiediStoragePersistente,
  type AvvistamentoLocale,
} from "@/app/lib/offline-db";
import { useSync } from "@/app/hooks/useSync";

const MapPickerModal = dynamic(
  () => import("./MapPickerModal").then((m) => m.MapPickerModal),
  { ssr: false }
);

const LABEL_SPECIE: Record<Specie, string> = {
  cervo: "Cervo",
  camoscio: "Camoscio",
  capriolo: "Capriolo",
};
const LABEL_TIPOLOGIA: Record<string, string> = {
  palcuto: "Palcuto",
  sottile: "Sottile",
  fusone: "Fusone",
  piccolo: "Piccolo",
  yearling: "Yearling",
  adulto: "Adulto",
  prima: "Prima",
  seconda: "Seconda",
};

const LABEL_SESSO: Record<Sesso, string> = {
  maschio: "Maschio",
  femmina: "Femmina",
  indeterminato: "Indeterminato",
};

type StatoGeo = "idle" | "loading" | "ok" | "error" | "manuale";

export function AvvistamentoForm() {
  const { flush, inCorso } = useSync();

  const [specie, setSpecie] = useState<Specie>("cervo");
  const [tipologia, setTipologia] = useState<string>(
    TIPOLOGIE_PER_SPECIE.cervo[0]
  );
  const [sesso, setSesso] = useState<Sesso>("maschio");
  const [posizione, setPosizione] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [statoGeo, setStatoGeo] = useState<StatoGeo>("idle");
  const [salvataggioOk, setSalvataggioOk] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [erroreGps, setErroreGps] = useState(false);

  // Sorgente esplicita della posizione: distingue "GPS non ancora
  // disponibile" (statoGeo) da "l'utente ha scelto un punto sulla
  // mappa" — necessario perché handleSubmit deve sapere se può
  // sovrascrivere `posizione` con una lettura GPS fresca o no.
  const [sorgentePosizione, setSorgentePosizione] = useState<"gps" | "manuale">("gps");
  const [showMapPicker, setShowMapPicker] = useState(false);

  const tipologieDisponibili = TIPOLOGIE_PER_SPECIE[specie];
  const sessiDisponibili = useMemo(
    () => sessiAmmessi(specie, tipologia as any),
    [specie, tipologia]
  );
  const sessoBloccato = useMemo(
    () => sessoDeterminato(specie, tipologia as any),
    [specie, tipologia]
  );

  // Quando cambia specie: la tipologia corrente potrebbe non esistere
  // più per la nuova specie (es. da cervo a camoscio, "palcuto" non
  // esiste per camoscio) — reset alla prima tipologia valida.
  useEffect(() => {
    if (!(TIPOLOGIE_PER_SPECIE[specie] as readonly string[]).includes(tipologia)) {
      setTipologia(TIPOLOGIE_PER_SPECIE[specie][0]);
    }
  }, [specie, tipologia]);

  // Quando tipologia determina univocamente il sesso, forziamo il
  // valore e blocchiamo il campo — l'utente non può nemmeno provare
  // a costruire una combinazione invalida.
  useEffect(() => {
    if (sessoBloccato) setSesso(sessoBloccato);
    else if (!sessiDisponibili.includes(sesso)) setSesso(sessiDisponibili[0]);
  }, [sessoBloccato, sessiDisponibili, sesso]);

  useEffect(() => {
    richiediStoragePersistente();
    // Tentativo iniziale per mostrare la posizione all'utente prima del salvataggio
    rilevaPosizione();
  }, []);

  function rilevaPosizione(): Promise<{ lat: number; lng: number } | null> {
    // Il GPS funziona offline: non serve rete per la triangolazione,
    // solo per eventuale A-GPS assist (più lento senza rete, ma non
    // bloccante). Per questo la geolocalizzazione ha senso anche in
    // un'app pensata per l'uso senza connessione in bosco.
    if (!("geolocation" in navigator)) {
      setStatoGeo("manuale");
      return Promise.resolve(null);
    }
    setStatoGeo("loading");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPosizione(p);
          setStatoGeo("ok");
          resolve(p);
        },
        () => {
          setStatoGeo("error");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15_000 }
      );
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setErroreGps(false);

    // Vecchio comportamento invariato: riacquisiamo il GPS fresco al
    // submit. Unica eccezione: se l'utente ha scelto un punto sulla
    // mappa, quella è la sorgente esplicita e non va sovrascritta.
    const pos = sorgentePosizione === "manuale" ? posizione : await rilevaPosizione();

    if (!pos) {
      setErroreGps(true);
      setIsSaving(false);
      return;
    }

    const record: AvvistamentoLocale = {
      clientId: crypto.randomUUID(),
      specie,
      tipologia,
      sesso,
      posizione: pos,
      timestamp: new Date().toISOString(),
      syncStatus: "pending",
      createdAtLocale: new Date().toISOString(),
    };

    await salvaLocale(record);
    setSalvataggioOk(true);
    setIsSaving(false);
    setTimeout(() => setSalvataggioOk(false), 2500);

    // tentativo immediato: se offline, flush() esce silenziosamente e
    // il record resta in outbox per il prossimo trigger automatico
    flush();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-lg mx-auto flex flex-col gap-6"
    >
      {/* Specie */}
      <Section label="Specie">
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(LABEL_SPECIE) as Specie[]).map((s) => (
            <ToggleButton
              key={s}
              active={specie === s}
              onClick={() => setSpecie(s)}
            >
              {LABEL_SPECIE[s]}
            </ToggleButton>
          ))}
        </div>
      </Section>

      {/* Tipologia */}
      <Section label="Tipologia">
        <div className="grid grid-cols-2 gap-3">
          {tipologieDisponibili.map((t) => (
            <ToggleButton
              key={t}
              active={tipologia === t}
              onClick={() => setTipologia(t)}
            >
              {LABEL_TIPOLOGIA[t] ?? t}
            </ToggleButton>
          ))}
        </div>
      </Section>

      {/* Sesso */}
      <Section label="Sesso">
        {sessoBloccato ? (
          <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
            <span className="text-sm font-medium text-white">
              {LABEL_SESSO[sessoBloccato as Sesso]}
            </span>
            <span className="text-xs text-[#8b9ab3]">
              — determinato dalla tipologia
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {sessiDisponibili.map((s) => (
              <ToggleButton
                key={s}
                active={sesso === s}
                onClick={() => setSesso(s)}
              >
                {LABEL_SESSO[s as Sesso]}
              </ToggleButton>
            ))}
          </div>
        )}
      </Section>

      {/* Posizione */}
      <Section label="Posizione">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 min-h-[52px] flex items-center justify-between gap-3">
          <div className="text-sm">
            {sorgentePosizione === "manuale" && posizione ? (
              <span className="font-mono text-[#6ab07a] text-xs tracking-wide">
                {posizione.lat.toFixed(5)}, {posizione.lng.toFixed(5)}{" "}
                <span className="text-[#8b9ab3]">(manuale)</span>
              </span>
            ) : (
              <>
                {statoGeo === "loading" && (
                  <span className="text-[#8b9ab3] animate-pulse">
                    Rilevamento in corso…
                  </span>
                )}
                {statoGeo === "ok" && posizione && (
                  <span className="font-mono text-[#6ab07a] text-xs tracking-wide">
                    {posizione.lat.toFixed(5)}, {posizione.lng.toFixed(5)}
                  </span>
                )}
                {(statoGeo === "error" || statoGeo === "manuale") && (
                  <span className="text-[#8b9ab3] text-xs">
                    La posizione verrà acquisita al salvataggio
                  </span>
                )}
                {statoGeo === "idle" && (
                  <span className="text-[#8b9ab3] text-xs">In attesa…</span>
                )}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowMapPicker(true)}
            className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-[#8b9ab3] hover:text-white hover:border-white/20"
          >
            {sorgentePosizione === "manuale" ? "Modifica" : "Imposta manualmente"}
          </button>

          {sorgentePosizione === "manuale" && (
            <button
              type="button"
              onClick={() => setSorgentePosizione("gps")}
              className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-[#8b9ab3] hover:text-white hover:border-white/20"
            >
              Usa GPS
            </button>
          )}
        </div>
      </Section>

      {showMapPicker && (
        <MapPickerModal
          posizioneIniziale={posizione}
          onAnnulla={() => setShowMapPicker(false)}
          onConferma={(p: LatLngLiteral) => {
            setPosizione(p);
            setSorgentePosizione("manuale");
            setShowMapPicker(false);
          }}
        />
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSaving}
        className="w-full rounded-xl bg-[#4a7c59] py-4 text-base font-semibold text-white transition-all hover:bg-[#3d6b4a] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isSaving ? "Acquisizione GPS e salvataggio…" : "Salva avvistamento"}
      </button>

      {/* Feedback errore GPS */}
      {erroreGps && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-400">
          Impossibile acquisire la posizione GPS. Attiva la localizzazione e riprova.
        </div>
      )}

      {/* Feedback salvataggio */}
      {salvataggioOk && (
        <div className="rounded-xl border border-[#4a7c59]/30 bg-[#4a7c59]/10 px-4 py-3 text-center text-sm text-[#6ab07a]">
          Salvato
          {inCorso
            ? " — sincronizzazione in corso…"
            : " localmente, verrà sincronizzato."}
        </div>
      )}
    </form>
  );
}

// ── Helper components ────────────────────────────────────────────

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-semibold text-[#8b9ab3] uppercase tracking-widest mb-1">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border py-3 text-sm font-medium transition-all active:scale-[0.97] ${
        active
          ? "border-[#4a7c59] bg-[#4a7c59]/20 text-[#6ab07a]"
          : "border-white/5 bg-white/[0.03] text-[#8b9ab3] hover:border-white/10 hover:text-white hover:bg-white/[0.06]"
      }`}
    >
      {children}
    </button>
  );
}