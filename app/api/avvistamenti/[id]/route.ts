import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongoose";
import { AvvistamentoModel } from "@/app/models/avvistamenti";
import mongoose from "mongoose";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * REST: PUT /api/avvistamenti/[id]
 * Aggiorna la risorsa. Usa fetch->mutate->save invece di findByIdAndUpdate
 * per garantire: (a) risoluzione del discriminator corretto per il cast
 * dei campi specifici (tipologia), (b) esecuzione della pipeline completa
 * di validate, incluso il vincolo cross-field sesso/tipologia.
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    await connectDB();
    const { user, error } = await requireUser();
    if (error) return error;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }

    const body = await request.json();
    const { _id, specie, userId: _uid, createdAt, updatedAt, ...datiAggiornabili } = body;

    const record = await AvvistamentoModel.findOne(scopedFilter(user, { _id: id }));

    if (!record) {
      return NextResponse.json({ error: "Avvistamento non trovato" }, { status: 404 });
    }

    record.set(datiAggiornabili);
    const recordAggiornato = await record.save();

    return NextResponse.json(recordAggiornato, { status: 200 });
  } catch (error: any) {
    if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    await connectDB();
    const { user, error } = await requireUser();
    if (error) return error;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }

    const risultato = await AvvistamentoModel.findOneAndDelete(scopedFilter(user, { _id: id }));

    if (!risultato) {
      return NextResponse.json({ error: "Avvistamento non trovato" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    if (error instanceof mongoose.Error.CastError) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}