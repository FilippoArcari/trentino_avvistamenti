// app/api/avvistamenti/sync/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongoose";
// Importa l'unico modello e punta al percorso aggiornato
import { AvvistamentoModel } from "@/app/models/avvistamenti";

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

    try {
      let record = await AvvistamentoModel.findOne({ clientId });

      if (record) {
        // Record già presente: escludiamo i campi immutabili ed eseguiamo l'update
        const { _id, clientId: _cid, ...campiAggiornabili } = item;
        record.set(campiAggiornabili);
      } else {
        // Nessuna logica di discriminazione necessaria.
        // Se item.specie non è in specieAmmesse, Mongoose lancerà un ValidationError.
        record = new AvvistamentoModel(item);
      }

      const salvato = await record.save();
      risultati.push({ clientId, status: "ok", id: salvato._id.toString() });
      
    } catch (error: any) {
      // Isoliamo gli errori di dominio (es. Enum violation) per contrassegnarli come NON retryable,
      // altrimenti il client continuerebbe a fare ping all'infinito per un record strutturalmente malformato.

      risultati.push({
        clientId,
        status: "error",
        error: error.message
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