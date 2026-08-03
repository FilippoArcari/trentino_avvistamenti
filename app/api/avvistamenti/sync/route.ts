// app/api/avvistamenti/sync/route.ts
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/app/lib/mongoose";
import { AvvistamentoModel, CervoModel, CamoscioModel } from "@/app/models/avvistamenti";

const MODELLI_PER_SPECIE: Record<string, typeof CervoModel | typeof CamoscioModel> = {
  cervo: CervoModel,
  camoscio: CamoscioModel,
};

interface SyncResult {
  clientId: string;
  status: "ok" | "error";
  id?: string;
  error?: string;
  retryable?: boolean;
}

/**
 * REST: POST /api/avvistamenti/sync
 * Riceve il batch di avvistamenti accumulati offline (outbox pattern) e li
 * persiste in modo idempotente tramite clientId. Risponde con un esito
 * per-record così il client può svuotare selettivamente l'outbox locale.
 *
 * Body atteso: { avvistamenti: Array<{ clientId: string, specie: "cervo"|"camoscio", ... }> }
 */
export async function POST(request: Request) {
  await connectDB();

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.avvistamenti)) {
    return NextResponse.json(
      { error: "Body non valido: atteso { avvistamenti: [...] }" },
      { status: 400 }
    );
  }

  const risultati: SyncResult[] = [];

  for (const item of body.avvistamenti as any[]) {
    const clientId = item?.clientId;

    if (!clientId || typeof clientId !== "string") {
      risultati.push({
        clientId: clientId ?? "<mancante>",
        status: "error",
        error: "clientId mancante o non valido: impossibile garantire idempotenza",
        retryable: false,
      });
      continue;
    }

    const Modello = MODELLI_PER_SPECIE[item.specie];
    if (!Modello) {
      risultati.push({
        clientId,
        status: "error",
        error: `specie "${item.specie}" sconosciuta`,
        retryable: false,
      });
      continue;
    }

    try {
      let record = await AvvistamentoModel.findOne({ clientId });

      if (record) {
        // record già sincronizzato in un tentativo precedente: aggiorna
        // (idempotente rispetto a payload identici, aggiorna se il client
        // ha modificato il record offline dopo un primo tentativo fallito)
        const { _id, specie, clientId: _cid, ...campiAggiornabili } = item;
        record.set(campiAggiornabili);
      } else {
        record = new Modello(item);
      }

      const salvato = await record.save();
      risultati.push({ clientId, status: "ok", id: salvato._id.toString() });
    } catch (error: any) {
      const permanente =
        error instanceof mongoose.Error.ValidationError ||
        error instanceof mongoose.Error.CastError;

      risultati.push({
        clientId,
        status: "error",
        error: error.message,
        retryable: !permanente,
      });
    }
  }

  const sincronizzatiConSuccesso = risultati.filter((r) => r.status === "ok").length;

  return NextResponse.json(
    {
      totale: risultati.length,
      sincronizzati: sincronizzatiConSuccesso,
      falliti: risultati.length - sincronizzatiConSuccesso,
      risultati,
    },
    { status: 207 } // Multi-Status: coerente con l'esito misto per-item
  );
}