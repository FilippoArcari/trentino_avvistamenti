"use client";

import { useEffect, useRef } from "react";
import type { Avvistamento } from "@/app/components/DashboardClient";
import { hslaSpecie, etichettaSpecie } from "@/app/utils/speciesColor";
import { sessoAmmesso } from "@/app/utils/constant";

import "leaflet/dist/leaflet.css";
import type * as LeafletType from "leaflet";

// Simboli cosmetici per il sesso: legittimo tenerli in una mappa qui
// perché sessoAmmesso è un dominio chiuso e canonico definito in
// constant.ts, non un'assunzione mia sul nome/numero dei valori.
// Se un valore non è tra quelli noti, mostro la stringa grezza.
const SIMBOLO_SESSO: Partial<Record<(typeof sessoAmmesso)[number], string>> = {
  Maschio: "♂",
  Femmina: "♀",
  Indeterminato: "?",
};

function etichettaSesso(sesso: string): string {
  const match = sessoAmmesso.find((s) => s.toLowerCase() === sesso.toLowerCase());
  if (!match) return sesso;
  const simbolo = SIMBOLO_SESSO[match];
  return simbolo ? `${simbolo} ${match}` : match;
}

// NB: nessuna mappa per la tipologia. `tipologieAmmesse` in constant.ts
// è attualmente identica a `sessoAmmesso` ("Maschio"/"Femmina"/
// "Indeterminato"), il che contraddice i valori di tipologia già in uso
// altrove nella codebase (palcuto, fusone, yearling, adulto, ...) — vedi
// nota nella risposta. Finché non è chiarito, mostro la tipologia così
// come arriva dal backend, senza inventare una traduzione che potrebbe
// essere sbagliata.
function etichettaTipologia(tipologia: string): string {
  return tipologia;
}

const CENTRO_TRENTINO: [number, number] = [46.07, 11.12];

function markerCircleSvg(colore: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="11" fill="${colore}" fill-opacity="0.25" stroke="${colore}" stroke-width="2.5"/>
    <circle cx="14" cy="14" r="5" fill="${colore}"/>
  </svg>`;
}

export function MappaAvvistamenti({
  avvistamenti,
}: {
  avvistamenti: Avvistamento[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletType.Map | null>(null);
  const layerRef = useRef<LeafletType.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      if (!containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: CENTRO_TRENTINO,
        zoom: 9,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
          maxZoom: 19,
        }
      ).addTo(map);

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, opacity: 0.8 }
      ).addTo(map);

      const layer = L.layerGroup().addTo(map);
      mapRef.current = map;
      layerRef.current = layer;

      aggiornaMarker(L, layer, avvistamenti);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!layerRef.current) return;
    import("leaflet").then((L) => {
      if (!layerRef.current) return;
      aggiornaMarker(L, layerRef.current, avvistamenti);

      if (avvistamenti.length > 0 && mapRef.current) {
        const bounds = L.latLngBounds(
          avvistamenti.map((a) => [a.posizione.lat, a.posizione.lng])
        );
        mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      }
    });
  }, [avvistamenti]);

  return (
    <div
      ref={containerRef}
      id="mappa-avvistamenti"
      className="w-full h-full bg-base-300"
    />
  );
}

function aggiornaMarker(
  L: typeof LeafletType,
  layer: LeafletType.LayerGroup,
  avvistamenti: Avvistamento[]
) {
  layer.clearLayers();

  avvistamenti.forEach((a) => {
    const colore = hslaSpecie(a.specie, 1);
    const icon = L.divIcon({
      html: markerCircleSvg(colore),
      className: "",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -16],
    });

    const data = new Date(a.timestamp).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const popup = `
      <div
        class="font-sans bg-base-300 text-base-content rounded-xl px-3.5 py-3 min-w-[160px] text-[13px] leading-relaxed border"
        style="border-color: ${hslaSpecie(a.specie, 0.2)}"
      >
        <div class="font-bold text-[15px] mb-1.5" style="color: ${colore}">
          ${etichettaSpecie(a.specie)}
        </div>
        <div><span class="text-base-content/60">Tipologia:</span> ${etichettaTipologia(a.tipologia)}</div>
        <div><span class="text-base-content/60">Sesso:</span> ${etichettaSesso(a.sesso)}</div>
        <div class="mt-1.5 text-[11px] text-base-content/60">${data}</div>
      </div>
    `;

    L.marker([a.posizione.lat, a.posizione.lng], { icon })
      .bindPopup(popup, {
        className: "leaflet-popup-dark",
        maxWidth: 220,
      })
      .addTo(layer);
  });
}