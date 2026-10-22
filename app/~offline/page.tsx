// app/~offline/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nessuna connessione | Trentino Fauna",
};

// Pagina di fallback: viene mostrata dal service worker (vedi la sezione
// `fallbacks` in app/sw.ts) quando una navigazione fallisce sia in rete
// sia in cache. Deve restare semplice e senza fetch di dati: viene
// precacheata al build/install e deve poter essere renderizzata sempre,
// anche a freddo e offline.
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-base-200 text-base-content px-4 text-center">
      <h1 className="text-2xl font-bold">Nessuna connessione</h1>
      <p className="text-base-content/70 max-w-sm">
        Questa pagina non è ancora stata salvata per l&apos;uso offline.
        Riconnettiti e visitala una volta: da quel momento resterà
        disponibile anche senza rete.
      </p>
    </div>
  );
}