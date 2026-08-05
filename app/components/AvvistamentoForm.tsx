// app/components/AvvistamentoForm.tsx
"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { LatLngLiteral } from "leaflet";
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

interface AvvistamentoFormProps {
  specieAmmesse: readonly string[];
  tipologieAmmesse: readonly string[];
  sessoAmmesso: readonly string[];
}

type StatoGeo = "idle" | "loading" | "ok" | "error" | "manuale";
type Step = 0 | 1 | 2; // 0 = Specie, 1 = Sesso, 2 = Tipologia + posizione + submit

const STEP_LABELS = ["Specie", "Sesso", "Tipologia"] as const;

export function AvvistamentoForm({
  specieAmmesse,
  tipologieAmmesse,
  sessoAmmesso,
}: AvvistamentoFormProps) {
  const { flush, inCorso } = useSync();

  const [step, setStep] = useState<Step>(0);

  const [specie, setSpecie] = useState<string>("");
  const [sesso, setSesso] = useState<string>("");
  const [tipologia, setTipologia] = useState<string>("");

  const [posizione, setPosizione] = useState<{ lat: number; lng: number } | null>(null);
  const [statoGeo, setStatoGeo] = useState<StatoGeo>("idle");
  const [salvataggioOk, setSalvataggioOk] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [erroreGps, setErroreGps] = useState(false);
  const [erroreSalvataggio, setErroreSalvataggio] = useState(false);

  const [sorgentePosizione, setSorgentePosizione] = useState<"gps" | "manuale">("gps");
  const [showMapPicker, setShowMapPicker] = useState(false);

  useEffect(() => {
    richiediStoragePersistente();
    rilevaPosizione();
  }, []);

  function rilevaPosizione(): Promise<{ lat: number; lng: number } | null> {
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

  function selezionaSpecie(s: string) {
    setSpecie(s);
    // Avanzamento automatico: un tap in meno per utenti anziani
    setStep(1);
  }

  function selezionaSesso(s: string) {
    setSesso(s);
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setErroreGps(false);
    setErroreSalvataggio(false);

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

    try {
      await salvaLocale(record);
    } catch (err) {
      console.error("Errore salvataggio locale:", err);
      setErroreSalvataggio(true);
      setIsSaving(false);
      return;
    }

    setSalvataggioOk(true);
    setIsSaving(false);
    setTimeout(() => setSalvataggioOk(false), 2500);

    // Reset per il prossimo avvistamento
    setStep(0);
    setSpecie("");
    setSesso("");
    setTipologia(tipologieAmmesse[0] ?? "");

    flush();
  }

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-6">
      <StepIndicator step={step} />

      {step === 0 && (
        <StepSpecie
          specieAmmesse={specieAmmesse}
          selezionata={specie}
          onSeleziona={selezionaSpecie}
        />
      )}

      {step === 1 && (
        <StepSesso
          sessoAmmesso={sessoAmmesso}
          selezionato={sesso}
          onSeleziona={selezionaSesso}
          onIndietro={() => setStep(0)}
        />
      )}

      {step === 2 && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Section label="Tipologia">
            <div className="grid grid-cols-3 gap-3">
              {tipologieAmmesse.map((t) => (
                <ToggleButton
                  key={t}
                  active={tipologia === t}
                  onClick={() => setTipologia(t)}
                >
                  {t}
                </ToggleButton>
              ))}
            </div>
          </Section>

          {/* Posizione */}
          <Section label="Posizione">
            <div className="rounded-xl border border-base-content/10 bg-base-content/[0.03] px-4 py-3 min-h-[52px] flex items-center justify-between gap-3">
              <div className="text-sm">
                {sorgentePosizione === "manuale" && posizione ? (
                  <span className="font-mono text-success text-xs tracking-wide">
                    {posizione.lat.toFixed(5)}, {posizione.lng.toFixed(5)}{" "}
                    <span className="text-base-content/60">(manuale)</span>
                  </span>
                ) : (
                  <>
                    {statoGeo === "loading" && (
                      <span className="text-base-content/60 animate-pulse">
                        Rilevamento in corso…
                      </span>
                    )}
                    {statoGeo === "ok" && posizione && (
                      <span className="font-mono text-success text-xs tracking-wide">
                        {posizione.lat.toFixed(5)}, {posizione.lng.toFixed(5)}
                      </span>
                    )}
                    {(statoGeo === "error" || statoGeo === "manuale") && (
                      <span className="text-base-content/60 text-xs">
                        La posizione verrà acquisita al salvataggio
                      </span>
                    )}
                    {statoGeo === "idle" && (
                      <span className="text-base-content/60 text-xs">In attesa…</span>
                    )}
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="shrink-0 rounded-lg border border-base-content/10 px-3 py-1.5 text-xs font-medium text-base-content/60 hover:text-base-content hover:border-base-content/20"
              >
                {sorgentePosizione === "manuale" ? "Modifica" : "Imposta manualmente"}
              </button>

              {sorgentePosizione === "manuale" && (
                <button
                  type="button"
                  onClick={() => setSorgentePosizione("gps")}
                  className="shrink-0 rounded-lg border border-base-content/10 px-3 py-1.5 text-xs font-medium text-base-content/60 hover:text-base-content hover:border-base-content/20"
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

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="shrink-0 rounded-xl border border-base-content/10 px-5 py-4 text-base font-medium text-base-content/60 hover:text-base-content hover:border-base-content/20"
            >
              Indietro
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded-xl bg-primary py-4 text-base font-semibold text-primary-content transition-all hover:brightness-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? "Acquisizione GPS e salvataggio…" : "Salva avvistamento"}
            </button>
          </div>
        </form>
      )}

      {/* Feedback: spostato fuori dal blocco step===2 perché il submit
          resetta lo step a 0 nello stesso ciclio in cui imposta questi
          stati — se restassero dentro il form, sparirebbero insieme ad
          esso prima che l'utente possa vederli. */}
      {erroreGps && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-center text-sm text-warning">
          Impossibile acquisire la posizione GPS. Attiva la localizzazione e riprova.
        </div>
      )}

      {erroreSalvataggio && (
        <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-center text-sm text-error">
          Salvataggio non riuscito. Riprova — il dato non è stato registrato.
        </div>
      )}

      {salvataggioOk && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-center text-sm text-success">
          Salvato
          {inCorso
            ? " — sincronizzazione in corso…"
            : " localmente, verrà sincronizzato."}
        </div>
      )}
    </div>
  );
}

// ── Step components ──────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="relative flex items-start w-full px-4">
      {/* Linea di sfondo che collega i pallini */}
      <div className="absolute top-4 left-8 right-8 h-px bg-base-content/10" />
      <div
        className="absolute top-4 left-8 h-px bg-primary/40 transition-all"
        style={{
          width: step === 0 ? "0%" : step === 1 ? "calc(50% - 2rem)" : "calc(100% - 4rem)",
        }}
      />

      {STEP_LABELS.map((label, i) => (
        <div
          key={label}
          className="relative z-10 flex flex-1 flex-col items-center gap-1.5"
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              i === step
                ? "bg-primary text-primary-content"
                : i < step
                ? "bg-primary/30 text-200"
                : "bg-base-content/[0.05] text-base-content/60"
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`text-[11px] font-medium leading-none text-center ${
              i === step ? "text-base-content" : "text-base-content/60"
            }`}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function StepSpecie({
  specieAmmesse,
  selezionata,
  onSeleziona,
}: {
  specieAmmesse: readonly string[];
  selezionata: string;
  onSeleziona: (s: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-center text-lg font-semibold text-base-content">
        Che animale hai avvistato?
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {specieAmmesse.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSeleziona(s)}
            className={`rounded-2xl border py-8 text-lg font-semibold transition-all active:scale-[0.97] ${
              selezionata === s
                ? "border-primary bg-primary/20 text-xl"
                : "border-base-content/5 bg-base-content/[0.03] text-base-content/60 hover:border-base-content/10 hover:text-base-content hover:bg-base-content/[0.06]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepSesso({
  sessoAmmesso,
  selezionato,
  onSeleziona,
  onIndietro,
}: {
  sessoAmmesso: readonly string[];
  selezionato: string;
  onSeleziona: (s: string) => void;
  onIndietro: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-center text-lg font-semibold text-base-content">
        Sesso dell'animale
      </h2>
      <div className="grid grid-cols-1 gap-4">
        {sessoAmmesso.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSeleziona(s)}
            className={`rounded-2xl border py-6 text-lg font-semibold transition-all active:scale-[0.97] ${
              selezionato === s
                ? "border-primary bg-primary/20 text-xl"
                : "border-base-content/5 bg-base-content/[0.03] text-base-content/60 hover:border-base-content/10 hover:text-base-content hover:bg-base-content/[0.06]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onIndietro}
        className="rounded-xl border border-base-content/10 py-3 text-sm font-medium text-base-content/60 hover:text-base-content hover:border-base-content/20"
      >
        Indietro
      </button>
    </div>
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
      <legend className="text-xs font-semibold text-base-content/60 uppercase tracking-widest mb-1">
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
          ? "border-primary bg-primary/20 text-xl"
          : "border-base-content/5 bg-base-content/[0.03] text-base-content/60 hover:border-base-content/10 hover:text-base-content hover:bg-base-content/[0.06]"
      }`}
    >
      {children}
    </button>
  );
}