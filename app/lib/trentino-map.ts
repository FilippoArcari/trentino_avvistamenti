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

// Il GeoJSON è un estratto regionale incluso nell'app: non dipende dalle
// tessere già visitate. Le immagini satellitari restano un'opzione online.
export function aggiungiSfondoTrentino(L: typeof Leaflet, map: Leaflet.Map) {
  let attivo = true;
  let cartografiaPronta = false;
  let punti: Cartografia["features"] = [];
  const locale = L.layerGroup();
  const etichette = L.layerGroup().addTo(locale);
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
  map.getContainer().style.backgroundColor = "#eef1e8";

  const stato = document.createElement("div");
  stato.className = "leaflet-bar bg-base-100 text-base-content px-3 py-2 text-xs max-w-[210px]";
  stato.setAttribute("role", "status");
  stato.textContent = "Caricamento mappa del Trentino…";
  const StatoMappa = L.Control.extend({ onAdd: () => stato });
  const indicatore = new StatoMappa({ position: "bottomleft" }).addTo(map);
  L.DomEvent.disableClickPropagation(stato);

  const selettore = L.control.layers({
    "Trentino (offline)": locale,
    "Satellite (online)": satellite,
  }).addTo(map);
  const scala = L.control.scale({ imperial: false }).addTo(map);
  (navigator.onLine ? satellite : locale).addTo(map);

  function aggiornaStato() {
    if (!cartografiaPronta && !map.hasLayer(satellite)) {
      stato.textContent = "Caricamento mappa del Trentino…";
      return;
    }
    stato.textContent = map.hasLayer(satellite)
      ? "Satellite · connessione richiesta"
      : "Mappa offline del Trentino";
  }

  function mostraMappaLocale() {
    if (!attivo) return;
    map.removeLayer(satellite);
    if (!map.hasLayer(locale)) locale.addTo(map);
    aggiornaStato();
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

  satellite.eachLayer((layer) => layer.on("tileerror", mostraMappaLocale));
  window.addEventListener("offline", mostraMappaLocale);
  map.on("baselayerchange", aggiornaStato);
  map.on("moveend", aggiornaEtichette);

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
    if (attivo) stato.textContent = "Mappa locale non disponibile. Riconnettiti per scaricarla.";
  });

  return () => {
    attivo = false;
    window.removeEventListener("offline", mostraMappaLocale);
    map.off("baselayerchange", aggiornaStato);
    map.off("moveend", aggiornaEtichette);
    satellite.eachLayer((layer) => layer.off("tileerror", mostraMappaLocale));
    selettore.remove();
    scala.remove();
    indicatore.remove();
    satellite.remove();
    locale.remove();
  };
}
