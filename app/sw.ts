// app/sw.ts
import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: WorkerGlobalScope;

// @serwist/next precachea SOLO gli asset statici (JS/CSS) generati al build:
// __SW_MANIFEST non include le route dell'App Router (limite noto del tool,
// vedi https://github.com/serwist/serwist/discussions/195). Senza queste
// entry manuali, ogni pagina diventa disponibile offline solo DOPO essere
// stata visitata online almeno una volta (runtimeCaching è NetworkFirst,
// non precache). Aggiorna questo elenco se aggiungi nuove route.
const pageShellEntries: PrecacheEntry[] = [
  { url: "/", revision: null },
  { url: "/dashboard", revision: null },
  { url: "/coda", revision: null },
  { url: "/~offline", revision: null },
].map((entry) => ({ ...entry, revision: process.env.NEXT_PUBLIC_APP_REVISION ?? "1" }));

const serwist = new Serwist({
  precacheEntries: [...(self.__SW_MANIFEST ?? []), ...pageShellEntries],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache, // fallback runtime per tutto ciò che non è precacheato esplicitamente
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
