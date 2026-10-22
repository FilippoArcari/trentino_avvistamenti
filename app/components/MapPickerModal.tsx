// app/components/MapPickerModal.tsx
"use client";

import { useEffect, useState } from "react";
import { MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import type { LatLngLiteral } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { aggiungiSfondoTrentino } from "@/app/lib/trentino-map";

const iconaPosizione = L.divIcon({
  className: "",
  html: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 1C7.7 1 1 7.7 1 16c0 11 15 23 15 23s15-12 15-23C31 7.7 24.3 1 16 1Z" fill="#2563eb" stroke="white" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="white"/></svg>',
  iconSize: [32, 40],
  iconAnchor: [16, 40],
});

const CENTRO_TRENTO: LatLngLiteral = { lat: 46.0679, lng: 11.1211 };

function SfondoTrentino() {
  const map = useMap();
  useEffect(() => aggiungiSfondoTrentino(L, map), [map]);
  return null;
}

function ClickHandler({ onPick }: { onPick: (p: LatLngLiteral) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng);
    },
  });
  return null;
}

export function MapPickerModal({
  posizioneIniziale,
  onConferma,
  onAnnulla,
}: {
  posizioneIniziale: LatLngLiteral | null;
  onConferma: (p: LatLngLiteral) => void;
  onAnnulla: () => void;
}) {
  const [scelta, setScelta] = useState<LatLngLiteral | null>(posizioneIniziale);
  const [latManuale, setLatManuale] = useState(scelta?.lat?.toString() ?? "");
  const [lngManuale, setLngManuale] = useState(scelta?.lng?.toString() ?? "");

  function parseCoordinateManuali(): LatLngLiteral | null {
    const lat = parseFloat(latManuale.replace(",", "."));
    const lng = parseFloat(lngManuale.replace(",", "."));
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
    return null;
  }

  function applicaCoordinateNumeriche() {
    const parsed = parseCoordinateManuali();
    if (parsed) setScelta(parsed);
  }

  const sceltaValida = scelta ?? parseCoordinateManuali();

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm p-2 sm:p-4">
      <div className="h-full w-full sm:max-w-4xl sm:mx-auto sm:h-[92vh] sm:rounded-2xl overflow-hidden border border-base-300 bg-base-100 shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-base-300 bg-base-200/90">
          <h2 className="text-sm sm:text-base font-semibold text-base-content leading-5">
            Tocca la mappa oppure inserisci le coordinate
          </h2>
          <button
            type="button"
            onClick={onAnnulla}
            className="text-base-content/70 text-sm whitespace-nowrap"
          >
            Annulla
          </button>
        </div>

        <div className="flex-1 min-h-[280px]">
          <MapContainer
            center={scelta ?? CENTRO_TRENTO}
            zoom={13}
            scrollWheelZoom
            preferCanvas
            maxBoundsViscosity={1}
            className="h-full w-full map-picker-theme"
          >
            <SfondoTrentino />
            <ClickHandler
              onPick={(p) => {
                setScelta(p);
                setLatManuale(p.lat.toFixed(5));
                setLngManuale(p.lng.toFixed(5));
              }}
            />
            {scelta && (
              <Marker
                position={scelta}
                icon={iconaPosizione}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const m = e.target as L.Marker;
                    const p = m.getLatLng();
                    setScelta(p);
                    setLatManuale(p.lat.toFixed(5));
                    setLngManuale(p.lng.toFixed(5));
                  },
                }}
              />
            )}
          </MapContainer>
        </div>

        <div className="px-4 py-3 border-t border-base-300 bg-base-200/90 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            inputMode="decimal"
            placeholder="Lat (es. 46.0679)"
            value={latManuale}
            onChange={(e) => setLatManuale(e.target.value)}
            onBlur={applicaCoordinateNumeriche}
            className="w-full rounded-lg bg-base-100 border border-base-300 px-3 py-2 text-sm text-base-content"
          />
          <input
            inputMode="decimal"
            placeholder="Lng (es. 11.1211)"
            value={lngManuale}
            onChange={(e) => setLngManuale(e.target.value)}
            onBlur={applicaCoordinateNumeriche}
            className="w-full rounded-lg bg-base-100 border border-base-300 px-3 py-2 text-sm text-base-content"
          />
        </div>

        <div className="p-4 border-t border-base-300 bg-base-200/90 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onAnnulla}
            className="w-full rounded-xl border border-base-300 py-3 text-sm text-base-content/70"
          >
            Annulla
          </button>
          <button
            type="button"
            disabled={!sceltaValida}
            onClick={() => {
              const posizioneFinale = scelta ?? parseCoordinateManuali();
              if (!posizioneFinale) return;
              setScelta(posizioneFinale);
              onConferma(posizioneFinale);
            }}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-content disabled:opacity-50"
          >
            Conferma posizione
          </button>
        </div>
      </div>
    </div>
  );
}
