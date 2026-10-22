# Mappe offline del Trentino

## Foto aeree

`satellite/` contiene vere foto aeree del solo Trentino, incluse nell'app e
salvate dal service worker per poterle visualizzare senza connessione, anche
nelle zone della mappa mai visitate in precedenza.

Fonte: [Ortofoto Digitale 2015 della Provincia autonoma di Trento](https://www.provincia.tn.it/News/Approfondimenti/Ortofoto-digitale-2015),
Servizio Geologico – PAT. I voli risalgono al 2014–2016, con anno prevalente
2015. La risoluzione originale è 20 cm; il pacchetto dell'app è ritagliato al
confine provinciale e ridotto a circa 6,6 metri per pixel per contenerne il peso.
L'ingrandimento oltre lo zoom 14 amplia queste immagini senza aggiungere
nuovo dettaglio fotografico. Lo sfondo Esri online offre ulteriore dettaglio.

Le immagini sono riutilizzabili e redistribuibili con attribuzione secondo la
[licenza CC BY 3.0 Italia rilasciata dalla Provincia](https://siatservices.provincia.tn.it/idt/raster/ortofoto_2015_pat/licenza.pdf).
Attribuzione: **Ortofoto Digitale 2015 – Servizio Geologico, Provincia autonoma
di Trento; ritaglio e riduzione della risoluzione**.

Il servizio sorgente è il WMS ufficiale
`https://siat.provincia.tn.it/geoserver/stem/ecw-rgb-2015/wms`, layer
`ecw-rgb-2015`. La preparazione richiede 56 richieste GetMap da 2048×2048
pixel, con due richieste simultanee; i riquadri esterni alla provincia sono
trasparenti e vengono generati localmente. La piramide comprende 405 immagini
WebP da 1024×1024 pixel, con zoom URL 6–12, equivalenti allo zoom Leaflet 8–14
usando `tileSize: 1024` e `zoomOffset: -2`.

`satellite/manifest.json` elenca fonte, licenza, limiti, dimensione complessiva
e URL di tutti i riquadri inclusi. Per rigenerare il pacchetto, dalla cartella
del progetto, con Python 3 e Pillow:

```sh
python3 scripts/prepare-satellite.py --estimate
python3 scripts/prepare-satellite.py
```

Il generatore conserva temporaneamente i mosaici sorgente in
`/tmp/trentino-ortofoto-mosaics` per riprendere la preparazione senza ripetere
le richieste già riuscite. Non scarica preventivamente immagini Esri.

## Cartografia vettoriale

`trentino.geojson` contiene una selezione dei dati OpenStreetMap per la sola
Provincia autonoma di Trento (relazione OSM 45756). Il file è incluso nell'app
e viene salvato dal service worker insieme agli altri asset: non richiede
di visitare prima tutte le zone della mappa.

Fonte: [estratto Geofabrik Nord-Est del 20 ottobre 2026](https://download.geofabrik.de/europe/italy/nord-est-261020.osm.pbf).
© OpenStreetMap contributors. Dati distribuiti secondo la
[Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
Informazioni sui diritti e le fonti: https://www.openstreetmap.org/copyright.

Elaborazioni: selezione di confine provinciale, strade, piste, sentieri,
corsi d'acqua, laghi, località, cime e rifugi; ritaglio al confine reale
provinciale; semplificazione delle linee di circa 5–7 metri e coordinate
arrotondate a cinque decimali. Le geometrie provengono dai dati originali;
nessuna posizione o forma del territorio è stata ricostruita a mano.

La cartografia vettoriale è uno sfondo alternativo alle foto aeree locali:
permette di orientarsi e scegliere le coordinate anche senza rete e comprende
strade, sentieri, acque e nomi dei luoghi.

Il file GeoJSON pubblico costituisce anche la copia della banca dati derivata
disponibile ai sensi della ODbL. Per aggiornarlo, partire da un nuovo estratto
Geofabrik, selezionare il territorio della relazione 45756 e ripetere il
ritaglio e la semplificazione; aggiornare questa data e i metadati nel GeoJSON.
