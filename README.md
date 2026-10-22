# Trentino Fauna

Applicazione Next.js per registrare avvistamenti faunistici in Trentino.

## Avvio

```sh
npm install
npm run dev
```

Impostare `MONGODB_URI` in `.env.local`. I dati del database non sono necessari per compilare il modulo o salvare gli avvistamenti sul dispositivo.

## Utilizzo offline

Aprire l'app almeno una volta online e attendere che venga caricata: il service worker salva le pagine, gli asset e la cartografia del Trentino. In produzione usare HTTPS (su localhost è consentito HTTP). Il service worker è disabilitato con `npm run dev`; per provare la modalità offline:

```sh
npm run build
npm start
```

Gli avvistamenti vengono prima salvati in IndexedDB. Senza connessione non vengono inviati; l'invio riparte automaticamente quando l'app torna online, quando viene riaperta o torna in primo piano. Con l'app aperta un controllo ogni 30 secondi ritenta anche gli errori temporanei del server. A browser chiuso l'invio riprende alla successiva apertura.

La pagina **Coda Offline** mostra tutti i record non ancora confermati dal server, inclusi quelli da correggere. Un errore non cancella i dati locali. Ogni avvistamento ha un identificativo stabile e una revisione, così i retry non creano duplicati e una richiesta vecchia non sovrascrive una modifica più recente.

La mappa usa uno sfondo fotografico anche offline, su tutto il Trentino e anche nelle zone mai visualizzate prima. **Satellite (offline)** usa le ortofoto ufficiali PAT 2015 incluse nell'app (circa 47 MB), ricampionate a circa 6,6 metri per pixel per contenere il download; gli ingrandimenti oltre lo zoom 14 non aggiungono dettaglio. **Satellite HD (online)** offre il maggior dettaglio disponibile con la connessione; se manca rete o il servizio non risponde, si passa alle foto locali. La vista **Cartografica** precedente resta selezionabile. Fonte, dimensioni e licenze sono descritti in [public/maps/README.md](public/maps/README.md).

## Verifiche

```sh
npm test
npx tsc --noEmit
```

Il test server usa la validazione Mongoose reale e simula il database: controlla idempotenza, aggiornamenti fuori ordine, compatibilità con dati storici ed errori temporanei senza modificare un database esterno.

Per il test completo nel browser, avviare la versione produzione e rendere disponibile Playwright con Chromium. Poi:

```sh
npm run test:offline
```

Se Playwright o Chrome sono installati fuori dal progetto, usare `PLAYWRIGHT_MODULE=/percorso/node_modules/playwright` e `CHROME_PATH=/percorso/chrome`. `TEST_BASE_URL` cambia l'indirizzo di test (predefinito `http://localhost:3000`). Il test intercetta le API del browser: non scrive sul database reale. Verifica che tutte le immagini del Trentino siano in cache, lo sfondo fotografico offline, registrazione e riapertura offline, riconnessione dalla dashboard, retry, correzioni e conferme tardive.
