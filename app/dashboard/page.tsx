// app/dashboard/page.tsx
import type { Metadata } from "next";
import { DashboardClient } from "@/app/components/DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard Avvistamenti | Trentino Fauna",
  description:
    "Visualizza sulla mappa e nei grafici tutti gli avvistamenti registrati in Trentino.",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
