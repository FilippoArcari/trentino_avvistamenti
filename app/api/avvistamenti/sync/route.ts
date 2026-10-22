// app/api/avvistamenti/sync/route.ts
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/app/lib/mongoose";
import {
  AvvistamentoModel,
  ensureAvvistamentoSyncIndex,
} from "@/app/models/avvistamenti";

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
 * persiste in modo idempotente tramite clientId.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (
    !body ||
    typeof body !== "object" ||
    !("avvistamenti" in body) ||
    !Array.isArray(body.avvistamenti)
  ) {
    return NextResponse.json(
      { error: "Body non valido: atteso { avvistamenti: [...] }" },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    await ensureAvvistamentoSyncIndex();
  } catch (error: unknown) {
    console.error("[POST /api/avvistamenti/sync] Database non disponibile:", error);
    return NextResponse.json(
      { error: "Database non disponibile. Gli avvistamenti saranno ritentati.", retryable: true },
      { status: 503 }
    );
  }

  const risultati: SyncResult[] = [];

  for (const item of body.avvistamenti as unknown[]) {
    const dati = item && typeof item === "object"
      ? item as Record<string, unknown>
      : {};
    const clientId = dati.clientId;

    if (typeof clientId !== "string" || !clientId.trim()) {
      risultati.push({
        clientId: typeof clientId === "string" ? clientId : "<mancante>",
        status: "error",
        error: "clientId mancante o non valido: impossibile garantire idempotenza",
        retryable: false,
      });
      continue;
    }

    const clientRevision = dati.clientRevision === undefined ? 0 : dati.clientRevision;
    if (
      typeof clientRevision !== "number" ||
      !Number.isSafeInteger(clientRevision) || clientRevision < 0
    ) {
      risultati.push({
        clientId,
        status: "error",
        error: "clientRevision deve essere un intero non negativo",
        retryable: false,
      });
      continue;
    }

    try {
      const campiAggiornabili = {
        clientRevision,
        specie: dati.specie,
        tipologia: dati.tipologia,
        sesso: dati.sesso,
        posizione: dati.posizione,
        timestamp: dati.timestamp,
      };

      // La validazione completa verifica anche i required, che i soli
      // validatori degli update non controllano quando manca un campo.
      await new AvvistamentoModel({ clientId, ...campiAggiornabili }).validate();

      const filtro = {
        clientId,
        $or: [
          { clientRevision: { $lt: clientRevision } },
          // Una revisione storica assente equivale a 0: un invio legacy
          // senza revisione non deve riscrivere documenti già presenti.
          ...(clientRevision > 0 ? [{ clientRevision: { $exists: false } }] : []),
        ],
      };
      let salvato;
      try {
        salvato = await AvvistamentoModel.findOneAndUpdate(
          filtro,
          { $set: campiAggiornabili },
          { upsert: true, returnDocument: "after", runValidators: true }
        );
      } catch (error: unknown) {
        if (
          !error || typeof error !== "object" ||
          !("code" in error) || error.code !== 11000
        ) {
          throw error;
        }
        // Un'altra richiesta ha già inserito lo stesso clientId, oppure una
        // revisione uguale o più recente esclude il documento dall'upsert.
        salvato = await AvvistamentoModel.findOneAndUpdate(
          filtro,
          { $set: campiAggiornabili },
          { returnDocument: "after", runValidators: true }
        );
        // Confermiamo retry già applicati e invii vecchi senza riscrivere il
        // documento, che può essere stato corretto nel frattempo da dashboard.
        if (!salvato) salvato = await AvvistamentoModel.findOne({ clientId });
      }

      if (!salvato) throw new Error("Avvistamento non disponibile dopo la sincronizzazione");
      risultati.push({ clientId, status: "ok", id: salvato._id.toString() });

    } catch (error: unknown) {
      // Isoliamo gli errori di dominio (es. Enum violation, campo required mancante) per
      // contrassegnarli come NON retryable: sono strutturalmente malformati e ritentare
      // non li risolverebbe mai. Tutto il resto (es. timeout di connessione al DB,
      // errori di rete) è considerato transitorio e quindi retryable.
      const erroreDiValidazione =
        error instanceof mongoose.Error.ValidationError ||
        error instanceof mongoose.Error.CastError;

      risultati.push({
        clientId,
        status: "error",
        error: erroreDiValidazione
          ? (error as Error).message
          : "Sincronizzazione temporaneamente non disponibile. Riprova più tardi.",
        retryable: !erroreDiValidazione,
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
    { status: 207 }
  );
}
