import { specieAmmesse } from "@/app/utils/constant";

// Posizione nell'elenco canonico di constant.ts. Usare l'indice (anziché
// un hash sulla stringa grezza) fissa il colore di ogni specie ammessa
// in modo permanente e indipendente da quali specie sono presenti nel
// dataset corrente o dall'ordine di iterazione a runtime.
const INDICE_SPECIE: ReadonlyMap<string, number> = new Map(
  specieAmmesse.map((s, i) => [s.toLowerCase(), i])
);

// Fallback per stringhe che non compaiono in specieAmmesse (dato non
// validato, o disallineamento futuro tra DB e constant.ts): non deve
// mai andare in errore né mostrare un colore fisso/bianco per tutto
// ciò che non riconosce.
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const GOLDEN_ANGLE = 137.50776; // angolo aureo — distribuzione hue quasi-ottimale

export function hueSpecie(specie: string): number {
  const idx = INDICE_SPECIE.get(specie.toLowerCase());
  const seed = idx !== undefined ? idx : hashString(specie);
  return (seed * GOLDEN_ANGLE) % 360;
}

export function hslaSpecie(specie: string, alpha: number): string {
  return `hsla(${hueSpecie(specie).toFixed(1)}, 60%, 58%, ${alpha})`;
}

export function coloreSpecie(specie: string): { bg: string; border: string } {
  return { bg: hslaSpecie(specie, 0.8), border: hslaSpecie(specie, 1) };
}

// Restituisce l'etichetta con il casing canonico di specieAmmesse se la
// stringa corrisponde (case-insensitive) a una voce nota; altrimenti la
// stringa grezza così com'è, senza inventare una capitalizzazione.
export function etichettaSpecie(specie: string): string {
  const match = specieAmmesse.find(
    (s) => s.toLowerCase() === specie.toLowerCase()
  );
  return match ?? specie;
}