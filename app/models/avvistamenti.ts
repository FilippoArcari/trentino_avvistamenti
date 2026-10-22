// @/models/Avvistamento.ts
import mongoose, { Schema } from "mongoose";

import { specieAmmesse, tipologieAmmesse, sessoAmmesso } from "@/app/utils/constant";


const avvistamentoSchema = new Schema(
  {
    clientId: { type: String, immutable: true },
    clientRevision: {
      type: Number,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },
    specie: { type: String, enum: specieAmmesse, required: true },
    tipologia: { type: String, enum: tipologieAmmesse, required: true },
    posizione: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    timestamp: { type: Date, required: true },
    sesso: { type: String, enum: sessoAmmesso, required: true },
  },
  { collection: "avvistamenti", timestamps: true }
);

// I documenti storici senza clientId restano validi e fuori dall'indice.
avvistamentoSchema.index(
  { clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: "string" } } }
);

export const AvvistamentoModel =
  mongoose.models.Avvistamento || mongoose.model("Avvistamento", avvistamentoSchema);

let syncIndexPromise: Promise<unknown> | undefined;

export async function ensureAvvistamentoSyncIndex() {
  if (!syncIndexPromise) {
    // Attende l'indice anche se autoIndex è disabilitato: senza il vincolo
    // due richieste contemporanee potrebbero inserire lo stesso avvistamento.
    syncIndexPromise = AvvistamentoModel.createIndexes().catch((error: unknown) => {
      syncIndexPromise = undefined;
      throw error;
    });
  }
  await syncIndexPromise;
}
