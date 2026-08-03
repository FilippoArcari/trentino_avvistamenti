import type { Metadata } from "next";
import { CodaClient } from "@/app/components/CodaClient";

export const metadata: Metadata = {
  title: "Coda Offline | Trentino Fauna",
  description: "Visualizza e modifica gli avvistamenti in attesa di sincronizzazione.",
};

export default function CodaPage() {
  return <CodaClient />;
}
