// app/page.tsx
import type { Metadata } from "next";
import { Navbar } from "@/app/components/Navbar";
import { AvvistamentoForm } from "@/app/components/AvvistamentoForm";
import {
  specieAmmesse,
  tipologieAmmesse,
  sessoAmmesso,
} from "@/app/utils/constant";

export const metadata: Metadata = {
  title: "Registra Avvistamento | Trentino Fauna",
  description:
    "Registra un nuovo avvistamento faunistico in Trentino: specie, tipologia, sesso e posizione GPS.",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-base-200 text-base-content flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 py-10">
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="mb-6 space-y-1">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-base-content">
              Registra avvistamento
            </h1>
            <p className="text-base-content/70 text-base">
              Compila il modulo per salvare un nuovo avvistamento.
            </p>
          </div>

          {/* Card contenitore del form */}
          <div className="card bg-base-100 shadow-xl border border-base-300">
            <div className="card-body p-6 sm:p-8">
              <AvvistamentoForm
                specieAmmesse={specieAmmesse}
                tipologieAmmesse={tipologieAmmesse}
                sessoAmmesso={sessoAmmesso}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}