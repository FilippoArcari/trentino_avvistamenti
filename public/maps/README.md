# Cartografia offline del Trentino

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

La cartografia locale permette di orientarsi e scegliere le coordinate anche
senza rete; non comprende immagini satellitari, curve di livello o indicazioni
di navigazione. Le immagini Esri sono disponibili come sfondo online e non
vengono scaricate in massa per l'uso offline.

Il file GeoJSON pubblico costituisce anche la copia della banca dati derivata
disponibile ai sensi della ODbL. Per aggiornarlo, partire da un nuovo estratto
Geofabrik, selezionare il territorio della relazione 45756 e ripetere il
ritaglio e la semplificazione; aggiornare questa data e i metadati nel GeoJSON.
