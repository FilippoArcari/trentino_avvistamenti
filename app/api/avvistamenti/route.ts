// app/api/avvistamenti/route.ts
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/app/lib/mongoose";
import { AvvistamentoModel } from "@/app/models/avvistamenti";
import { specieAmmesse } from "@/app/utils/constant";
import { sessoAmmesso } from "@/app/utils/constant";

export async function GET(request: Request) {
  try {
    await connectDB();
    const url = new URL(request.url);
    const querySpecie = url.searchParams.get("specie");
    const querySesso = url.searchParams.get("sesso");
    const queryDataDa = url.searchParams.get("da");
    const queryDataA = url.searchParams.get("a");

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

    if (querySesso) {
      const sessoValido = sessoAmmesso.find(
        (s) => s.toLowerCase() === querySesso.toLowerCase()
      );

      if (!sessoValido) {
        return NextResponse.json(
          {
            error: `Sesso non valido. Valori ammessi: ${sessoAmmesso.join(", ")}`,
          },
          { status: 400 }
        );
      }

      filter.sesso = sessoValido;
    }

    // Intervallo date: "da" e "a" sono attesi in formato YYYY-MM-DD.
    // "da" viene ancorato a inizio giornata (00:00:00.000), "a" a fine giornata
    // (23:59:59.999) per includere l'intero giorno finale, non solo la mezzanotte.
    if (queryDataDa || queryDataA) {
      const timestampFilter: Record<string, Date> = {};

      if (queryDataDa) {
        const dataDa = new Date(`${queryDataDa}T00:00:00.000Z`);
        if (isNaN(dataDa.getTime())) {
          return NextResponse.json(
            { error: "Parametro 'da' non valido. Formato atteso: YYYY-MM-DD" },
            { status: 400 }
          );
        }
        timestampFilter.$gte = dataDa;
      }

      if (queryDataA) {
        const dataA = new Date(`${queryDataA}T23:59:59.999Z`);
        if (isNaN(dataA.getTime())) {
          return NextResponse.json(
            { error: "Parametro 'a' non valido. Formato atteso: YYYY-MM-DD" },
            { status: 400 }
          );
        }
        timestampFilter.$lte = dataA;
      }

      if (
        timestampFilter.$gte &&
        timestampFilter.$lte &&
        timestampFilter.$gte > timestampFilter.$lte
      ) {
        return NextResponse.json(
          { error: "L'intervallo date non è valido: 'da' è successivo ad 'a'" },
          { status: 400 }
        );
      }

      filter.timestamp = timestampFilter;
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