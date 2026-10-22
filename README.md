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

La mappa **Trentino (offline)** è inclusa nell'app e funziona anche su aree mai visualizzate prima. La cartografia occupa circa 17 MB sul dispositivo (circa 4,7 MB con compressione durante il download). La vista satellitare richiede la connessione; in assenza di rete o se il servizio satellitare non risponde si passa alla cartografia locale. Fonte, dettaglio e licenza sono descritti in [public/maps/README.md](public/maps/README.md).

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

Se Playwright o Chrome sono installati fuori dal progetto, usare `PLAYWRIGHT_MODULE=/percorso/node_modules/playwright` e `CHROME_PATH=/percorso/chrome`. `TEST_BASE_URL` cambia l'indirizzo di test (predefinito `http://localhost:3000`). Il test intercetta le API del browser: non scrive sul database reale. Verifica cartografia locale, registrazione e riapertura offline, riconnessione dalla dashboard, retry, correzioni e conferme tardive.
