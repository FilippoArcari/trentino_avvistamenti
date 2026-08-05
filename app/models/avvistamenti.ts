// @/models/Avvistamento.ts
import mongoose, { Schema } from "mongoose";

import { specieAmmesse, tipologieAmmesse, sessoAmmesso } from "@/app/utils/constant";


const avvistamentoSchema = new Schema(
  {
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


export const AvvistamentoModel =
  mongoose.models.Avvistamento || mongoose.model("Avvistamento", avvistamentoSchema);