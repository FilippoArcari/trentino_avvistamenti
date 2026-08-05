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
import { coloreSpecie, etichettaSpecie } from "@/app/utils/speciesColor";
import { useThemeColors } from "@/app/hooks/useThemeColor";

ChartJS.register(ArcElement, Tooltip, Legend);

export function GraficoSpecie({
  avvistamenti,
}: {
  avvistamenti: Avvistamento[];
}) {
  const theme = useThemeColors();

  const { labels, values, bgColors, borderColors } = useMemo(() => {
    const conteggio: Record<string, number> = {};
    for (const a of avvistamenti) {
      const codice = a.specie.trim().toLowerCase();   // normalizza qui
      conteggio[codice] = (conteggio[codice] ?? 0) + 1;
    }

    const species = Object.keys(conteggio).sort();     // ora garantito univoco

    return {
      species,                                          // <- porta fuori anche i codici
      labels: species.map(etichettaSpecie),
      values: species.map((s) => conteggio[s]),
      bgColors: species.map((s) => coloreSpecie(s).bg),
      borderColors: species.map((s) => coloreSpecie(s).border),
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
          color: theme.baseContent,
          font: { size: 13, family: "system-ui, sans-serif" },
          padding: 18,
          usePointStyle: true,
          pointStyleWidth: 10,
        },
      },
      tooltip: {
        backgroundColor: theme.base300,
        borderColor: `${theme.baseContent}15`,
        borderWidth: 1,
        titleColor: theme.baseContent,
        bodyColor: theme.baseContentMuted,
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
      <div className="flex-1 flex items-center justify-center text-base-content/60 text-sm">
        Nessun dato disponibile
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="flex-1 relative">
        <Pie data={data} options={options} />
      </div>

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
              <span className="text-sm text-base-content font-medium">{label}</span>
            </div>
            <span className="text-sm font-bold text-base-content">{values[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}