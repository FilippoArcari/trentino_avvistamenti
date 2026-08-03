// app/page.tsx
import type { Metadata } from "next";
import { Navbar } from "@/app/components/Navbar";
import { AvvistamentoForm } from "@/app/components/AvvistamentoForm";

export const metadata: Metadata = {
  title: "Registra Avvistamento | Trentino Fauna",
  description:
    "Registra un nuovo avvistamento faunistico in Trentino: specie, tipologia, sesso e posizione GPS.",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-sans flex flex-col">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 py-10">
        <div className="w-full max-w-lg">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
              Registra avvistamento
            </h1>
            <p className="text-[#8b9ab3] text-base">
              Compila il modulo per salvare un nuovo avvistamento.
            </p>
          </div>

          {/* Card contenitore del form */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 sm:p-8">
            <AvvistamentoForm />
          </div>
        </div>
      </main>
    </div>
  );
}
