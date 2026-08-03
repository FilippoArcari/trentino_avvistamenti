"use client";

import { useState, useMemo, useEffect } from "react";
import {
  TIPOLOGIE_PER_SPECIE,
  sessiAmmessi,
  sessoDeterminato,
  type Specie,
  type Sesso,
} from "@/app/lib/fauna-config";

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
  femmina: "Femmina",
};

const LABEL_SESSO: Record<Sesso, string> = {
  maschio: "Maschio",
  femmina: "Femmina",
  indeterminato: "Indeterminato",
};

export interface EditableAvvistamento {
  _id?: string;
  clientId?: string;
  specie: Specie;
  tipologia: string;
  sesso: Sesso;
  posizione: { lat: number; lng: number };
}

export function EditAvvistamentoModal({
  initialData,
  onSave,
  onCancel,
}: {
  initialData: EditableAvvistamento;
  onSave: (data: EditableAvvistamento) => Promise<void>;
  onCancel: () => void;
}) {
  const [specie, setSpecie] = useState<Specie>(initialData.specie);
  const [tipologia, setTipologia] = useState<string>(initialData.tipologia);
  const [sesso, setSesso] = useState<Sesso>(initialData.sesso);
  const [isSaving, setIsSaving] = useState(false);

  const tipologieDisponibili = TIPOLOGIE_PER_SPECIE[specie];
  const sessiDisponibili = useMemo(
    () => sessiAmmessi(specie, tipologia as any),
    [specie, tipologia]
  );
  const sessoBloccato = useMemo(
    () => sessoDeterminato(specie, tipologia as any),
    [specie, tipologia]
  );

  useEffect(() => {
    if (!(TIPOLOGIE_PER_SPECIE[specie] as readonly string[]).includes(tipologia)) {
      setTipologia(TIPOLOGIE_PER_SPECIE[specie][0]);
    }
  }, [specie, tipologia]);

  useEffect(() => {
    if (sessoBloccato) setSesso(sessoBloccato);
    else if (!sessiDisponibili.includes(sesso)) setSesso(sessiDisponibili[0]);
  }, [sessoBloccato, sessiDisponibili, sesso]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({ ...initialData, specie, tipologia, sesso });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#161b22] border border-white/10 rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white mb-6">Modifica Avvistamento</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Specie */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold text-[#8b9ab3] uppercase tracking-widest mb-1">
              Specie
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(LABEL_SPECIE) as Specie[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpecie(s)}
                  className={`rounded-xl border py-3 text-sm font-medium transition-all ${
                    specie === s
                      ? "border-[#4a7c59] bg-[#4a7c59]/20 text-[#6ab07a]"
                      : "border-white/5 bg-white/[0.03] text-[#8b9ab3] hover:border-white/10 hover:text-white"
                  }`}
                >
                  {LABEL_SPECIE[s]}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Tipologia */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold text-[#8b9ab3] uppercase tracking-widest mb-1">
              Tipologia
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {tipologieDisponibili.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipologia(t)}
                  className={`rounded-xl border py-3 text-sm font-medium transition-all ${
                    tipologia === t
                      ? "border-[#4a7c59] bg-[#4a7c59]/20 text-[#6ab07a]"
                      : "border-white/5 bg-white/[0.03] text-[#8b9ab3] hover:border-white/10 hover:text-white"
                  }`}
                >
                  {LABEL_TIPOLOGIA[t] ?? t}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Sesso */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold text-[#8b9ab3] uppercase tracking-widest mb-1">
              Sesso
            </legend>
            {sessoBloccato ? (
              <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                <span className="text-sm font-medium text-white">
                  {LABEL_SESSO[sessoBloccato as Sesso]}
                </span>
                <span className="text-xs text-[#8b9ab3]">
                  — determinato
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {sessiDisponibili.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSesso(s)}
                    className={`rounded-xl border py-3 text-sm font-medium transition-all ${
                      sesso === s
                        ? "border-[#4a7c59] bg-[#4a7c59]/20 text-[#6ab07a]"
                        : "border-white/5 bg-white/[0.03] text-[#8b9ab3] hover:border-white/10 hover:text-white"
                    }`}
                  >
                    {LABEL_SESSO[s as Sesso]}
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-white hover:bg-white/5 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-[#4a7c59] text-sm font-medium text-white hover:bg-[#3d6b4a] transition-colors disabled:opacity-60"
            >
              {isSaving ? "Salvataggio..." : "Salva Modifiche"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
