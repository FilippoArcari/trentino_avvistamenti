export type Specie = "cervo" | "camoscio" | "capriolo";
export type Sesso = "maschio" | "femmina" | "indeterminato";

export const TIPOLOGIE_PER_SPECIE = {
  cervo: ["palcuto", "sottile", "fusone", "piccolo"],
  camoscio: ["yearling", "adulto"],
  capriolo: ["prima", "seconda"],
} as const satisfies Record<Specie, readonly string[]>;

export type Tipologia<S extends Specie> = (typeof TIPOLOGIE_PER_SPECIE)[S][number];

const SESSO_COMPATIBILI: {
  [S in Specie]: Partial<Record<Tipologia<S>, readonly Sesso[]>>;
} = {
  cervo: {
    palcuto: ["maschio"],
    sottile: ["femmina"],
    fusone: ["maschio"],
    piccolo: ["maschio", "femmina", "indeterminato"],
  },
  camoscio: {
    yearling: ["maschio", "femmina", "indeterminato"],
    adulto: ["maschio", "femmina", "indeterminato"],
  },
  capriolo: {
    prima: ["maschio", "femmina", "indeterminato"],
    seconda: ["maschio", "femmina", "indeterminato"],
  },
};

export function sessiAmmessi<S extends Specie>(specie: S, tipologia: Tipologia<S>): readonly Sesso[] {
  return SESSO_COMPATIBILI[specie][tipologia] ?? ["maschio", "femmina", "indeterminato"];
}

export function sessoDeterminato<S extends Specie>(specie: S, tipologia: Tipologia<S>): Sesso | null {
  const ammessi = sessiAmmessi(specie, tipologia);
  return ammessi.length === 1 ? ammessi[0] : null;
}