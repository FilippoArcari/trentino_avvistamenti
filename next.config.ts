
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { randomUUID } from "node:crypto";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true, // precache anche le pagine visitate durante la navigazione, non solo l'entry point
  reloadOnOnline: false, // la sincronizzazione riparte senza interrompere il modulo
  maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_APP_REVISION: randomUUID() },
};

export default withSerwist(nextConfig);
