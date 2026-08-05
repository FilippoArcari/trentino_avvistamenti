// app/components/EditAvvistamentoModal.tsx
"use client";

import { useState } from "react";
import {
  specieAmmesse,
  tipologieAmmesse,
  sessoAmmesso,
  type Specie,
  type Tipologia,
  type Sesso,
} from "@/app/utils/constant";

export interface EditableAvvistamento {
  _id?: string;
  clientId?: string;
  specie: Specie;
  tipologia: Tipologia;
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
  const [specie, setSpecie] = useState<Specie>(
    specieAmmesse.includes(initialData.specie) ? initialData.specie : specieAmmesse[0]
  );
  const [tipologia, setTipologia] = useState<Tipologia>(
    tipologieAmmesse.includes(initialData.tipologia) ? initialData.tipologia : tipologieAmmesse[0]
  );
  const [sesso, setSesso] = useState<Sesso>(
    sessoAmmesso.includes(initialData.sesso) ? initialData.sesso : sessoAmmesso[0]
  );
  const [isSaving, setIsSaving] = useState(false);

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
      <div className="w-full max-w-lg bg-base-200 border border-base-content/10 rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-base-content mb-6">Modifica Avvistamento</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Specie */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold text-base-content/60 uppercase tracking-widest mb-1">
              Specie
            </legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {specieAmmesse.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpecie(s)}
                  className={`rounded-xl border py-2.5 px-3 text-xs font-medium transition-all ${
                    specie === s
                      ? "border-primary bg-primary/20 text-success"
                      : "border-base-content/5 bg-base-content/[0.03] text-base-content/60 hover:border-base-content/10 hover:text-base-content"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Tipologia */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold text-base-content/60 uppercase tracking-widest mb-1">
              Tipologia
            </legend>
            <div className="grid grid-cols-3 gap-3">
              {tipologieAmmesse.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipologia(t)}
                  className={`rounded-xl border py-3 text-sm font-medium transition-all ${
                    tipologia === t
                      ? "border-primary bg-primary/20 text-success"
                      : "border-base-content/5 bg-base-content/[0.03] text-base-content/60 hover:border-base-content/10 hover:text-base-content"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Sesso */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold text-base-content/60 uppercase tracking-widest mb-1">
              Sesso
            </legend>
            <div className="grid grid-cols-3 gap-3">
              {sessoAmmesso.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSesso(s)}
                  className={`rounded-xl border py-3 text-sm font-medium transition-all ${
                    sesso === s
                      ? "border-primary bg-primary/20 text-success"
                      : "border-base-content/5 bg-base-content/[0.03] text-base-content/60 hover:border-base-content/10 hover:text-base-content"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl border border-base-content/10 text-sm font-medium text-base-content hover:bg-base-content/5 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-primary text-sm font-medium text-primary-content hover:brightness-90 transition-colors disabled:opacity-60"
            >
              {isSaving ? "Salvataggio..." : "Salva Modifiche"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}