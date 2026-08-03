// app/components/MappaAvvistamenti.tsx
"use client";

import { useEffect, useRef } from "react";
import type { Avvistamento } from "@/app/components/DashboardClient";

// Importiamo leaflet solo lato client
import "leaflet/dist/leaflet.css";
import type * as LeafletType from "leaflet";

// Colori per specie
const COLORI: Record<string, string> = {
  cervo: "#6ab07a",
  camoscio: "#7aafc0",
  capriolo: "#c0a064",
};

const LABEL_SPECIE: Record<string, string> = {
  cervo: "Cervo",
  camoscio: "Camoscio",
  capriolo: "Capriolo",
};

const LABEL_SESSO: Record<string, string> = {
  maschio: "♂ Maschio",
  femmina: "♀ Femmina",
  indeterminato: "? Indeterminato",
};

const LABEL_TIPOLOGIA: Record<string, string> = {
  palcuto: "Palcuto",
  sottile: "Sottile",
  fusone: "Fusone",
  femmina: "Femmina",
  piccolo: "Piccolo",
  yearling: "Yearling",
  adulto: "Adulto",
};

// Centro del Trentino
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

  // Inizializzazione mappa (una sola volta)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Importo leaflet a runtime (SSR-safe)
    import("leaflet").then((L) => {
      if (!containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: CENTRO_TRENTINO,
        zoom: 9,
        zoomControl: true,
        attributionControl: true,
      });

      // Satellite ESRI — gratuito, nessuna API key richiesta
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
          maxZoom: 19,
        }
      ).addTo(map);

      // Overlay etichette (strade, località) sopra il satellite
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

  // Aggiornamento marker quando cambiano gli avvistamenti
  useEffect(() => {
    if (!layerRef.current) return;
    import("leaflet").then((L) => {
      if (!layerRef.current) return;
      aggiornaMarker(L, layerRef.current, avvistamenti);

      // Adatta la vista ai marker se presenti
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
      style={{ width: "100%", height: "100%", background: "#1a2332" }}
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
    const colore = COLORI[a.specie] ?? "#ffffff";
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
      <div style="
        font-family: system-ui, sans-serif;
        background: #1a2332;
        color: #c9d5e0;
        border-radius: 12px;
        padding: 12px 14px;
        min-width: 160px;
        font-size: 13px;
        line-height: 1.6;
        border: 1px solid ${colore}33;
      ">
        <div style="font-weight: 700; font-size: 15px; color: ${colore}; margin-bottom: 6px;">
          ${LABEL_SPECIE[a.specie] ?? a.specie}
        </div>
        <div><span style="color:#8b9ab3">Tipologia:</span> ${LABEL_TIPOLOGIA[a.tipologia] ?? a.tipologia}</div>
        <div><span style="color:#8b9ab3">Sesso:</span> ${LABEL_SESSO[a.sesso] ?? a.sesso}</div>
        <div style="margin-top:6px; font-size:11px; color:#8b9ab3">${data}</div>
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
