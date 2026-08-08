// app/api/avvistamenti/route.ts
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/app/lib/mongoose";
import { AvvistamentoModel } from "@/app/models/avvistamenti";
import { specieAmmesse } from "@/app/utils/constant";

export async function GET(request: Request) {
  try {
    await connectDB();
    const url = new URL(request.url);
    const querySpecie = url.searchParams.get("specie");

    const filter: Record<string, any> = {};

    if (querySpecie) {
      // Confronto case-insensitive per tollerare query string tipo ?specie=cervo
      const specieValida = specieAmmesse.find(
        (s) => s.toLowerCase() === querySpecie.toLowerCase()
      );

      if (!specieValida) {
        return NextResponse.json(
          {
            error: `Specie non valida. Specie ammesse: ${specieAmmesse.join(", ")}`,
          },
          { status: 400 }
        );
      }

      filter.specie = specieValida;
    }

    const avvistamenti = await AvvistamentoModel.find(filter)
      .sort({ timestamp: -1 })
      .lean();

    return NextResponse.json(avvistamenti, { status: 200 });
  } catch (error) {
    console.error("[GET /api/avvistamenti] Error:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Body della richiesta non valido o vuoto" },
        { status: 400 }
      );
    }

    // La validazione di enum per specie, tipologia e sesso viene delegata interamente a Mongoose
    const doc = await AvvistamentoModel.create(body);

    return NextResponse.json(doc, { status: 201 });
  } catch (error: any) {
    console.error("[POST /api/avvistamenti] Error:", error);

    // Se il payload viola gli enum dello schema Mongoose, restituisce 400 invece di 500
    if (
      error instanceof mongoose.Error.ValidationError ||
      error instanceof mongoose.Error.CastError
    ) {
      return NextResponse.json(
        { error: "Dati di avvistamento non validi", details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}