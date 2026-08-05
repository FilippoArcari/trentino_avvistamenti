// app/hooks/useThemeColor.ts
"use client";

import { useEffect, useState } from "react";

/**
 * Legge il colore CSS effettivamente calcolato dal browser per una classe
 * Tailwind/DaisyUI (es. "text-base-content"). Necessario per librerie
 * canvas-based (Chart.js, Leaflet) che non possono consumare className e
 * vogliono stringhe colore concrete — queste vanno tenute in sync col
 * tema DaisyUI attivo (attributo data-theme), non scritte una volta sola.
 */
function readComputedColor(
  className: string,
  prop: "color" | "backgroundColor"
): string {
  const probe = document.createElement("div");
  probe.className = className;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  document.body.appendChild(probe);
  const value = getComputedStyle(probe)[prop];
  document.body.removeChild(probe);
  return value;
}

export interface ThemeColors {
  baseContent: string;
  baseContentMuted: string;
  base100: string;
  base200: string;
  base300: string;
  primary: string;
}

// Fallback usati solo prima del primo effect (SSR / primo paint)
const FALLBACK: ThemeColors = {
  baseContent: "#c9d5e0",
  baseContentMuted: "#8b9ab3",
  base100: "#0d1117",
  base200: "#161b22",
  base300: "#1a2332",
  primary: "#4a7c59",
};

export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(FALLBACK);

  useEffect(() => {
    function recompute() {
      setColors({
        baseContent: readComputedColor("text-base-content", "color"),
        baseContentMuted: readComputedColor("text-base-content/60", "color"),
        base100: readComputedColor("bg-base-100", "backgroundColor"),
        base200: readComputedColor("bg-base-200", "backgroundColor"),
        base300: readComputedColor("bg-base-300", "backgroundColor"),
        primary: readComputedColor("text-primary", "color"),
      });
    }

    recompute();

    // Ricalcola se il tema cambia a runtime (data-theme su <html>)
    const observer = new MutationObserver(recompute);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  return colors;
}