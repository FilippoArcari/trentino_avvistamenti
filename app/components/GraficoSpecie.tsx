// app/components/GraficoSpecie.tsx
"use client";

import { useMemo } from "react";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import type { Avvistamento } from "@/app/components/DashboardClient";

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORI_SPECIE: Record<string, { bg: string; border: string }> = {
  cervo: { bg: "rgba(106,176,122,0.8)", border: "rgba(106,176,122,1)" },
  camoscio: { bg: "rgba(122,175,192,0.8)", border: "rgba(122,175,192,1)" },
  capriolo: { bg: "rgba(192,160,100,0.8)", border: "rgba(192,160,100,1)" },
};

const LABEL_SPECIE: Record<string, string> = {
  cervo: "Cervo",
  camoscio: "Camoscio",
};

export function GraficoSpecie({
  avvistamenti,
}: {
  avvistamenti: Avvistamento[];
}) {
  const { labels, values, bgColors, borderColors } = useMemo(() => {
    const conteggio: Record<string, number> = {};
    for (const a of avvistamenti) {
      conteggio[a.specie] = (conteggio[a.specie] ?? 0) + 1;
    }

    const species = Object.keys(conteggio);
    return {
      labels: species.map((s) => LABEL_SPECIE[s] ?? s),
      values: species.map((s) => conteggio[s]),
      bgColors: species.map((s) => COLORI_SPECIE[s]?.bg ?? "rgba(255,255,255,0.3)"),
      borderColors: species.map(
        (s) => COLORI_SPECIE[s]?.border ?? "rgba(255,255,255,0.6)"
      ),
    };
  }, [avvistamenti]);

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 2,
        hoverOffset: 12,
      },
    ],
  };

  const options: ChartOptions<"pie"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: "#c9d5e0",
          font: { size: 13, family: "system-ui, sans-serif" },
          padding: 18,
          usePointStyle: true,
          pointStyleWidth: 10,
        },
      },
      tooltip: {
        backgroundColor: "#1a2332",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        titleColor: "#ffffff",
        bodyColor: "#8b9ab3",
        padding: 12,
        callbacks: {
          label: (ctx) => {
            const total = (ctx.dataset.data as number[]).reduce(
              (a, b) => a + b,
              0
            );
            const val = ctx.parsed as number;
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0";
            return `  ${ctx.label}: ${val} (${pct}%)`;
          },
        },
      },
    },
  };

  if (avvistamenti.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#8b9ab3] text-sm">
        Nessun dato disponibile
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Grafico */}
      <div className="flex-1 relative">
        <Pie data={data} options={options} />
      </div>

      {/* Legenda testuale con conteggi */}
      <div className="grid grid-cols-1 gap-2">
        {labels.map((label, i) => (
          <div
            key={label}
            className="flex items-center justify-between px-3 py-2 rounded-xl"
            style={{ background: `${borderColors[i]}15` }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: borderColors[i] }}
              />
              <span className="text-sm text-[#c9d5e0] font-medium">{label}</span>
            </div>
            <span className="text-sm font-bold text-white">{values[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
