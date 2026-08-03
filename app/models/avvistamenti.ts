import mongoose, { Schema } from "mongoose";
import { TIPOLOGIE_PER_SPECIE, sessiAmmessi } from "@/app/lib/fauna-config";

const options = { discriminatorKey: "specie", collection: "avvistamenti", timestamps: true };

const avvistamentoBaseSchema = new Schema({
  posizione: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  timestamp: { type: Date, required: true },
  sesso: { type: String, enum: ["maschio", "femmina", "indeterminato"], required: true },
}, options);

avvistamentoBaseSchema.pre("validate", async function () {
  const specie = this.get("specie") as string | undefined;
  const tipologia = this.get("tipologia") as string | undefined;
  const sesso = this.get("sesso") as "maschio" | "femmina" | "indeterminato" | undefined;

  if (!specie || !tipologia || !sesso) return;

  const ammessi = sessiAmmessi(specie as any, tipologia as any);
  if (!ammessi.includes(sesso)) {
    this.invalidate(
      "sesso",
      `Sesso "${sesso}" incompatibile con tipologia "${tipologia}" per specie "${specie}"`,
      sesso
    );
  }
});

export const AvvistamentoModel =
  mongoose.models.Avvistamento || mongoose.model("Avvistamento", avvistamentoBaseSchema);

const cervoSchema = new Schema({
  tipologia: { type: String, enum: TIPOLOGIE_PER_SPECIE.cervo, required: true },
});
export const CervoModel =
  AvvistamentoModel.discriminators?.cervo ||
  AvvistamentoModel.discriminator("cervo", cervoSchema);

const camoscioSchema = new Schema({
  tipologia: { type: String, enum: TIPOLOGIE_PER_SPECIE.camoscio, required: true },
});
export const CamoscioModel =
  AvvistamentoModel.discriminators?.camoscio ||
  AvvistamentoModel.discriminator("camoscio", camoscioSchema);

const caprioloSchema = new Schema({
  tipologia: { type: String, enum: TIPOLOGIE_PER_SPECIE.capriolo, required: true },
});
export const CaprioloModel =
  AvvistamentoModel.discriminators?.capriolo ||
  AvvistamentoModel.discriminator("capriolo", caprioloSchema);