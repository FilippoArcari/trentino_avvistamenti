import type * as Leaflet from "leaflet";
import type { FeatureCollection, Geometry, Point } from "geojson";

type ProprietaMappa = { kind: string; name?: string; rank?: number };
type Cartografia = FeatureCollection<Geometry, ProprietaMappa>;

export const LIMITI_TRENTINO: Leaflet.LatLngBoundsLiteral = [
  [45.67286, 10.4522],
  [46.53304, 11.96281],
];

let cartografia: Promise<Cartografia> | undefined;

function caricaCartografia() {
  cartografia ??= fetch("/maps/trentino.geojson")
    .then((response) => {
      if (!response.ok) throw new Error("Cartografia locale non disponibile");
      return response.json() as Promise<Cartografia>;
    })
    .catch((error: unknown) => {
      cartografia = undefined;
      throw error;
    });
  return cartografia;
}

const STILI: Record<string, Leaflet.PathOptions> = {
  boundary: { color: "#5d7651", weight: 2, fillColor: "#e6eddb", fillOpacity: 1 },
  lake: { color: "#5999b2", weight: 1, fillColor: "#a9d6e5", fillOpacity: 1 },
  river: { color: "#70aeca", weight: 2 },
  stream: { color: "#a0cbd9", weight: 1 },
  motorway: { color: "#ce7952", weight: 3.5 },
  road: { color: "#d4a561", weight: 2.5 },
  minor: { color: "#a49b84", weight: 1.5 },
  track: { color: "#a79d80", weight: 1, dashArray: "4 3" },
  trail: { color: "#b2a991", weight: 1, dashArray: "2 4" },
};

// Le foto aeree e il GeoJSON sono inclusi nell'app per tutto il Trentino:
// non dipendono dalle zone già visitate. Esri aggiunge il dettaglio online.
export function aggiungiSfondoTrentino(L: typeof Leaflet, map: Leaflet.Map) {
  let attivo = true;
  let cartografiaPronta = false;
  let punti: Cartografia["features"] = [];
  const locale = L.layerGroup();
  const etichette = L.layerGroup().addTo(locale);
  // I mosaici da 1024 px coprono quattro tessere standard per lato.
  // Lo zoom URL è quindi due livelli sotto quello della mappa Leaflet.
  const fotoOffline = L.tileLayer("/maps/satellite/{z}/{x}/{y}.webp", {
    tileSize: 1024,
    zoomOffset: -2,
    detectRetina: false,
    minNativeZoom: 8,
    maxNativeZoom: 14,
    maxZoom: 19,
    noWrap: true,
    bounds: LIMITI_TRENTINO,
    errorTileUrl: "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
    attribution: '<a href="https://www.provincia.tn.it/News/Approfondimenti/Ortofoto-digitale-2015">Ortofoto 2015 · Servizio Geologico – PAT</a> · <a href="/maps/README.md">CC BY 3.0 IT</a>',
  });
  const satellite = L.layerGroup([
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        maxZoom: 19,
        bounds: LIMITI_TRENTINO,
      },
    ),
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, bounds: LIMITI_TRENTINO, opacity: 0.8 },
    ),
  ]);

  map.setMaxBounds(L.latLngBounds(LIMITI_TRENTINO).pad(0.04));
  map.setMinZoom(8);
  map.setMaxZoom(19);
  map.getContainer().style.backgroundColor = "#17251c";

  const stato = document.createElement("div");
  stato.className = "leaflet-bar bg-base-100 text-base-content px-3 py-2 text-xs max-w-[210px]";
  stato.setAttribute("role", "status");
  stato.textContent = "Caricamento mappa del Trentino…";
  const StatoMappa = L.Control.extend({ onAdd: () => stato });
  const indicatore = new StatoMappa({ position: "bottomleft" }).addTo(map);
  L.DomEvent.disableClickPropagation(stato);

  const selettore = L.control.layers({
    "Satellite (offline)": fotoOffline,
    "Satellite HD (online)": satellite,
    "Cartografica": locale,
  }).addTo(map);
  const scala = L.control.scale({ imperial: false }).addTo(map);
  (navigator.onLine ? satellite : fotoOffline).addTo(map);

  function aggiornaStato() {
    if (map.hasLayer(fotoOffline)) {
      stato.textContent = "Satellite offline · foto 2015";
      return;
    }
    if (!cartografiaPronta && !map.hasLayer(satellite)) {
      stato.textContent = "Caricamento mappa del Trentino…";
      return;
    }
    stato.textContent = map.hasLayer(satellite)
      ? "Satellite HD · online"
      : "Cartografia offline del Trentino";
  }

  function mostraFotoOffline() {
    if (!attivo) return;
    map.removeLayer(satellite);
    if (!map.hasLayer(fotoOffline)) fotoOffline.addTo(map);
    aggiornaStato();
  }

  function allaDisconnessione() {
    if (map.hasLayer(satellite)) mostraFotoOffline();
  }

  function aggiornaEtichette() {
    if (!attivo) return;
    etichette.clearLayers();
    const zoom = map.getZoom();
    const bounds = map.getBounds().pad(0.15);
    for (const feature of punti) {
      if ((feature.properties.rank ?? 14) > zoom) continue;
      const [lng, lat] = (feature.geometry as Point).coordinates;
      if (!bounds.contains([lat, lng])) continue;
      const label = document.createElement("span");
      label.textContent = feature.properties.name ?? "";
      L.circleMarker([lat, lng], {
        radius: feature.properties.kind === "place" ? 3 : 2,
        color: "#5b6553",
        fillColor: "#ffffff",
        fillOpacity: 1,
        weight: 1,
        interactive: false,
      }).bindTooltip(label, { permanent: true, direction: "right" }).addTo(etichette);
    }
  }

  satellite.eachLayer((layer) => layer.on("tileerror", allaDisconnessione));
  window.addEventListener("offline", allaDisconnessione);
  map.on("baselayerchange", aggiornaStato);
  map.on("moveend", aggiornaEtichette);
  aggiornaStato();

  caricaCartografia().then((data) => {
    if (!attivo) return;
    punti = data.features.filter((feature) => feature.geometry.type === "Point");
    const geometrie: Cartografia = { ...data, features: data.features.filter((feature) => feature.geometry.type !== "Point") };
    L.geoJSON(geometrie, {
      style: (feature) => STILI[feature?.properties.kind] ?? {},
      interactive: false,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="/maps/README.md">Dati e licenza</a>',
    }).addTo(locale);
    cartografiaPronta = true;
    aggiornaEtichette();
    aggiornaStato();
  }).catch(() => {
    if (attivo && map.hasLayer(locale)) {
      stato.textContent = "Cartografia non disponibile. Riconnettiti per scaricarla.";
    }
  });

  return () => {
    attivo = false;
    window.removeEventListener("offline", allaDisconnessione);
    map.off("baselayerchange", aggiornaStato);
    map.off("moveend", aggiornaEtichette);
    satellite.eachLayer((layer) => layer.off("tileerror", allaDisconnessione));
    selettore.remove();
    scala.remove();
    indicatore.remove();
    satellite.remove();
    fotoOffline.remove();
    locale.remove();
  };
}
