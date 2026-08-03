
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true, // precache anche le pagine visitate durante la navigazione, non solo l'entry point
  reloadOnOnline: true,    // ricarica l'app quando torna la connessione, per aggiornare eventuale UI stale
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withSerwist(nextConfig);