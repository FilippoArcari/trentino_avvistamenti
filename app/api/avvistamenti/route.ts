import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongoose";

import { AvvistamentoModel, CervoModel, CamoscioModel, CaprioloModel } from "@/app/models/avvistamenti";

const MODELS_PER_SPECIE = { cervo: CervoModel, camoscio: CamoscioModel, capriolo: CaprioloModel } as const;

export async function GET(request: Request) {
  try {
    await connectDB();
    const url = new URL(request.url);
    const querySpecie = url.searchParams.get("specie");

    if (querySpecie && !(querySpecie in MODELS_PER_SPECIE)) {
      return NextResponse.json({ error: "specie non valida" }, { status: 400 });
    }

    const filter = querySpecie ? { specie: querySpecie } : {};
    const avvistamenti = await AvvistamentoModel.find(filter).lean();

    return NextResponse.json(avvistamenti, { status: 200 });
  } catch (error) {
    console.error("[GET /api/avvistamenti] Error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();

    if (!body.specie || !(body.specie in MODELS_PER_SPECIE)) {
      return NextResponse.json({ error: "campo 'specie' mancante o non valido" }, { status: 400 });
    }

    const Model = MODELS_PER_SPECIE[body.specie as keyof typeof MODELS_PER_SPECIE];
    const doc = await Model.create(body); // Mongoose valida `tipologia` contro l'enum del discriminator

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error("[POST /api/avvistamenti] Error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}