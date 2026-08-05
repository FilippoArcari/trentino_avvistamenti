  export const specieAmmesse = [
    "Capriolo",
    "Cervo",
    "Camoscio",
    "Volpe",
    "Lepre",
    "Tasso",
    "Orso",
    "Lupo",
  ] as const;

  export const tipologieAmmesse = ["Adulto","Giovane", "Piccolo"] as const;
  export const sessoAmmesso = ["Maschio", "Femmina", "Indeterminato"] as const;

  export type Specie = typeof specieAmmesse[number];
  export type Tipologia = typeof tipologieAmmesse[number];
  export type Sesso = typeof sessoAmmesso[number];