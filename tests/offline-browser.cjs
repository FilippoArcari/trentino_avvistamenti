// Eseguire contro `npm run build && npm start` con Playwright disponibile.
// PLAYWRIGHT_MODULE può indicare un'installazione esterna; CHROME_PATH il browser.
/* eslint-disable @typescript-eslint/no-require-imports -- Test Node con browser esterno, senza cambiare i moduli dell'app. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const baseURL = process.env.TEST_BASE_URL || "http://localhost:3000";

async function outbox(page, update) {
  return page.evaluate(async (update) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("avvistamenti-outbox", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tx = db.transaction("outbox", update ? "readwrite" : "readonly");
      const done = new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      const store = tx.objectStore("outbox");
      if (update) store.put(update);
      const result = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await done;
      return result;
    } finally {
      db.close();
    }
  }, update);
}

async function until(check, message) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(message);
}

test("salvataggio offline, mappa, persistenza, retry e sincronizzazione da dashboard", { timeout: 120_000 }, async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    geolocation: { latitude: 46.0679, longitude: 11.1211 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  let mode = "ok";
  let release;
  let richiesteHd = 0;
  const sent = [];
  await context.route("https://server.arcgisonline.com/**", (route) => {
    richiesteHd++;
    return route.abort("failed");
  });
  await context.route(/\/api\/avvistamenti(?:[/?]|$)/, async (route) => {
    if (!route.request().url().endsWith("/sync")) {
      return route.fulfill({ json: [] });
    }
    const records = route.request().postDataJSON().avvistamenti;
    sent.push(records);
    if (mode === "network") return route.abort("failed");
    if (mode === "delayed") await new Promise((resolve) => { release = resolve; });
    return route.fulfill({ status: 207, json: {
      risultati: records.map(({ clientId }) => ({
        clientId,
        status: mode === "retry" || mode === "invalid" ? "error" : "ok",
        ...(mode === "retry" ? { retryable: true, error: "Database temporaneamente non disponibile" } : {}),
        ...(mode === "invalid" ? { retryable: false, error: "Dati da correggere" } : {}),
      })),
    } });
  });
  try {
    await page.goto(baseURL);
    console.log("Pagina caricata, attendo service worker");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
      }
    });
    assert.equal(await page.evaluate(async () => Boolean(await caches.match("/maps/trentino.geojson", { ignoreSearch: true }))), true,
      "La cartografia di tutto il Trentino è disponibile prima di visitare la mappa");
    const satelliteInCache = await page.evaluate(async () => {
      const manifest = await fetch("/maps/satellite/manifest.json").then((response) => response.json());
      const mancanti = [];
      for (const tile of manifest.tiles) {
        const url = tile.startsWith("/") ? tile : `/maps/satellite/${tile}`;
        if (!await caches.match(url, { ignoreSearch: true })) mancanti.push(url);
      }
      return { totale: manifest.tiles.length, mancanti };
    });
    assert.ok(satelliteInCache.totale > 200, "Piramide fotografica di tutto il Trentino inclusa");
    assert.deepEqual(satelliteInCache.mancanti, [], "Tutte le foto sono salvate prima di visitare le zone");
    console.log("Service worker pronto, registro offline");
    await context.setOffline(true);
    await page.getByRole("button", { name: "Cervo", exact: true }).click();
    console.log("Specie scelta");
    await page.getByRole("button", { name: "Femmina", exact: true }).click();
    await page.getByRole("button", { name: "Adulto", exact: true }).click();
    await page.getByRole("button", { name: "Imposta manualmente" }).click();
    console.log("Picker mappa aperto");
    await page.getByText("Satellite offline · foto 2015", { exact: true }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll("img.leaflet-tile-loaded")].some((tile) =>
      tile.src.includes("/maps/satellite/") && tile.naturalWidth === 1024));
    assert.equal(await page.locator(".leaflet-tile-pane img[src*='server.arcgisonline.com']").count(), 0,
      "Offline viene usato lo sfondo fotografico locale");
    await page.locator(".leaflet-control-layers").hover();
    await page.getByRole("radio", { name: "Cartografica", exact: true }).check();
    await page.getByText("Cartografia offline del Trentino", { exact: true }).waitFor();
    await context.setOffline(false);
    await page.locator(".leaflet-control-layers").hover();
    await page.getByRole("radio", { name: "Satellite HD (online)", exact: true }).check();
    await until(() => richiesteHd > 0, "Richiesta della vista HD online");
    await page.getByText("Satellite offline · foto 2015", { exact: true }).waitFor();
    await context.setOffline(true);
    await page.getByPlaceholder("Lat (es. 46.0679)").fill("46.0679");
    await page.getByPlaceholder("Lng (es. 11.1211)").fill("11.1211");
    await page.getByPlaceholder("Lng (es. 11.1211)").blur();
    await page.getByRole("button", { name: "Conferma posizione" }).click();
    await page.getByRole("button", { name: "Salva avvistamento", exact: true }).click();
    await page.getByRole("heading", { name: "Avvistamento registrato" }).waitFor();
    console.log("Conferma visibile");
    assert.equal(sent.length, 0, "Nessun invio mentre il browser è offline");
    const [record] = await outbox(page);
    assert.equal(record.clientRevision, 1);
    assert.equal(record.syncStatus, "pending");
    console.log("Avvistamento salvato, verifico riapertura offline");
    await page.reload();
    await page.getByRole("heading", { name: "Registra avvistamento" }).waitFor();
    assert.equal((await outbox(page)).length, 1, "Il record sopravvive alla riapertura offline");
    await page.getByRole("link", { name: "Coda Offline", exact: true }).first().click();
    await page.getByRole("cell", { name: "In attesa", exact: true }).waitFor();
    await page.getByRole("link", { name: "Dashboard", exact: true }).first().click();
    await page.getByRole("heading", { name: "Dashboard Avvistamenti" }).waitFor();
    await page.getByText("Satellite offline · foto 2015", { exact: true }).waitFor();
    await page.evaluate(() => { window.testNoReload = true; });
    console.log("Dashboard offline pronta, verifico retry");
    mode = "retry";
    await context.setOffline(false);
    await until(async () => (await outbox(page))[0]?.syncStatus === "error", "Errore temporaneo conservato in coda");
    mode = "ok";
    await context.setOffline(true);
    await context.setOffline(false);
    await until(async () => (await outbox(page)).length === 0, "Retry automatico anche dalla dashboard");
    assert.equal(await page.evaluate(() => window.testNoReload), true, "Nessun reload al ritorno online");
    assert.equal(sent[0][0].clientId, sent[1][0].clientId, "Il retry riusa lo stesso clientId");

    console.log("Retry superato, verifico errori e correzione");
    // Un errore di rete non rimuove il dato; un errore permanente resta visibile.
    await context.setOffline(true);
    await outbox(page, record);
    mode = "network";
    await context.setOffline(false);
    await until(async () => sent.length >= 3, "Tentativo dopo riconnessione");
    await page.getByRole("link", { name: "Coda Offline", exact: true }).first().click();
    await page.getByText(/Sincronizzazione non riuscita/).waitFor();
    assert.equal((await outbox(page))[0].syncStatus, "pending");
    mode = "invalid";
    await context.setOffline(true);
    await context.setOffline(false);
    await until(async () => (await outbox(page))[0]?.syncRetryable === false, "Errore permanente visibile");
    await page.getByRole("link", { name: "Coda Offline", exact: true }).first().click();
    await page.getByRole("cell").filter({ hasText: "Da correggere" }).waitFor();
    mode = "ok";
    await page.getByRole("button", { name: "Modifica", exact: true }).click();
    await page.getByRole("button", { name: "Giovane", exact: true }).click();
    await page.getByRole("button", { name: "Salva Modifiche" }).click();
    await until(async () => (await outbox(page)).length === 0, "La correzione riabilita l'invio");
    assert.equal(sent.at(-1)[0].clientRevision, 2);

    console.log("Correzione superata, verifico conferma tardiva");
    // Una conferma tardiva non deve cancellare una modifica locale più recente.
    await context.setOffline(true);
    await outbox(page, record);
    mode = "delayed";
    await context.setOffline(false);
    await until(() => Boolean(release), "Richiesta in corso");
    const edited = { ...record, tipologia: "Giovane", clientRevision: 2 };
    await outbox(page, edited);
    mode = "ok";
    release();
    await until(() => page.getByRole("button", { name: "Sincronizza ora", exact: true }).isEnabled(), "Conferma precedente elaborata");
    await until(async () => (await outbox(page))[0]?.clientRevision === 2, "Conferma vecchia non cancella la modifica");
    await page.getByRole("button", { name: "Sincronizza ora", exact: true }).click();
    await until(async () => (await outbox(page)).length === 0, "Invio modifica più recente");
  } finally {
    await browser.close();
  }
});
