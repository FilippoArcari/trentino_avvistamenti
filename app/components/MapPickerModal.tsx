// app/components/MapPickerModal.tsx
"use client";

import { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import type { LatLngLiteral } from "leaflet";
import L from "leaflet";

// Workaround necessario: Leaflet risolve i path delle icone di default
// in modo relativo al proprio pacchetto, cosa che i bundler di Next.js
// (webpack/turbopack) non gestiscono senza questo fix esplicito.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const CENTRO_TRENTO: LatLngLiteral = { lat: 46.0679, lng: 11.1211 };

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
            className="h-full w-full map-picker-theme"
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
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